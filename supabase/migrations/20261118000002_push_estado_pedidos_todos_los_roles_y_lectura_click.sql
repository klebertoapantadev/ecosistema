-- ==============================================================================
-- Migración: 20261118000002_push_estado_pedidos_todos_los_roles_y_lectura_click.sql
-- Módulo: Notificaciones Push de Pedidos para Todos los Roles + Marcado Leído en 1 Clic (PLT-009 / PLT-013 / TNK-002 / TNK-005)
-- Descripción:
--   1. Crea `comun_comercio.com_fn_actualizar_estado_pedido_tienda`: actualiza de forma
--      transaccional (`SECURITY DEFINER`) el estado en `com_proforma` y sincroniza `com_orden_taller`.
--   2. Crea `comun_comercio.com_fn_push_emitir_cambio_estado_pedido`: resuelve TODOS los roles
--      del negocio (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `VENTAS`, `TALLER`, `DELIVERY`,
--      `DELIVERY_EXTERNO` asignado y `CLIENTE` titular del pedido), genera la ruta de acceso directo
--      al pedido modificado acorde a cada rol, inserta las notificaciones en `comun_notificacion.not_registro`
--      con su `not_id` exacto y retorna las suscripciones Web Push activas + claves VAPID desde Vault.
--   3. Crea `comun_seguridad.seg_fn_marcar_notificacion_accion_texto`: marca como leída (`not_leido_en = now()`),
--      pospuesta o eliminada cualquier notificación al hacer clic sobre ella (tanto por UUID `not_id`
--      como por `clave_original` en `not_detalles` y en `notificaciones_estados_negocio`).
--   4. Amplía `comun_seguridad.seg_fn_obtener_staff_negocio` para incluir también `TALLER`, `DELIVERY`
--      y `DELIVERY_EXTERNO`.
-- ==============================================================================

-- 1. Ampliar seg_fn_obtener_staff_negocio para cubrir todos los roles operativos del negocio
create or replace function comun_seguridad.seg_fn_obtener_staff_negocio(p_negocio text default 'tranqi')
returns table (
  usu_id uuid,
  usu_correo text,
  perfiles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
begin
  return query
  with candidatos as (
    select
      u.usu_id,
      u.usu_correo,
      upper(coalesce(p.per_clave, m.mem_rol, 'OPERADOR')) as rol_efectivo
    from comun_seguridad.seg_usuario u
    join comun_seguridad.seg_membresia m
      on m.mem_usuario_id = u.usu_id
     and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio_canon
     and m.mem_estado = 'ACTIVO'
    left join comun_seguridad.seg_membresia_perfil mp
      on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p
      on p.per_id = mp.mpe_perfil_id
    where u.usu_eliminado_en is null
      and (
        upper(coalesce(m.mem_rol, '')) in (
          'OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN', 'AUXILIAR',
          'VENTAS', 'VENDEDOR', 'ASESOR', 'ASESOR_VENTAS',
          'TALLER', 'FLORISTA', 'DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO', 'SUBCONTRATADO'
        )
        or upper(coalesce(p.per_clave, '')) in (
          'OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN', 'AUXILIAR',
          'VENTAS', 'VENDEDOR', 'ASESOR', 'ASESOR_VENTAS',
          'TALLER', 'FLORISTA', 'DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO', 'SUBCONTRATADO'
        )
      )

    union all

    select
      u.usu_id,
      u.usu_correo,
      'SUPERADMIN'::text as rol_efectivo
    from comun_seguridad.seg_usuario u
    where u.usu_eliminado_en is null
      and (
        (v_negocio_canon <> 'tinkay' and u.usu_superadmin_plataforma = true)
        or (v_negocio_canon = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com'))
      )
  )
  select
    c.usu_id,
    c.usu_correo,
    array_agg(distinct c.rol_efectivo) as perfiles
  from candidatos c
  where c.usu_correo is not null and length(btrim(c.usu_correo)) > 3
  group by c.usu_id, c.usu_correo;
end;
$$;

grant execute on function comun_seguridad.seg_fn_obtener_staff_negocio(text)
  to anon, authenticated, service_role;

-- 2. RPC transaccional para actualizar estado de pedido en BandejaPedidosTienda y sincronizar Taller
create or replace function comun_comercio.com_fn_actualizar_estado_pedido_tienda(
  p_negocio text,
  p_pedido_id uuid,
  p_nuevo_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_rol_actor text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_estado text := upper(btrim(coalesce(p_nuevo_estado, '')));
  v_actor_nombre text;
  v_prf record;
  v_det jsonb;
  v_prefijo text;
  v_codigo text;
  v_estado_anterior text;
  v_estado_taller_sync text := null;
  v_repartidor_id uuid := null;
  v_ahora timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión.');
  end if;

  if v_rol_actor not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para actualizar el estado de pedidos.');
  end if;

  if v_estado not in (
    'ENVIADA',
    'PENDIENTE_PAGO',
    'ORDEN_CONFIRMADA',
    'RESERVADA_70',
    'APROBADA',
    'NO_ACEPTADA',
    'EN_PREPARACION',
    'EN_RUTA',
    'ENTREGADO',
    'CANCELADO'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Estado de pedido no válido: ' || v_estado);
  end if;

  select *
    into v_prf
    from comun_comercio.com_proforma p
   where p.prf_id = p_pedido_id
     and comun_seguridad.seg_fn_normalizar_negocio(p.prf_negocio) = v_negocio
     and p.prf_eliminado_en is null
   for update;

  if v_prf.prf_id is null then
    return jsonb_build_object('ok', false, 'error', 'Pedido no encontrado en este negocio.');
  end if;

  select coalesce(
    nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
    split_part(coalesce(u.usu_correo, ''), '@', 1),
    'Equipo'
  )
    into v_actor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_det := coalesce(v_prf.prf_detalle_proforma, '{}'::jsonb);
  v_estado_anterior := upper(coalesce(v_prf.prf_estado, v_det->>'estado', 'PENDIENTE_PAGO'));

  v_prefijo := case v_negocio
    when 'tinkay' then 'TNK'
    when 'margaritas' then 'MRG'
    when 'fastfix' then 'FFH'
    else 'TRQ'
  end;

  v_codigo := coalesce(
    nullif(btrim(coalesce(v_det->>'codigo_proforma', '')), ''),
    nullif(btrim(coalesce(v_det->>'codigo_orden', '')), ''),
    v_prefijo || '-' || case when coalesce(v_det->>'tipo_origen', '') = 'PROFORMA_EVENTO' then 'PRF' else 'ORD' end || '-' || lpad(coalesce(v_prf.prf_secuencial, 1)::text, 4, '0')
  );

  if v_estado = 'EN_PREPARACION' then
    v_estado_taller_sync := 'EN_PREPARACION';
  elsif v_estado = 'EN_RUTA' then
    v_estado_taller_sync := 'LISTO_ENTREGA';
  elsif v_estado = 'ENTREGADO' then
    v_estado_taller_sync := 'ENTREGADO';
  end if;

  if v_estado_taller_sync is not null then
    v_det := v_det || jsonb_build_object('estado_taller', v_estado_taller_sync);
  end if;

  update comun_comercio.com_proforma
     set prf_estado = v_estado,
         prf_detalle_proforma = v_det || jsonb_build_object('estado', v_estado),
         prf_actualizado_en = v_ahora
   where prf_id = v_prf.prf_id;

  -- Sincronizar orden de taller asociada si existe
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    update comun_comercio.com_orden_taller
       set ota_estado_pago = v_estado,
           ota_estado_taller = coalesce(v_estado_taller_sync, ota_estado_taller),
           ota_entregado_en = case when v_estado = 'ENTREGADO' then coalesce(ota_entregado_en, v_ahora) else ota_entregado_en end,
           ota_actualizado_en = v_ahora
     where ota_proforma_id = v_prf.prf_id
       and ota_eliminado_en is null
     returning ota_repartidor_id into v_repartidor_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pedidoId', v_prf.prf_id,
    'codigoOrden', v_codigo,
    'estadoAnterior', v_estado_anterior,
    'nuevoEstado', v_estado,
    'compradorNombre', coalesce(v_prf.prf_cliente_nombre, v_det #>> '{comprador,nombreCompleto}', 'Cliente'),
    'totalUsd', coalesce(v_prf.prf_total, 0),
    'clienteUsuarioId', v_prf.prf_cliente_id,
    'repartidorAsignadoId', v_repartidor_id,
    'actorNombre', coalesce(v_actor_nombre, 'Equipo')
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_actualizar_estado_pedido_tienda(text, uuid, text) from public, anon;
grant execute on function comun_comercio.com_fn_actualizar_estado_pedido_tienda(text, uuid, text) to authenticated, service_role;

-- 3. RPC transaccional: Emitir notificaciones In-App + contexto Web Push a TODOS los roles con enlace directo al pedido
create or replace function comun_comercio.com_fn_push_emitir_cambio_estado_pedido(
  p_negocio text,
  p_pedido_id uuid default null,
  p_codigo_orden text default null,
  p_nuevo_estado text default null,
  p_etiqueta_estado text default null,
  p_titulo text default null,
  p_cuerpo_plano text default null,
  p_contenido_html text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_codigo_corto text := comun_seguridad.seg_fn_codigo_notificacion_negocio(v_negocio);
  v_uid uuid := auth.uid();
  v_rol_caller text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_prf_id uuid := p_pedido_id;
  v_codigo text := nullif(btrim(coalesce(p_codigo_orden, '')), '');
  v_cliente_id uuid := null;
  v_repartidor_id uuid := null;
  v_comprador_nombre text := 'Cliente';
  v_estado_txt text := coalesce(nullif(btrim(coalesce(p_etiqueta_estado, '')), ''), nullif(btrim(coalesce(p_nuevo_estado, '')), ''), 'Actualizado');
  v_titulo text;
  v_cuerpo text;
  v_html text;
  v_cfg comun_configuracion.cfg_negocio;
  v_pub text;
  v_priv text;
  v_dest record;
  v_not_id uuid;
  v_url_rol text;
  v_codigo_enc text;
  v_notificaciones_map jsonb := '{}'::jsonb;
  v_suscripciones jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  if v_rol_caller not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO') then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para emitir alertas operativas de pedidos');
  end if;

  -- Resolver metadatos desde com_orden_taller / com_entrega_evidencia / com_proforma si hace falta
  if v_prf_id is not null and to_regclass('comun_comercio.com_orden_taller') is not null then
    select coalesce(o.ota_proforma_id, v_prf_id),
           coalesce(v_codigo, o.ota_codigo),
           coalesce(o.ota_repartidor_id, v_repartidor_id),
           coalesce(o.ota_cliente_solicita, v_comprador_nombre)
      into v_prf_id, v_codigo, v_repartidor_id, v_comprador_nombre
      from comun_comercio.com_orden_taller o
     where (o.ota_id = p_pedido_id or o.ota_proforma_id = p_pedido_id)
       and o.ota_eliminado_en is null
     limit 1;
  end if;

  if v_prf_id is not null then
    select p.prf_id,
           p.prf_cliente_id,
           coalesce(
             v_codigo,
             nullif(btrim(coalesce(p.prf_detalle_proforma->>'codigo_proforma', '')), ''),
             nullif(btrim(coalesce(p.prf_detalle_proforma->>'codigo_orden', '')), ''),
             'TNK-ORD-' || lpad(coalesce(p.prf_secuencial, 1)::text, 4, '0')
           ),
           coalesce(p.prf_cliente_nombre, p.prf_detalle_proforma #>> '{comprador,nombreCompleto}', v_comprador_nombre)
      into v_prf_id, v_cliente_id, v_codigo, v_comprador_nombre
      from comun_comercio.com_proforma p
     where p.prf_id = v_prf_id
     limit 1;
  end if;

  if v_codigo is null or v_codigo = '' then
    v_codigo := 'PEDIDO';
  end if;

  v_titulo := left(
    coalesce(
      nullif(btrim(coalesce(p_titulo, '')), ''),
      '📦 Pedido ' || v_codigo || ' · ' || v_estado_txt
    ),
    280
  );

  v_cuerpo := left(
    coalesce(
      nullif(btrim(coalesce(p_cuerpo_plano, '')), ''),
      'El pedido ' || v_codigo || ' (' || v_comprador_nombre || ') cambió a estado: ' || v_estado_txt || '. Toca para abrirlo.'
    ),
    240
  );

  v_html := coalesce(
    nullif(btrim(coalesce(p_contenido_html, '')), ''),
    '<div>El pedido <strong>' || v_codigo || '</strong> (' || v_comprador_nombre || ') se actualizó a <strong>' || v_estado_txt || '</strong>.</div>'
  );

  v_codigo_enc := replace(replace(v_codigo, ' ', '%20'), '#', '%23');

  -- Claves VAPID desde cfg_negocio + Vault
  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_pub := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'vapid_public_key', '')), '');
  if v_cfg.cfg_vapid_secreto_id is not null then
    select d.decrypted_secret into v_priv
    from vault.decrypted_secrets d
    where d.id = v_cfg.cfg_vapid_secreto_id;
  end if;

  -- Recorrer TODOS los destinatarios activos de todos los roles del negocio (+ el cliente titular si existe)
  for v_dest in
    with roles_por_usuario as (
      -- Propietarios / SuperAdmin del negocio
      select
        u.usu_id as usuario_id,
        'SUPERADMIN'::text as rol,
        100 as prioridad
      from comun_seguridad.seg_usuario u
      where u.usu_eliminado_en is null
        and (
          (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com'))
          or (v_negocio <> 'tinkay' and u.usu_superadmin_plataforma = true)
        )

      union all

      -- Miembros con rol operativo o administrativo en el negocio
      select
        u.usu_id as usuario_id,
        case
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('SUPERADMIN') and v_negocio <> 'tinkay' then 'SUPERADMIN'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN')
               and (v_negocio <> 'tinkay' or coalesce((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false))
            then 'ADMINISTRADOR'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO') then 'OPERADOR'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR') then 'VENTAS'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('TALLER', 'FLORISTA') then 'TALLER'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY', 'REPARTIDOR') then 'DELIVERY'
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY_EXTERNO', 'SUBCONTRATADO')
               and (v_repartidor_id is null or u.usu_id = v_repartidor_id)
            then 'DELIVERY_EXTERNO'
          else null
        end as rol,
        case
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('SUPERADMIN') then 95
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN') then 80
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO') then 30
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR') then 20
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('TALLER', 'FLORISTA') then 18
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY', 'REPARTIDOR') then 15
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY_EXTERNO', 'SUBCONTRATADO') then 12
          else 0
        end as prioridad
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
      left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
      where u.usu_eliminado_en is null
        and m.mem_estado = 'ACTIVO'
        and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio

      union all

      -- Cliente titular del pedido (si es usuario registrado)
      select
        u.usu_id as usuario_id,
        'CLIENTE'::text as rol,
        5 as prioridad
      from comun_seguridad.seg_usuario u
      where v_cliente_id is not null
        and u.usu_id = v_cliente_id
        and u.usu_eliminado_en is null
    )
    select distinct on (r.usuario_id)
      r.usuario_id,
      r.rol
    from roles_por_usuario r
    where r.rol is not null
    order by r.usuario_id, r.prioridad desc
  loop
    v_not_id := gen_random_uuid();

    v_url_rol := case
      when v_dest.rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS')
        then '/panel/pedidos?pedido=' || v_codigo_enc || '&not_id=' || v_not_id::text
      when v_dest.rol = 'TALLER'
        then '/panel/taller?pedido=' || v_codigo_enc || '&not_id=' || v_not_id::text
      when v_dest.rol in ('DELIVERY', 'DELIVERY_EXTERNO')
        then '/panel/entregas?pedido=' || v_codigo_enc || '&not_id=' || v_not_id::text
      else
        '/panel?vista=pedidos&pedido=' || v_codigo_enc || '&not_id=' || v_not_id::text
    end;

    insert into comun_notificacion.not_registro (
      not_id,
      not_usuario_id,
      not_negocio,
      not_canal,
      not_titulo,
      not_contenido_html,
      not_url_accion,
      not_detalles,
      not_creado_en
    ) values (
      v_not_id,
      v_dest.usuario_id,
      v_codigo_corto,
      'IN_APP',
      v_titulo,
      v_html,
      v_url_rol,
      jsonb_build_object(
        'clave_original', v_not_id::text,
        'negocio_canon', v_negocio,
        'tipo_evento', 'ESTADO_PEDIDO',
        'codigo_orden', v_codigo,
        'pedido_id', v_prf_id,
        'nuevo_estado', p_nuevo_estado
      ),
      now()
    );

    v_notificaciones_map := v_notificaciones_map || jsonb_build_object(
      v_dest.usuario_id::text,
      jsonb_build_object(
        'notId', v_not_id::text,
        'rol', v_dest.rol,
        'url', v_url_rol
      )
    );

    select v_suscripciones || coalesce(
      jsonb_agg(
        jsonb_build_object(
          'usuarioId', s.psu_usuario_id,
          'rol', v_dest.rol,
          'notId', v_not_id::text,
          'url', v_url_rol,
          'endpoint', s.psu_endpoint,
          'p256dh', s.psu_p256dh,
          'auth', s.psu_auth
        )
      ),
      '[]'::jsonb
    )
    into v_suscripciones
    from comun_seguridad.seg_push_suscripcion s
    where s.psu_usuario_id = v_dest.usuario_id
      and s.psu_negocio = v_negocio
      and s.psu_activo = true
      and s.psu_eliminado_en is null;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'codigoOrden', v_codigo,
    'titulo', v_titulo,
    'cuerpoPlano', v_cuerpo,
    'vapidPublicKey', v_pub,
    'vapidPrivateKey', v_priv,
    'notificacionesPorUsuario', v_notificaciones_map,
    'suscripciones', v_suscripciones
  );
end;
$$;

revoke all on function comun_comercio.com_fn_push_emitir_cambio_estado_pedido(text, uuid, text, text, text, text, text, text) from public, anon;
grant execute on function comun_comercio.com_fn_push_emitir_cambio_estado_pedido(text, uuid, text, text, text, text, text, text) to authenticated, service_role;

-- 4. RPC transaccional: Marcar notificación como leída / pospuesta / eliminada por UUID o clave de texto
create or replace function comun_seguridad.seg_fn_marcar_notificacion_accion_texto(
  p_negocio text,
  p_identificador text,
  p_accion text default 'aceptar',
  p_horas integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_ident text := btrim(coalesce(p_identificador, ''));
  v_accion text := lower(btrim(coalesce(p_accion, 'aceptar')));
  v_horas integer := greatest(1, coalesce(p_horas, 3));
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
  v_uuid_cand uuid := null;
  v_filas integer := 0;
begin
  if v_uid is null or v_ident = '' then
    return jsonb_build_object('ok', false, 'error', 'Identificador o sesión no válidos');
  end if;

  begin
    v_uuid_cand := v_ident::uuid;
  exception when others then
    v_uuid_cand := null;
  end;

  if v_accion = 'aceptar' then
    update comun_notificacion.not_registro r
       set not_leido_en = coalesce(r.not_leido_en, v_ahora)
     where r.not_usuario_id = v_uid
       and (
         (v_uuid_cand is not null and r.not_id = v_uuid_cand)
         or coalesce(r.not_detalles->>'clave_original', '') in (
           v_ident,
           'inapp-' || v_ident,
           'push-' || v_ident,
           v_ident || ':push',
           regexp_replace(v_ident, '^(inapp-|push-)', '')
         )
       );
    get diagnostics v_filas = row_count;
  elsif v_accion = 'posponer' then
    update comun_notificacion.not_registro r
       set not_detalles = coalesce(r.not_detalles, '{}'::jsonb) || jsonb_build_object(
             'pospuesta_horas', v_horas,
             'pospuesta_hasta', (v_ahora + make_interval(hours => v_horas))
           )
     where r.not_usuario_id = v_uid
       and (
         (v_uuid_cand is not null and r.not_id = v_uuid_cand)
         or coalesce(r.not_detalles->>'clave_original', '') = v_ident
       );
    get diagnostics v_filas = row_count;
  elsif v_accion = 'eliminar' then
    update comun_notificacion.not_registro r
       set not_leido_en = coalesce(r.not_leido_en, v_ahora),
           not_detalles = coalesce(r.not_detalles, '{}'::jsonb) || jsonb_build_object(
             'eliminada', true,
             'eliminada_en', v_ahora_iso
           )
     where r.not_usuario_id = v_uid
       and (
         (v_uuid_cand is not null and r.not_id = v_uuid_cand)
         or coalesce(r.not_detalles->>'clave_original', '') = v_ident
       );
    get diagnostics v_filas = row_count;
  elsif v_accion = 'restaurar' then
    update comun_notificacion.not_registro r
       set not_detalles = (coalesce(r.not_detalles, '{}'::jsonb) - 'eliminada' - 'eliminada_en') || jsonb_build_object(
             'eliminada', false
           )
     where r.not_usuario_id = v_uid
       and (
         (v_uuid_cand is not null and r.not_id = v_uuid_cand)
         or coalesce(r.not_detalles->>'clave_original', '') = v_ident
       );
    get diagnostics v_filas = row_count;
  end if;

  return jsonb_build_object('ok', true, 'actualizadas', v_filas, 'leidoEn', v_ahora_iso);
end;
$$;

revoke all on function comun_seguridad.seg_fn_marcar_notificacion_accion_texto(text, text, text, integer) from public, anon;
grant execute on function comun_seguridad.seg_fn_marcar_notificacion_accion_texto(text, text, text, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
