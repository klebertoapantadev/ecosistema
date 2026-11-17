-- ==============================================================================
-- Migración: 20261116000005_omnicanal_visor_imagenes_y_chat_grupal_equipo.sql
-- Requerimientos: PLT-010 / TNK-004 / TNK-006 (Visor Multimedia Bidireccional WhatsApp + Chat Grupal Interno del Equipo con @menciones y Reenvío)
-- Descripción:
--   1. Amplía políticas de Storage `comun-publico` para adjuntos de chat (`omnicanal-media/%` y `chat-equipo/%`).
--   2. Habilita canal `'interno'` en `comun_agentes.agc_conversacion` con RLS estricto por rol:
--      - `cnv_canal = 'interno'`: accesible a todo el personal activo del negocio (`seg_fn_es_delivery_o_staff_negocio`: Admin, Ventas, Taller, Delivery).
--      - Canales de clientes (`'whatsapp'`, `'web'`, etc.): restringidos exclusivamente a Ventas/Operación (`seg_fn_es_equipo_ventas_negocio`).
--   3. Corrige persistencia y retorno en tiempo real de imágenes entrantes del cliente (YCloud `image`/`sticker` + ecos móviles)
--      y salientes de Mía (ARIA) / Asesoras humanas, normalizando historial previo para que se visualicen en `/panel/conversaciones`.
--   4. Crea RPCs transaccionales `com_fn_chat_equipo_obtener_sala` y `com_fn_chat_equipo_enviar_mensaje` con resolución
--      automática de `@menciones` individuales (`@kleber`) y por rol (`@taller`, `@ventas`, `@delivery`, `@todos`), respuestas citadas y reenvío multimedia.
--   5. Registra y pre-configura por defecto el widget `chat_equipo` (`/panel/chat-equipo`) en `seg_widget` y `seg_rol_widget` (Regla 15).
-- ==============================================================================

-- 1. Políticas de Storage para adjuntos multimedia de chats omnicanal y chat grupal del equipo
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'comun-publico',
    'comun-publico',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
  )
  on conflict (id) do update set
    file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 10485760),
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'];

  drop policy if exists "operaciones_taller_y_entregas_insert_autenticado" on storage.objects;
  create policy "operaciones_taller_y_entregas_insert_autenticado"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'comun-publico'
      and (
        name like 'inventario-rosas/%'
        or name like 'entrega-inmediata/%'
        or name like 'evidencias-entregas/%'
        or name like 'informes-entregas/%'
        or name like 'omnicanal-media/%'
        or name like 'chat-equipo/%'
      )
    );
exception when others then
  null;
end $$;

-- 2. Habilitar canal `'interno'` en comun_agentes.agc_conversacion y actualizar RLS diferenciado
do $$
declare
  v_con record;
begin
  for v_con in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'comun_agentes'
      and t.relname = 'agc_conversacion'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%cnv_canal%'
  loop
    execute format('alter table comun_agentes.agc_conversacion drop constraint if exists %I', v_con.conname);
  end loop;

  alter table comun_agentes.agc_conversacion
    add constraint chk_agc_conversacion_canal
    check (cnv_canal in ('web', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'telegram', 'interno'));
end $$;

drop policy if exists agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion
  for select using (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else (
        comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
        or (auth.uid() is not null and cnv_usuario_id = auth.uid())
      )
    end
  );

drop policy if exists agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion
  for all using (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
    end
  ) with check (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
    end
  );

drop policy if exists agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje
  for select using (
    exists (
      select 1
      from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (c.cnv_canal <> 'interno' and comun_seguridad.seg_fn_es_equipo_ventas_negocio(c.cnv_negocio))
          or (
            c.cnv_canal <> 'interno'
            and msg_origen <> 'NOTA_INTERNA'
            and auth.uid() is not null
            and c.cnv_usuario_id = auth.uid()
          )
        )
    )
  );

drop policy if exists agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje
  for all using (
    exists (
      select 1
      from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (c.cnv_canal <> 'interno' and comun_seguridad.seg_fn_es_equipo_ventas_negocio(c.cnv_negocio))
        )
    )
  ) with check (
    exists (
      select 1
      from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (c.cnv_canal <> 'interno' and comun_seguridad.seg_fn_es_equipo_ventas_negocio(c.cnv_negocio))
        )
    )
  );

-- 3. Normalizar mensajes previos de imagen entrante para que muestren su miniatura inmediatamente
update comun_agentes.agc_mensaje
   set msg_contenido = case
     when msg_contenido ~ '!\[[^\]]*\]\(https?://' then msg_contenido
     when msg_contenido like '📷 Imagen adjunta por el cliente:%' then
       '![Foto enviada por el cliente](' || btrim(msg_detalle_mensaje->>'imagen_url') || ')'
     else
       msg_contenido || E'\n![Foto enviada por el cliente](' || btrim(msg_detalle_mensaje->>'imagen_url') || ')'
   end
 where msg_eliminado_en is null
   and coalesce(msg_detalle_mensaje->>'imagen_url', '') ~ '^https?://'
   and msg_contenido !~ '!\[[^\]]*\]\(https?://';

-- 4. Actualizar com_fn_omnicanal_obtener_tablero para excluir salas internas (`cnv_canal <> 'interno'`) de la bandeja de clientes
create or replace function comun_comercio.com_fn_omnicanal_obtener_tablero(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_conversaciones jsonb;
  v_etiquetas jsonb;
  v_respuestas jsonb;
  v_equipo jsonb;
  v_usuarios_web jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos de ventas u operación en este negocio.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.etq_id,
      'slug', e.etq_slug,
      'nombre', e.etq_nombre,
      'color', e.etq_color,
      'icono', e.etq_icono,
      'orden', e.etq_orden
    ) order by e.etq_orden asc, e.etq_nombre asc
  ), '[]'::jsonb)
  into v_etiquetas
  from comun_agentes.agc_etiqueta e
  where e.etq_negocio = v_negocio
    and e.etq_activo = true
    and e.etq_eliminado_en is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.rrp_id,
      'atajo', r.rrp_atajo,
      'titulo', r.rrp_titulo,
      'categoria', r.rrp_categoria,
      'contenido', r.rrp_contenido,
      'usoConteo', r.rrp_uso_conteo
    ) order by r.rrp_categoria asc, r.rrp_atajo asc
  ), '[]'::jsonb)
  into v_respuestas
  from comun_agentes.agc_respuesta_rapida r
  where r.rrp_negocio = v_negocio
    and r.rrp_activo = true
    and r.rrp_eliminado_en is null;

  select coalesce(jsonb_agg(sub.miembro order by sub.nombre asc), '[]'::jsonb)
  into v_equipo
  from (
    select distinct on (u.usu_id)
      u.usu_id,
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo) as nombre,
      jsonb_build_object(
        'usuarioId', u.usu_id,
        'nombre', coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo),
        'correo', u.usu_correo,
        'avatarUrl', u.usu_detalle_usuario->>'foto',
        'rol', case
          when u.usu_superadmin_plataforma or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com') then 'SUPERADMIN'
          else coalesce(p.per_clave, m.mem_rol, 'VENTAS')
        end,
        'chatsActivos', (
          select count(*)
          from comun_agentes.agc_conversacion ca
          where ca.cnv_negocio = v_negocio
            and ca.cnv_canal <> 'interno'
            and ca.cnv_asesora_asignada_id = u.usu_id
            and ca.cnv_estado_atencion <> 'CERRADO'
            and ca.cnv_eliminado_en is null
        )
      ) as miembro
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )
      and (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) sub;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cnv_id,
      'secuencial', c.cnv_secuencial,
      'negocio', c.cnv_negocio,
      'canal', c.cnv_canal,
      'claveHilo', c.cnv_clave_hilo,
      'remitenteId', c.cnv_remitente_id,
      'remitenteNombre', c.cnv_remitente_nombre,
      'remitenteCorreo', c.cnv_remitente_correo,
      'remitenteTelefono', c.cnv_remitente_telefono,
      'usuarioId', c.cnv_usuario_id,
      'clienteId', c.cnv_cliente_id,
      'estadoAtencion', c.cnv_estado_atencion,
      'asesoraAsignadaId', c.cnv_asesora_asignada_id,
      'asesoraNombre', (
        select btrim(coalesce(ua.usu_nombres, '') || ' ' || coalesce(ua.usu_apellidos, ''))
        from comun_seguridad.seg_usuario ua
        where ua.usu_id = c.cnv_asesora_asignada_id
      ),
      'ultimoMensajeTexto', c.cnv_ultimo_mensaje_texto,
      'ultimoMensajeOrigen', c.cnv_ultimo_mensaje_origen,
      'ultimoMensajeEn', c.cnv_ultimo_mensaje_en,
      'noLeidosAsesora', c.cnv_no_leidos_asesora,
      'mensajesClienteConteo', c.cnv_mensajes_cliente_conteo,
      'mensajesIaConteo', c.cnv_mensajes_ia_conteo,
      'mensajesHumanoConteo', c.cnv_mensajes_humano_conteo,
      'motivoEscalamiento', c.cnv_motivo_escalamiento,
      'recordatorioEn', c.cnv_recordatorio_en,
      'recordatorioNota', c.cnv_recordatorio_nota,
      'ventana24hExpiraEn', c.cnv_ventana_24h_expira_en,
      'creadoEn', c.cnv_creado_en,
      'etiquetasIds', coalesce((
        select jsonb_agg(ce.cet_etiqueta_id)
        from comun_agentes.agc_conversacion_etiqueta ce
        where ce.cet_conversacion_id = c.cnv_id and ce.cet_eliminado_en is null
      ), '[]'::jsonb)
    ) order by
      case when c.cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      c.cnv_ultimo_mensaje_en desc
  ), '[]'::jsonb)
  into v_conversaciones
  from (
    select *
    from comun_agentes.agc_conversacion
    where cnv_negocio = v_negocio
      and cnv_canal <> 'interno'
      and cnv_eliminado_en is null
    order by
      case when cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      cnv_ultimo_mensaje_en desc
    limit 250
  ) c;

  select coalesce(jsonb_agg(item order by creado_en desc), '[]'::jsonb)
  into v_usuarios_web
  from (
    select
      u.usu_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'usu:' || u.usu_id::text,
        'usuarioId', u.usu_id,
        'clienteId', cl.cli_id,
        'tipoCuenta', 'USUARIO_REGISTRADO',
        'nombre', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')), ''),
          u.usu_correo
        ),
        'correo', u.usu_correo,
        'telefono', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          nullif(btrim(coalesce(u.usu_whatsapp, '')), '')
        ),
        'identificacion', coalesce(cl.cli_identificacion, u.usu_cedula),
        'autorizaWhatsapp', coalesce(
          case
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('true', 't', '1', 'si', 'yes') then true
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('false', 'f', '0', 'no') then false
            else null
          end,
          u.usu_autorizacion_whatsapp,
          false
        ),
        'rolNegocio', coalesce(m.mem_rol, 'CLIENTE'),
        'totalCompras', coalesce(cl.cli_total_compras, 0),
        'montoAcumulado', coalesce(cl.cli_monto_acumulado, 0),
        'ultimaCompraEn', cl.cli_ultima_compra_en,
        'creadoEn', coalesce(m.mem_creado_en, u.usu_creado_en),
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cl.cli_id is not null and cle.cle_cliente_id = cl.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join lateral (
      select c.*
      from comun_comercio.com_cliente c
      where c.cli_negocio = v_negocio
        and c.cli_eliminado_en is null
        and (c.cli_usuario_id = u.usu_id or (u.usu_correo is not null and lower(c.cli_correo) = lower(u.usu_correo)))
      order by c.cli_actualizado_en desc
      limit 1
    ) cl on true
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )

    union all

    select
      c.cli_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'cli:' || c.cli_id::text,
        'usuarioId', null,
        'clienteId', c.cli_id,
        'tipoCuenta', 'INVITADO_NO_REGISTRADO',
        'nombre', c.cli_nombre,
        'correo', c.cli_correo,
        'telefono', c.cli_telefono,
        'identificacion', c.cli_identificacion,
        'autorizaWhatsapp', (
          lower(btrim(coalesce(c.cli_detalle_cliente->'datos_capturados'->>'autorizaWhatsapp', ''))) in ('true', 't', '1', 'si', 'yes')
        ),
        'rolNegocio', 'INVITADO',
        'totalCompras', c.cli_total_compras,
        'montoAcumulado', c.cli_monto_acumulado,
        'ultimaCompraEn', c.cli_ultima_compra_en,
        'creadoEn', c.cli_creado_en,
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cle.cle_cliente_id = c.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and c.cli_eliminado_en is null
      and c.cli_usuario_id is null
      and not exists (
        select 1
        from comun_seguridad.seg_usuario u2
        join comun_seguridad.seg_membresia m2 on m2.mem_usuario_id = u2.usu_id
        where c.cli_correo is not null
          and lower(u2.usu_correo) = lower(c.cli_correo)
          and lower(m2.mem_negocio) = v_negocio
          and m2.mem_estado = 'ACTIVO'
      )
  ) directorio;

  return jsonb_build_object(
    'ok', true,
    'conversaciones', v_conversaciones,
    'etiquetas', v_etiquetas,
    'respuestasRapidas', v_respuestas,
    'equipo', v_equipo,
    'usuariosYClientes', v_usuarios_web
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) to authenticated, service_role;

-- 5. Reforzar despachador multimedia saliente YCloud (soporta saltos de línea entre ] y (, espacios en URL y enlaces directos)
create or replace function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
  p_negocio text,
  p_destino text,
  p_texto text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_api_key text;
  v_emisor text;
  v_destino_digitos text := regexp_replace(coalesce(p_destino, ''), '\D', '', 'g');
  v_destino_e164 text;
  v_restante text;
  v_match text[];
  v_full_tag text;
  v_pos integer;
  v_antes text;
  v_alt text;
  v_img_url text;
  v_intro text;
  v_caption text;
  v_parrafos text[];
  v_num_parrafos integer;
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_ultimo_id text := null;
  v_enviados integer := 0;
  v_imagenes_enviadas integer := 0;
  v_imagenes_urls jsonb := '[]'::jsonb;
  v_ultimo_error text := null;
  v_iter integer := 0;
begin
  if v_destino_digitos = '' then
    return jsonb_build_object('ok', false, 'error', 'Número de WhatsApp destino vacío.');
  end if;

  if v_destino_digitos ~ '^09\d{8}$' then
    v_destino_digitos := '593' || substring(v_destino_digitos from 2);
  end if;
  v_destino_e164 := '+' || v_destino_digitos;

  select
    d.decrypted_secret,
    coalesce(nullif(btrim(a.ari_detalle_aria->>'ycloud_numero_emisor'), ''), '+593996438873')
  into v_api_key, v_emisor
  from comun_configuracion.cfg_aria a
  left join vault.decrypted_secrets d on d.id = a.ari_ycloud_api_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Falta configurar la API Key de YCloud en /panel/aria para despachar mensajes a WhatsApp.'
    );
  end if;

  v_emisor := '+' || regexp_replace(v_emisor, '\D', '', 'g');

  perform pg_catalog.set_config('statement_timeout', '50000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  v_restante := btrim(coalesce(p_texto, ''));
  -- Normalizar ![Alt] \n (https://...) quitando espacios/saltos entre ] y ( (O(N) lineal sin cuantificadores anidados)
  v_restante := regexp_replace(
    v_restante,
    '!\s*\[([^\]]*)\]\s*\(\s*(https?://(?:[^()\r\n]|\([^()\r\n]*\))+)\s*\)',
    '![\1](\2)',
    'gi'
  );
  -- Convertir enlaces directos a archivos de imagen [Alt](https://...jpg) a ![Alt](https://...jpg)
  v_restante := regexp_replace(
    v_restante,
    '(?<!!)\[([^\]]*)\]\s*\(\s*(https?://(?:[^()\s]|\([^()\s]*\))+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^()\s]*)?)\s*\)',
    '![\1](\2)',
    'gi'
  );
  -- Convertir enlaces normales [Texto](https://url) a "Texto: https://url"
  v_restante := regexp_replace(
    v_restante,
    '(?<!!)\[([^\]]+)\]\((https?://(?:[^()\s]|\([^()\s]*\))+)\)',
    '\1: \2',
    'gi'
  );
  v_restante := regexp_replace(v_restante, '\*\*([^*]+)\*\*', '*\1*', 'g');

  loop
    v_iter := v_iter + 1;
    exit when v_iter > 8;

    v_match := regexp_match(v_restante, '(!\[([^\]]*)\]\((https?://(?:[^()\r\n]|\([^()\r\n]*\))+)\))');
    exit when v_match is null;

    v_full_tag := v_match[1];
    v_alt := btrim(coalesce(v_match[2], ''));
    v_img_url := replace(btrim(coalesce(v_match[3], '')), ' ', '%20');
    v_pos := strpos(v_restante, v_full_tag);
    exit when v_pos <= 0;

    v_antes := btrim(left(v_restante, v_pos - 1));
    v_restante := substr(v_restante, v_pos + char_length(v_full_tag));

    v_intro := '';
    v_caption := '';

    if v_antes <> '' then
      v_parrafos := regexp_split_to_array(v_antes, E'\\n\\s*\\n');
      v_num_parrafos := coalesce(array_length(v_parrafos, 1), 0);

      if v_num_parrafos >= 2 then
        v_intro := btrim(array_to_string(v_parrafos[1 : v_num_parrafos - 1], E'\n\n'));
        v_caption := btrim(v_parrafos[v_num_parrafos]);
      elsif char_length(v_antes) <= 900 then
        v_caption := v_antes;
      else
        v_intro := v_antes;
      end if;
    end if;

    if v_caption = '' then
      v_caption := v_alt;
    end if;

    if v_intro <> '' then
      v_cuerpo := jsonb_build_object(
        'from', v_emisor,
        'to', v_destino_e164,
        'type', 'text',
        'text', jsonb_build_object('body', left(v_intro, 4000), 'preview_url', true)
      );

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
          array[extensions.http_header('X-API-Key', v_api_key)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;

        if v_status >= 200 and v_status < 300 then
          v_enviados := v_enviados + 1;
          begin
            v_json := v_content::jsonb;
            v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
          exception when others then null;
          end;
        end if;
      exception when others then
        v_ultimo_error := sqlerrm;
      end;
    end if;

    if v_img_url <> '' then
      v_imagenes_urls := v_imagenes_urls || to_jsonb(v_img_url);
      v_cuerpo := jsonb_build_object(
        'from', v_emisor,
        'to', v_destino_e164,
        'type', 'image',
        'image', jsonb_strip_nulls(jsonb_build_object(
          'link', v_img_url,
          'caption', case when v_caption <> '' then left(v_caption, 1020) else null end
        ))
      );

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
          array[extensions.http_header('X-API-Key', v_api_key)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;

        if v_status >= 200 and v_status < 300 then
          v_enviados := v_enviados + 1;
          v_imagenes_enviadas := v_imagenes_enviadas + 1;
          begin
            v_json := v_content::jsonb;
            v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
          exception when others then null;
          end;
        else
          v_cuerpo := jsonb_build_object(
            'from', v_emisor,
            'to', v_destino_e164,
            'type', 'text',
            'text', jsonb_build_object(
              'body', left(coalesce(nullif(v_caption, '') || E'\n', '') || v_img_url, 4000),
              'preview_url', true
            )
          );
          select h.status, h.content into v_status, v_content
          from extensions.http((
            'POST',
            'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
            array[extensions.http_header('X-API-Key', v_api_key)],
            'application/json',
            v_cuerpo::text
          )::extensions.http_request) as h;
          if v_status >= 200 and v_status < 300 then
            v_enviados := v_enviados + 1;
          else
            begin
              v_json := v_content::jsonb;
              v_ultimo_error := coalesce(v_json->'error'->>'message', v_json->>'message', 'HTTP ' || coalesce(v_status::text, '?'));
            exception when others then
              v_ultimo_error := 'HTTP ' || coalesce(v_status::text, '?');
            end;
          end if;
        end if;
      exception when others then
        v_ultimo_error := sqlerrm;
      end;
    end if;
  end loop;

  v_restante := btrim(regexp_replace(v_restante, E'\\n{3,}', E'\n\n', 'g'));

  if v_restante <> '' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'text',
      'text', jsonb_build_object(
        'body', left(v_restante, 4000),
        'preview_url', true
      )
    );

    begin
      select h.status, h.content
      into v_status, v_content
      from extensions.http((
        'POST',
        'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
        array[extensions.http_header('X-API-Key', v_api_key)],
        'application/json',
        v_cuerpo::text
      )::extensions.http_request) as h;

      begin
        v_json := v_content::jsonb;
      exception when others then
        v_json := null;
      end;

      if v_status >= 200 and v_status < 300 then
        v_enviados := v_enviados + 1;
        v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
      else
        v_ultimo_error := coalesce(
          v_json->'error'->>'message',
          v_json->'error'->'whatsappApiError'->>'message',
          v_json->>'message',
          'YCloud respondió HTTP ' || coalesce(v_status::text, '?')
        );
      end if;
    exception when others then
      v_ultimo_error := 'No se pudo conectar con YCloud API (' || sqlerrm || ')';
    end;
  end if;

  if v_enviados = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_ultimo_error, 'No se pudo enviar el mensaje a WhatsApp.')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'idExterno', v_ultimo_id,
    'mensajesEnviados', v_enviados,
    'imagenesEnviadas', v_imagenes_enviadas,
    'imagenesUrls', v_imagenes_urls,
    'estado', 'sent'
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text) from public, anon, authenticated;

-- 6. Actualizar com_fn_omnicanal_enviar_mensaje_asesor para persistir tipo IMAGEN y urls multimedia
create or replace function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(
  p_negocio text,
  p_conversacion_id uuid,
  p_contenido text,
  p_es_nota_interna boolean default false,
  p_respuesta_rapida_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_autor_nombre text;
  v_texto text := btrim(coalesce(p_contenido, ''));
  v_origen text := case when coalesce(p_es_nota_interna, false) then 'NOTA_INTERNA' else 'ASESORA_HUMANA' end;
  v_tiene_img boolean := false;
  v_cnv_prev comun_agentes.agc_conversacion;
  v_envio_wa jsonb := null;
  v_estado_entrega text := 'ENVIADO';
  v_id_externo text := null;
  v_msg comun_agentes.agc_mensaje;
  v_cnv comun_agentes.agc_conversacion;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para responder en este negocio.');
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje antes de enviar.');
  end if;

  select * into v_cnv_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv_prev.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Asesor')
    into v_autor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_tiene_img := (v_texto ~ '!\s*\[[^\]]*\]\s*\(\s*https?://');

  if v_cnv_prev.cnv_canal = 'whatsapp' and not coalesce(p_es_nota_interna, false) then
    v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
      v_negocio,
      coalesce(nullif(v_cnv_prev.cnv_remitente_telefono, ''), v_cnv_prev.cnv_remitente_id),
      v_texto
    );
    if coalesce((v_envio_wa->>'ok')::boolean, false) then
      v_id_externo := v_envio_wa->>'idExterno';
      v_estado_entrega := 'ENVIADO';
      if coalesce((v_envio_wa->>'imagenesEnviadas')::integer, 0) > 0 then
        v_tiene_img := true;
      end if;
    else
      v_estado_entrega := 'FALLIDO';
    end if;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_usuario_id,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  )
  values (
    v_negocio,
    p_conversacion_id,
    v_origen,
    v_uid,
    v_autor_nombre,
    v_texto,
    case when v_tiene_img then 'IMAGEN' else 'TEXTO' end,
    v_id_externo,
    v_estado_entrega,
    jsonb_strip_nulls(jsonb_build_object(
      'intervencion_humana', (not coalesce(p_es_nota_interna, false)),
      'respuesta_rapida_id', p_respuesta_rapida_id,
      'canal', v_cnv_prev.cnv_canal,
      'imagenes_urls', case when v_envio_wa is not null then v_envio_wa->'imagenesUrls' else null end,
      'error_whatsapp', case when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg;

  if p_respuesta_rapida_id is not null then
    update comun_agentes.agc_respuesta_rapida
       set rrp_uso_conteo = rrp_uso_conteo + 1,
           rrp_actualizado_en = now()
     where rrp_id = p_respuesta_rapida_id
       and rrp_negocio = v_negocio;
  end if;

  if coalesce(p_es_nota_interna, false) then
    update comun_agentes.agc_conversacion
       set cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  else
    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_asesora_asignada_id = coalesce(cnv_asesora_asignada_id, v_uid),
           cnv_atribuido_por = case when cnv_asesora_asignada_id is null then 'MANUAL' else cnv_atribuido_por end,
           cnv_ultimo_mensaje_texto = left(v_texto, 280),
           cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = 0,
           cnv_no_leidos_cliente = cnv_no_leidos_cliente + 1,
           cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mensaje', jsonb_build_object(
      'id', v_msg.msg_id,
      'origen', v_msg.msg_origen,
      'autorUsuarioId', v_msg.msg_autor_usuario_id,
      'autorNombre', v_msg.msg_autor_nombre,
      'contenido', v_msg.msg_contenido,
      'tipoContenido', v_msg.msg_tipo_contenido,
      'estadoEntrega', v_msg.msg_estado_entrega,
      'detalle', v_msg.msg_detalle_mensaje,
      'creadoEn', v_msg.msg_creado_en
    ),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo,
    'avisoWhatsApp', case when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) to authenticated, service_role;

-- 7. Actualizar com_fn_omnicanal_procesar_webhook_ycloud para capturar imágenes de clientes y ecos móviles en Markdown + detalle
create or replace function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(
  p_token text,
  p_firma text default null,
  p_cuerpo_raw text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_webhook_secret text;
  v_t text;
  v_s text;
  v_hmac text;
  v_tipo_evento text := coalesce(p_payload->>'type', '');
  v_in jsonb;
  v_msg_obj jsonb;
  v_id_ext text;
  v_from_digitos text;
  v_to_digitos text;
  v_emisor_digitos text;
  v_nombre_perfil text;
  v_msg_tipo text;
  v_texto text := '';
  v_caption_in text := '';
  v_tipo_bd text := 'TEXTO';
  v_imagen_url text := null;
  v_media_id text := null;
  v_lat numeric := null;
  v_lng numeric := null;
  v_clave_hilo text;
  v_usu_id uuid := null;
  v_cli_id uuid := null;
  v_etq_wa_id uuid := null;
  v_cnv comun_agentes.agc_conversacion;
  v_msg_ins comun_agentes.agc_mensaje;
  v_pide_humano boolean := false;
  v_habilitado boolean := false;
  v_lista_blanca text := '';
  v_autorizado_ia boolean := true;
  v_conteo_despedidas int := 0;
  v_es_despedida_corta boolean := false;
  v_estado_upd text;
begin
  if v_token = '' then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook ausente.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook no reconocido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  if v_aria.ari_ycloud_webhook_secreto_id is not null then
    select d.decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_ycloud_webhook_secreto_id;

    if v_webhook_secret is not null and btrim(v_webhook_secret) <> '' then
      v_t := substring(coalesce(p_firma, '') from 't=([0-9]+)');
      v_s := lower(substring(coalesce(p_firma, '') from 's=([0-9a-fA-F]+)'));
      if v_t is null or v_s is null or p_cuerpo_raw is null then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature requerida.');
      end if;
      v_hmac := encode(extensions.hmac(v_t || '.' || p_cuerpo_raw, v_webhook_secret, 'sha256'), 'hex');
      if v_hmac <> v_s then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature inválida.');
      end if;
    end if;
  end if;

  -- CASO A: Estado de entrega/lectura
  if v_tipo_evento = 'whatsapp.message.updated' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''));
    v_estado_upd := case lower(coalesce(v_msg_obj->>'status', ''))
      when 'delivered' then 'ENTREGADO'
      when 'read' then 'LEIDO'
      when 'failed' then 'FALLIDO'
      else 'ENVIADO'
    end;

    if v_id_ext is not null then
      update comun_agentes.agc_mensaje
         set msg_estado_entrega = v_estado_upd,
             msg_actualizado_en = now()
       where msg_negocio = v_negocio
         and msg_id_externo = v_id_ext;
    end if;

    return jsonb_build_object('ok', true, 'accion', 'ESTADO_ACTUALIZADO');
  end if;

  -- CASO B: Eco de mensaje enviado desde la App Móvil de WhatsApp Business (Coexistencia SMB, incluye fotos)
  if v_tipo_evento = 'whatsapp.smb.message.echoes' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''), nullif(p_payload->>'id', ''));
    v_to_digitos := regexp_replace(coalesce(v_msg_obj->>'to', ''), '\D', '', 'g');
    v_imagen_url := nullif(btrim(coalesce(v_msg_obj->'image'->>'link', v_msg_obj->'image'->>'url', '')), '');
    v_caption_in := btrim(coalesce(v_msg_obj->'text'->>'body', v_msg_obj->'image'->>'caption', ''));

    if v_imagen_url is not null then
      v_tipo_bd := 'IMAGEN';
      v_texto := case
        when v_caption_in <> '' then v_caption_in || E'\n![Foto enviada desde WhatsApp Móvil](' || v_imagen_url || ')'
        else '![Foto enviada desde WhatsApp Móvil](' || v_imagen_url || ')'
      end;
    else
      v_texto := case
        when v_caption_in <> '' then v_caption_in
        when (v_msg_obj->>'type') = 'image' then '📷 Imagen enviada desde WhatsApp Móvil'
        else ''
      end;
    end if;

    if v_to_digitos = '' or v_texto = '' then
      return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
    end if;

    if v_id_ext is not null and exists (
      select 1 from comun_agentes.agc_mensaje
      where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
    ) then
      return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
    end if;

    v_clave_hilo := 'wa:' || v_to_digitos;

    insert into comun_agentes.agc_conversacion (
      cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
      cnv_remitente_telefono, cnv_estado_atencion, cnv_ultimo_mensaje_texto,
      cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en, cnv_mensajes_humano_conteo
    ) values (
      v_negocio, 'whatsapp', v_clave_hilo, '+' || v_to_digitos, 'WhatsApp +' || v_to_digitos,
      '+' || v_to_digitos, 'EN_ATENCION_ASESORA', left(v_texto, 280),
      'ASESORA_HUMANA', now(), 1
    )
    on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
    do update set
      cnv_estado_atencion = 'EN_ATENCION_ASESORA',
      cnv_ultimo_mensaje_texto = left(v_texto, 280),
      cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
      cnv_ultimo_mensaje_en = now(),
      cnv_mensajes_humano_conteo = comun_agentes.agc_conversacion.cnv_mensajes_humano_conteo + 1,
      cnv_actualizado_en = now()
    returning * into v_cnv;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
      msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
    ) values (
      v_negocio, v_cnv.cnv_id, 'ASESORA_HUMANA', 'WhatsApp Móvil Tienda',
      v_texto, v_tipo_bd, v_id_ext, 'ENVIADO',
      jsonb_strip_nulls(jsonb_build_object('canal', 'whatsapp', 'imagen_url', v_imagen_url))
    )
    on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
    do nothing
    returning * into v_msg_ins;

    return jsonb_build_object(
      'ok', true,
      'accion', 'ECO_MOVIL_REGISTRADO',
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  -- CASO C: Mensaje Entrante del Cliente (whatsapp.inbound_message.received)
  if v_tipo_evento <> 'whatsapp.inbound_message.received' and not (p_payload ? 'whatsappInboundMessage') then
    return jsonb_build_object('ok', true, 'accion', 'EVENTO_IGNORADO', 'tipo', v_tipo_evento);
  end if;

  v_in := coalesce(p_payload->'whatsappInboundMessage', '{}'::jsonb);
  v_id_ext := coalesce(nullif(v_in->>'wamid', ''), nullif(v_in->>'id', ''), nullif(p_payload->>'id', ''));
  v_from_digitos := regexp_replace(coalesce(v_in->>'from', ''), '\D', '', 'g');
  v_emisor_digitos := regexp_replace(coalesce(v_aria.ari_detalle_aria->>'ycloud_numero_emisor', ''), '\D', '', 'g');

  if v_from_digitos = '' or (v_emisor_digitos <> '' and v_from_digitos = v_emisor_digitos) then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_EMISOR_PROPIO');
  end if;

  if v_id_ext is not null and exists (
    select 1 from comun_agentes.agc_mensaje
    where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
  ) then
    return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
  end if;

  v_nombre_perfil := coalesce(
    nullif(btrim(coalesce(v_in->'customerProfile'->>'name', '')), ''),
    'WhatsApp +' || v_from_digitos
  );
  v_msg_tipo := lower(coalesce(v_in->>'type', 'text'));

  if v_msg_tipo = 'text' then
    v_texto := btrim(coalesce(v_in->'text'->>'body', ''));
  elsif v_msg_tipo = 'interactive' then
    v_texto := btrim(coalesce(
      v_in->'interactive'->'button_reply'->>'title',
      v_in->'interactive'->'list_reply'->>'title',
      v_in->'interactive'->>'body',
      'Selección interactiva'
    ));
  elsif v_msg_tipo = 'button' then
    v_texto := btrim(coalesce(v_in->'button'->>'text', v_in->'button'->>'payload', 'Botón'));
  elsif v_msg_tipo = 'location' then
    v_tipo_bd := 'UBICACION';
    begin
      v_lat := (v_in->'location'->>'latitude')::numeric;
      v_lng := (v_in->'location'->>'longitude')::numeric;
    exception when others then
      v_lat := null; v_lng := null;
    end;
    v_texto := btrim(
      '📍 Ubicación compartida: ' ||
      coalesce(nullif(v_in->'location'->>'name', '') || ' - ', '') ||
      coalesce(nullif(v_in->'location'->>'address', '') || ' ', '') ||
      case when v_lat is not null and v_lng is not null
        then '(https://www.google.com/maps?q=' || v_lat::text || ',' || v_lng::text || ')'
        else ''
      end
    );
  elsif v_msg_tipo in ('image', 'sticker') then
    v_tipo_bd := 'IMAGEN';
    v_imagen_url := nullif(btrim(coalesce(
      v_in->'image'->>'link',
      v_in->'image'->>'url',
      v_in->'sticker'->>'link',
      v_in->'sticker'->>'url',
      ''
    )), '');
    v_media_id := nullif(btrim(coalesce(v_in->'image'->>'id', v_in->'sticker'->>'id', '')), '');
    v_caption_in := btrim(coalesce(v_in->'image'->>'caption', ''));
    if v_imagen_url is not null then
      v_texto := case
        when v_caption_in <> '' then v_caption_in || E'\n![Foto enviada por el cliente](' || v_imagen_url || ')'
        else '![Foto enviada por el cliente](' || v_imagen_url || ')'
      end;
    else
      v_texto := coalesce(nullif(v_caption_in, ''), '📷 Imagen enviada por el cliente');
    end if;
  elsif v_msg_tipo = 'audio' then
    v_tipo_bd := 'AUDIO';
    v_texto := '🎤 Nota de voz recibida por WhatsApp';
  elsif v_msg_tipo = 'document' then
    v_tipo_bd := 'DOCUMENTO';
    v_imagen_url := nullif(btrim(coalesce(v_in->'document'->>'link', '')), '');
    v_texto := '📄 Documento recibido: ' || coalesce(v_in->'document'->>'filename', 'archivo')
      || case when v_imagen_url is not null then ' (' || v_imagen_url || ')' else '' end;
  else
    v_texto := btrim(coalesce(v_in->'text'->>'body', 'Mensaje (' || v_msg_tipo || ')'));
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
  end if;

  v_clave_hilo := 'wa:' || v_from_digitos;

  select u.usu_id into v_usu_id
  from comun_seguridad.seg_usuario u
  where regexp_replace(coalesce(u.usu_whatsapp, ''), '\D', '', 'g') like '%' || right(v_from_digitos, 9)
  limit 1;

  select c.cli_id into v_cli_id
  from comun_comercio.com_cliente c
  where c.cli_negocio = v_negocio
    and c.cli_eliminado_en is null
    and regexp_replace(coalesce(c.cli_telefono, ''), '\D', '', 'g') like '%' || right(v_from_digitos, 9)
  order by c.cli_actualizado_en desc
  limit 1;

  v_pide_humano := (v_texto ~* '(hablar con (un |una )?(asesor|humano|persona|vendedor)|atenci[oó]n humana|reclamo|queja)');

  insert into comun_agentes.agc_conversacion (
    cnv_negocio,
    cnv_canal,
    cnv_clave_hilo,
    cnv_remitente_id,
    cnv_remitente_nombre,
    cnv_remitente_telefono,
    cnv_usuario_id,
    cnv_cliente_id,
    cnv_estado_atencion,
    cnv_motivo_escalamiento,
    cnv_ultimo_mensaje_texto,
    cnv_ultimo_mensaje_origen,
    cnv_ultimo_mensaje_en,
    cnv_no_leidos_asesora,
    cnv_mensajes_cliente_conteo,
    cnv_ventana_24h_expira_en
  ) values (
    v_negocio,
    'whatsapp',
    v_clave_hilo,
    '+' || v_from_digitos,
    v_nombre_perfil,
    '+' || v_from_digitos,
    v_usu_id,
    v_cli_id,
    case when v_pide_humano then 'ESCALADO_HUMANO' else 'BOT_ACTIVO' end,
    case when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp' else null end,
    left(v_texto, 280),
    'CLIENTE',
    now(),
    1,
    1,
    now() + interval '24 hours'
  )
  on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
  do update set
    cnv_remitente_nombre = case
      when comun_agentes.agc_conversacion.cnv_remitente_nombre like 'WhatsApp +%' then excluded.cnv_remitente_nombre
      else comun_agentes.agc_conversacion.cnv_remitente_nombre
    end,
    cnv_usuario_id = coalesce(comun_agentes.agc_conversacion.cnv_usuario_id, excluded.cnv_usuario_id),
    cnv_cliente_id = coalesce(comun_agentes.agc_conversacion.cnv_cliente_id, excluded.cnv_cliente_id),
    cnv_estado_atencion = case
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then 'EN_ATENCION_ASESORA'
      when v_pide_humano then 'ESCALADO_HUMANO'
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'CERRADO' then 'BOT_ACTIVO'
      else comun_agentes.agc_conversacion.cnv_estado_atencion
    end,
    cnv_motivo_escalamiento = case
      when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp'
      else comun_agentes.agc_conversacion.cnv_motivo_escalamiento
    end,
    cnv_ultimo_mensaje_texto = left(v_texto, 280),
    cnv_ultimo_mensaje_origen = 'CLIENTE',
    cnv_ultimo_mensaje_en = now(),
    cnv_no_leidos_asesora = comun_agentes.agc_conversacion.cnv_no_leidos_asesora + 1,
    cnv_mensajes_cliente_conteo = comun_agentes.agc_conversacion.cnv_mensajes_cliente_conteo + 1,
    cnv_ventana_24h_expira_en = now() + interval '24 hours',
    cnv_actualizado_en = now()
  returning * into v_cnv;

  select etq_id into v_etq_wa_id
  from comun_agentes.agc_etiqueta
  where etq_negocio = v_negocio and etq_slug = 'origen-whatsapp' and etq_eliminado_en is null
  limit 1;

  if v_etq_wa_id is not null then
    insert into comun_agentes.agc_conversacion_etiqueta (cet_negocio, cet_conversacion_id, cet_etiqueta_id)
    values (v_negocio, v_cnv.cnv_id, v_etq_wa_id)
    on conflict (cet_conversacion_id, cet_etiqueta_id) do update set cet_eliminado_en = null;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv.cnv_id,
    'CLIENTE',
    v_cnv.cnv_remitente_nombre,
    v_texto,
    v_tipo_bd,
    v_id_ext,
    'ENTREGADO',
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'imagen_url', v_imagen_url,
      'media_id', v_media_id,
      'caption', nullif(v_caption_in, ''),
      'latitud', v_lat,
      'longitud', v_lng
    ))
  )
  returning * into v_msg_ins;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object(
      'ok', true,
      'accion', 'SILENCIADO_HUMANO',
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  v_habilitado := coalesce((v_aria.ari_detalle_aria->>'ycloud_habilitado')::boolean, false);
  if not v_habilitado then
    return jsonb_build_object(
      'ok', true,
      'accion', 'CANAL_SOLO_MONITOREO',
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  v_lista_blanca := regexp_replace(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[^0-9,;|\n]+', '', 'g');
  if btrim(regexp_replace(v_lista_blanca, '[,;|\n]', '', 'g')) <> '' then
    v_autorizado_ia := exists (
      select 1
      from regexp_split_to_table(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[,;|\n]+') as item_num
      where length(regexp_replace(item_num, '\D', '', 'g')) >= 8
        and right(v_from_digitos, 9) = right(regexp_replace(item_num, '\D', '', 'g'), 9)
    );
    if not v_autorizado_ia then
      return jsonb_build_object(
        'ok', true,
        'accion', 'FUERA_LISTA_BLANCA',
        'negocio', v_negocio,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'tipoMensaje', v_tipo_bd,
        'imagenUrl', v_imagen_url,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      );
    end if;
  end if;

  v_es_despedida_corta := (
    v_imagen_url is null
    and char_length(v_texto) <= 160
    and v_texto ~* '(hasta luego|hasta pronto|que tengas un (buen|excelente) d[ií]a|quedo a la orden|buena tarde)'
    and v_texto !~* '(\?|precio|cu[aá]nto|ramo|arreglo|flores|pedido|enviar|comprar|direcci[oó]n)'
  );

  if v_es_despedida_corta then
    select count(*) into v_conteo_despedidas
    from comun_agentes.agc_mensaje m
    where m.msg_conversacion_id = v_cnv.cnv_id
      and m.msg_origen = 'BOT_ARIA'
      and m.msg_creado_en >= now() - interval '5 minutes'
      and m.msg_contenido ~* '(hasta luego|hasta pronto|excelente d[ií]a|buena tarde)';

    if v_conteo_despedidas >= 1 then
      return jsonb_build_object(
        'ok', true,
        'accion', 'CORTE_BUCLE_DESPEDIDA',
        'negocio', v_negocio,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'tipoMensaje', v_tipo_bd,
        'imagenUrl', v_imagen_url,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'accion', 'INVOCAR_ARIA',
    'negocio', v_negocio,
    'conversacionId', v_cnv.cnv_id,
    'claveHilo', v_clave_hilo,
    'mensajeId', v_msg_ins.msg_id,
    'contenido', v_texto,
    'caption', v_caption_in,
    'tipoMensaje', v_tipo_bd,
    'imagenUrl', v_imagen_url,
    'latitud', v_lat,
    'longitud', v_lng,
    'remitenteNombre', v_cnv.cnv_remitente_nombre,
    'remitenteTelefono', v_cnv.cnv_remitente_telefono,
    'estadoAtencion', v_cnv.cnv_estado_atencion
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) to anon, authenticated, service_role;

-- 8. Actualizar com_fn_omnicanal_responder_whatsapp_con_aria para persistir imagenes_urls y tipo IMAGEN
create or replace function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(
  p_token text,
  p_conversacion_id uuid,
  p_prompt text,
  p_imagen_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_cnv comun_agentes.agc_conversacion;
  v_base_url text;
  v_agente_id text;
  v_api_key text;
  v_cuerpo_aria jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_run_id text;
  v_escala boolean := false;
  v_envio_wa jsonb;
  v_tiene_img boolean := false;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token de webhook inválido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');
  v_agente_id := coalesce(
    nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), ''),
    nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '')
  );

  if v_aria.ari_whatsapp_agente_secreto_id is not null then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_whatsapp_agente_secreto_id;
  end if;

  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_cuerpo_aria := jsonb_strip_nulls(jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', 'wa-' || regexp_replace(coalesce(v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g'),
    'image_urls', case when p_imagen_url is not null and btrim(p_imagen_url) <> '' then jsonb_build_array(btrim(p_imagen_url)) else null end
  ));

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      v_base_url || '/v1/agents/' || v_agente_id || '/invoke',
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      'application/json',
      v_cuerpo_aria::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Error invocando ARIA (' || sqlerrm || ')');
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  v_respuesta := btrim(coalesce(v_json->>'response', v_json->>'detail', ''));
  v_run_id := v_json->>'run_id';

  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió respuesta vacía.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_escala := (v_respuesta ~* '(te comunico ahora mismo con una de nuestras asesoras|transferir con una asesora|\[ESCALAR_HUMANO\])');
  v_respuesta := btrim(regexp_replace(v_respuesta, '\[ESCALAR_HUMANO\]', '', 'gi'));

  v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
    v_negocio,
    coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
    v_respuesta
  );

  v_tiene_img := (
    coalesce((v_envio_wa->>'imagenesEnviadas')::integer, 0) > 0
    or v_respuesta ~ '!\s*\[[^\]]*\]\s*\(\s*https?://'
  );

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv.cnv_id,
    'BOT_ARIA',
    coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta,
    case when v_tiene_img then 'IMAGEN' else 'TEXTO' end,
    v_envio_wa->>'idExterno',
    case when coalesce((v_envio_wa->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'run_id', v_run_id,
      'imagenes_urls', v_envio_wa->'imagenesUrls',
      'error_whatsapp', case when not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg_bot;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = case when v_escala then 'ESCALADO_HUMANO' else cnv_estado_atencion end,
         cnv_motivo_escalamiento = case when v_escala then 'Mía solicitó transferencia a asesora humana' else cnv_motivo_escalamiento end,
         cnv_ultimo_mensaje_texto = left(v_respuesta, 280),
         cnv_ultimo_mensaje_origen = 'BOT_ARIA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv.cnv_id
   returning * into v_cnv;

  return jsonb_build_object(
    'ok', true,
    'conversacionId', v_cnv.cnv_id,
    'claveHilo', v_cnv.cnv_clave_hilo,
    'mensajeId', v_msg_bot.msg_id,
    'respuestaAria', v_respuesta,
    'imagenesUrls', coalesce(v_envio_wa->'imagenesUrls', '[]'::jsonb),
    'autorNombre', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'enviadoWhatsApp', coalesce((v_envio_wa->>'ok')::boolean, false),
    'errorWhatsApp', v_envio_wa->>'error'
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) to anon, authenticated, service_role;

-- 9. Actualizar URL de imagen espejada permanentemente en Storage
create or replace function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(
  p_token text,
  p_mensaje_id uuid,
  p_imagen_publica_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aria comun_configuracion.cfg_aria;
  v_url_nueva text := btrim(coalesce(p_imagen_publica_url, ''));
  v_msg comun_agentes.agc_mensaje;
  v_url_antigua text;
begin
  if v_url_nueva = '' or p_mensaje_id is null then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(coalesce(p_token, ''))
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token no autorizado');
  end if;

  select * into v_msg
  from comun_agentes.agc_mensaje
  where msg_id = p_mensaje_id
    and msg_negocio = v_aria.ari_negocio;

  if v_msg.msg_id is null then
    return jsonb_build_object('ok', false);
  end if;

  v_url_antigua := coalesce(v_msg.msg_detalle_mensaje->>'imagen_url', '');

  update comun_agentes.agc_mensaje
     set msg_contenido = case
           when v_url_antigua <> '' and strpos(msg_contenido, v_url_antigua) > 0
             then replace(msg_contenido, v_url_antigua, v_url_nueva)
           when msg_contenido !~ '!\s*\[[^\]]*\]\s*\(\s*https?://'
             then msg_contenido || E'\n![Foto enviada por el cliente](' || v_url_nueva || ')'
           else msg_contenido
         end,
         msg_tipo_contenido = 'IMAGEN',
         msg_detalle_mensaje = coalesce(msg_detalle_mensaje, '{}'::jsonb) || jsonb_build_object(
           'imagen_url', v_url_nueva,
           'imagen_original_ycloud', nullif(v_url_antigua, '')
         ),
         msg_actualizado_en = now()
   where msg_id = p_mensaje_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(text, uuid, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(text, uuid, text) to anon, authenticated, service_role;

-- ==============================================================================
-- 10. CHAT GRUPAL DE TRABAJO DEL EQUIPO (MENCIONES @HANDLE, RESPUESTAS Y REENVÍO)
-- ==============================================================================

create or replace function comun_comercio.com_fn_chat_equipo_obtener_sala(
  p_negocio text default 'tinkay',
  p_sala text default 'equipo-general'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_rol_actual text;
  v_nombre_actual text := 'Equipo';
  v_handle_actual text := 'equipo';
  v_sala text := coalesce(nullif(regexp_replace(lower(btrim(coalesce(p_sala, ''))), '[^a-z0-9_-]', '', 'g'), ''), 'equipo-general');
  v_cnv comun_agentes.agc_conversacion;
  v_miembros jsonb := '[]'::jsonb;
  v_mensajes jsonb := '[]'::jsonb;
  v_chats_wa jsonb := '[]'::jsonb;
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso exclusivo para miembros del equipo de la tienda.');
  end if;

  v_rol_actual := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);

  select
    coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Equipo'),
    coalesce(
      nullif(
        regexp_replace(
          translate(
            lower(split_part(btrim(coalesce(nullif(u.usu_nombres, ''), split_part(u.usu_correo, '@', 1))), ' ', 1)),
            'áéíóúüñ',
            'aeiouun'
          ),
          '[^a-z0-9_]',
          '',
          'g'
        ),
        ''
      ),
      'equipo'
    )
  into v_nombre_actual, v_handle_actual
  from comun_seguridad.seg_usuario u
  where u.usu_id = v_uid;

  -- Asegurar que exista la sala grupal interna del negocio
  insert into comun_agentes.agc_conversacion (
    cnv_negocio,
    cnv_canal,
    cnv_clave_hilo,
    cnv_remitente_id,
    cnv_remitente_nombre,
    cnv_estado_atencion,
    cnv_ultimo_mensaje_texto,
    cnv_ultimo_mensaje_origen,
    cnv_detalle_conversacion
  ) values (
    v_negocio,
    'interno',
    v_sala,
    'sala:' || v_sala,
    'Chat de Trabajo · Equipo ' || initcap(v_negocio),
    'EN_ATENCION_ASESORA',
    'Sala interna de coordinación entre Ventas, Taller, Delivery y Administración.',
    'SISTEMA',
    jsonb_build_object('tipo_sala', 'CHAT_GRUPAL_EQUIPO', 'sala', v_sala)
  )
  on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
  do update set cnv_actualizado_en = comun_agentes.agc_conversacion.cnv_actualizado_en
  returning * into v_cnv;

  -- Directorio completo de miembros activos del equipo (Ventas, Taller, Delivery, Operador, Admin, SuperAdmin) con @handle
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'usuarioId', st.usu_id,
      'nombre', st.nombre_completo,
      'correo', st.usu_correo,
      'avatarUrl', st.avatar_url,
      'rol', st.rol_efectivo,
      'handle', case
        when st.orden_handle > 1 then st.base_handle || st.orden_handle::text
        else st.base_handle
      end
    ) order by st.nombre_completo asc
  ), '[]'::jsonb)
  into v_miembros
  from (
    select
      base.*,
      row_number() over (partition by base.base_handle order by base.usu_id) as orden_handle
    from (
      select distinct on (u.usu_id)
        u.usu_id,
        u.usu_correo,
        u.usu_detalle_usuario->>'foto' as avatar_url,
        coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1)) as nombre_completo,
        coalesce(
          nullif(
            regexp_replace(
              translate(
                lower(split_part(btrim(coalesce(nullif(u.usu_nombres, ''), split_part(u.usu_correo, '@', 1))), ' ', 1)),
                'áéíóúüñ',
                'aeiouun'
              ),
              '[^a-z0-9_]',
              '',
              'g'
            ),
            ''
          ),
          'miembro'
        ) as base_handle,
        case
          when u.usu_superadmin_plataforma then 'SUPERADMIN'
          when v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com' then 'ADMINISTRADOR'
          else upper(coalesce(p.per_clave, m.mem_rol, 'OPERADOR'))
        end as rol_efectivo
      from comun_seguridad.seg_usuario u
      left join comun_seguridad.seg_membresia m
        on m.mem_usuario_id = u.usu_id
       and m.mem_estado = 'ACTIVO'
       and (
         lower(m.mem_negocio) = v_negocio
         or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
         or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
         or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
         or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
       )
      left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id and p.per_activo = true
      where (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or (
          m.mem_id is not null
          and (
            upper(coalesce(p.per_clave, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'AUXILIAR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'FLORISTA', 'DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO')
            or upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'AUXILIAR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'FLORISTA', 'DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO')
          )
        )
      )
      order by u.usu_id, p.per_nivel desc nulls last
    ) base
  ) st;

  -- Últimos 160 mensajes del chat grupal en orden cronológico
  select coalesce(jsonb_agg(sub.item order by sub.creado_en asc), '[]'::jsonb)
  into v_mensajes
  from (
    select
      m.msg_creado_en as creado_en,
      jsonb_build_object(
        'id', m.msg_id,
        'autorUsuarioId', m.msg_autor_usuario_id,
        'autorNombre', coalesce(m.msg_autor_nombre, 'Equipo'),
        'contenido', m.msg_contenido,
        'tipoContenido', m.msg_tipo_contenido,
        'detalle', coalesce(m.msg_detalle_mensaje, '{}'::jsonb),
        'creadoEn', m.msg_creado_en
      ) as item
    from comun_agentes.agc_mensaje m
    where m.msg_conversacion_id = v_cnv.cnv_id
      and m.msg_negocio = v_negocio
      and m.msg_eliminado_en is null
    order by m.msg_creado_en desc
    limit 160
  ) sub;

  -- Si el miembro pertenece a Ventas/Admin, devolver lista rápida de conversaciones WhatsApp abiertas para reenvío en 1 clic
  if comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.cnv_id,
        'nombre', c.cnv_remitente_nombre,
        'telefono', c.cnv_remitente_telefono,
        'ultimoMensajeEn', c.cnv_ultimo_mensaje_en
      ) order by c.cnv_ultimo_mensaje_en desc
    ), '[]'::jsonb)
    into v_chats_wa
    from (
      select cnv_id, cnv_remitente_nombre, cnv_remitente_telefono, cnv_ultimo_mensaje_en
      from comun_agentes.agc_conversacion
      where cnv_negocio = v_negocio
        and cnv_canal = 'whatsapp'
        and cnv_estado_atencion <> 'CERRADO'
        and cnv_eliminado_en is null
      order by cnv_ultimo_mensaje_en desc
      limit 40
    ) c;
  end if;

  return jsonb_build_object(
    'ok', true,
    'conversacionId', v_cnv.cnv_id,
    'sala', v_sala,
    'nombreSala', v_cnv.cnv_remitente_nombre,
    'usuarioActual', jsonb_build_object(
      'usuarioId', v_uid,
      'nombre', v_nombre_actual,
      'handle', v_handle_actual,
      'rol', v_rol_actual
    ),
    'miembros', v_miembros,
    'mensajes', v_mensajes,
    'conversacionesWhatsapp', v_chats_wa
  );
end;
$$;

revoke all on function comun_comercio.com_fn_chat_equipo_obtener_sala(text, text) from public, anon;
grant execute on function comun_comercio.com_fn_chat_equipo_obtener_sala(text, text) to authenticated, service_role;

-- Enviar mensaje, foto, @mención o reenvío al Chat Grupal del Equipo
create or replace function comun_comercio.com_fn_chat_equipo_enviar_mensaje(
  p_negocio text,
  p_contenido text,
  p_imagen_url text default null,
  p_respuesta_a jsonb default null,
  p_reenviado_de jsonb default null,
  p_sala text default 'equipo-general'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_rol_autor text;
  v_autor_nombre text := 'Equipo';
  v_texto text := btrim(coalesce(p_contenido, ''));
  v_img text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_sala text := coalesce(nullif(regexp_replace(lower(btrim(coalesce(p_sala, ''))), '[^a-z0-9_-]', '', 'g'), ''), 'equipo-general');
  v_sala_info jsonb;
  v_cnv_id uuid;
  v_miembros jsonb;
  v_handles_mencionados text[] := array[]::text[];
  v_usuarios_mencionados uuid[] := array[]::uuid[];
  v_detalle jsonb;
  v_msg comun_agentes.agc_mensaje;
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para escribir en el chat del equipo.');
  end if;

  if v_texto = '' and v_img is null then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje o adjunta una fotografía.');
  end if;

  v_rol_autor := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Equipo')
    into v_autor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_sala_info := comun_comercio.com_fn_chat_equipo_obtener_sala(v_negocio, v_sala);
  if not coalesce((v_sala_info->>'ok')::boolean, false) then
    return v_sala_info;
  end if;

  v_cnv_id := (v_sala_info->>'conversacionId')::uuid;
  v_miembros := coalesce(v_sala_info->'miembros', '[]'::jsonb);

  -- Extraer todos los @handles escritos en el mensaje (ej. @kleber, @taller, @ventas, @delivery, @todos)
  select coalesce(array_agg(distinct lower(m[1])), array[]::text[])
    into v_handles_mencionados
    from regexp_matches(
      translate(lower(v_texto), 'áéíóúüñ', 'aeiouun'),
      '(?:^|\s)@([a-z0-9_]{2,32})',
      'g'
    ) as m;

  -- Resolver IDs de usuarios mencionados (individuales o por grupo @todos / @taller / @ventas / @delivery)
  if coalesce(array_length(v_handles_mencionados, 1), 0) > 0 then
    select coalesce(array_agg(distinct (mb->>'usuarioId')::uuid), array[]::uuid[])
      into v_usuarios_mencionados
      from jsonb_array_elements(v_miembros) as mb
     where (mb->>'usuarioId')::uuid <> v_uid
       and (
         v_handles_mencionados && array['todos', 'equipo']
         or lower(coalesce(mb->>'handle', '')) = any(v_handles_mencionados)
         or (
           v_handles_mencionados && array['taller', 'florista']
           and upper(coalesce(mb->>'rol', '')) in ('TALLER', 'FLORISTA', 'OPERADOR')
         )
         or (
           v_handles_mencionados && array['ventas', 'asesor', 'comercial']
           and upper(coalesce(mb->>'rol', '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'ADMINISTRADOR', 'SUPERADMIN')
         )
         or (
           v_handles_mencionados && array['delivery', 'ruta', 'entregas']
           and upper(coalesce(mb->>'rol', '')) in ('DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO')
         )
         or (
           v_handles_mencionados && array['admin', 'administracion']
           and upper(coalesce(mb->>'rol', '')) in ('ADMINISTRADOR', 'SUPERADMIN')
         )
       );
  end if;

  if v_texto = '' and v_img is not null then
    v_texto := '![Foto compartida al equipo](' || v_img || ')';
  end if;

  v_detalle := jsonb_strip_nulls(jsonb_build_object(
    'sala', v_sala,
    'autor_rol', v_rol_autor,
    'imagen_url', v_img,
    'menciones_handles', case when coalesce(array_length(v_handles_mencionados, 1), 0) > 0 then to_jsonb(v_handles_mencionados) else null end,
    'menciones_usuarios_ids', case when coalesce(array_length(v_usuarios_mencionados, 1), 0) > 0 then to_jsonb(v_usuarios_mencionados) else null end,
    'respuesta_a', p_respuesta_a,
    'reenviado_de', p_reenviado_de
  ));

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_usuario_id,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv_id,
    'NOTA_INTERNA',
    v_uid,
    v_autor_nombre,
    v_texto,
    case when v_img is not null or v_texto ~ '!\s*\[[^\]]*\]\s*\(\s*https?://' then 'IMAGEN' else 'TEXTO' end,
    'ENTREGADO',
    v_detalle
  )
  returning * into v_msg;

  update comun_agentes.agc_conversacion
     set cnv_ultimo_mensaje_texto = left(v_autor_nombre || ': ' || v_texto, 280),
         cnv_ultimo_mensaje_origen = 'NOTA_INTERNA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv_id;

  return jsonb_build_object(
    'ok', true,
    'conversacionId', v_cnv_id,
    'mensaje', jsonb_build_object(
      'id', v_msg.msg_id,
      'autorUsuarioId', v_msg.msg_autor_usuario_id,
      'autorNombre', v_msg.msg_autor_nombre,
      'contenido', v_msg.msg_contenido,
      'tipoContenido', v_msg.msg_tipo_contenido,
      'detalle', v_msg.msg_detalle_mensaje,
      'creadoEn', v_msg.msg_creado_en
    ),
    'mencionadosUsuariosIds', coalesce(to_jsonb(v_usuarios_mencionados), '[]'::jsonb),
    'handlesMencionados', coalesce(to_jsonb(v_handles_mencionados), '[]'::jsonb)
  );
end;
$$;

revoke all on function comun_comercio.com_fn_chat_equipo_enviar_mensaje(text, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function comun_comercio.com_fn_chat_equipo_enviar_mensaje(text, text, text, jsonb, jsonb, text) to authenticated, service_role;

-- 11. Registro y Pre-Configuración por Defecto del Widget `chat_equipo` (Regla 15 / Point 1)
do $$
declare
  v_negocio text;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget
    ) values (
      v_negocio,
      'chat_equipo',
      'Chat del Equipo',
      true,
      jsonb_build_object(
        'descripcion', 'Chat grupal interno del equipo (Ventas, Taller, Delivery y Administración) con @menciones, fotos y reenvío de consultas.',
        'categoria', 'Operación y Comunicación Interna',
        'ruta', '/panel/chat-equipo',
        'panel_defecto', 'panel_administrar',
        'icono', 'Users'
      )
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now()
    returning wdg_id into v_widget_id;

    if v_widget_id is not null then
      insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      select v_negocio, r, v_widget_id, true
      from unnest(array[
        'SUPERADMIN',
        'ADMINISTRADOR',
        'ADMIN',
        'OPERADOR',
        'VENTAS',
        'VENDEDOR',
        'ASESOR',
        'TALLER',
        'DELIVERY',
        'REPARTIDOR',
        'DELIVERY_EXTERNO'
      ]) as r
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
