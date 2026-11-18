-- =============================================================================
-- Migración: Eliminación Lógica (Staff) y Eliminación Definitiva (Solo Admin)
-- Fecha: 2026-11-18
-- Reglas de negocio:
--   1. Solo SUPERADMIN y ADMINISTRADOR pueden ver pedidos en papelera
--      (borrado lógico), restaurarlos o eliminarlos de forma definitiva (DELETE).
--   2. El resto de roles operativos autorizados (OPERADOR, VENTAS) únicamente
--      pueden realizar borrado lógico (*_eliminado_en = now()), sin acceso a
--      ver papelera ni a borrado físico definitivo.
--   3. TALLER, DELIVERY, DELIVERY_EXTERNO y CLIENTE no pueden eliminar pedidos.
-- =============================================================================

-- 1. Columnas de auditoría de eliminación lógica en com_orden_taller
do $$
begin
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    alter table comun_comercio.com_orden_taller
      add column if not exists ota_eliminado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
      add column if not exists ota_eliminado_nombre text,
      add column if not exists ota_eliminado_motivo text;

    create index if not exists idx_com_orden_taller_eliminados_admin
      on comun_comercio.com_orden_taller (ota_negocio, ota_eliminado_en desc)
      where ota_eliminado_en is not null;
  end if;
end $$;

-- 2. Helper estricto: true SOLO para SUPERADMIN o ADMINISTRADOR (excluye OPERADOR/VENTAS/TALLER/DELIVERY)
create or replace function comun_seguridad.seg_fn_es_admin_estricto_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_obtener_rol_operativo_negocio(p_negocio) in (
    'SUPERADMIN',
    'ADMINISTRADOR'
  );
$$;

grant execute on function comun_seguridad.seg_fn_es_admin_estricto_negocio(text) to authenticated, service_role;

-- 3. RPC para eliminación lógica (Staff/Admin) o definitiva (exclusivo Admin/Superadmin)
create or replace function comun_comercio.com_fn_eliminar_pedido_operativo(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_admin boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR'));
  v_definitivo boolean := coalesce((p_payload->>'definitivo')::boolean, false);
  v_motivo text := nullif(btrim(coalesce(p_payload->>'motivo', '')), '');
  v_usu_nombre text;
  v_ota_id uuid;
  v_prf_id uuid;
  v_ent_id uuid;
  v_codigo text;
  v_orden comun_comercio.com_orden_taller;
  v_prf comun_comercio.com_proforma;
  v_ent comun_comercio.com_entrega_evidencia;
begin
  if v_definitivo and not v_es_admin then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo el administrador puede eliminar pedidos de forma definitiva.'
    );
  end if;

  if not v_es_admin and v_rol not in ('OPERADOR', 'VENTAS') then
    return jsonb_build_object(
      'ok', false,
      'error', 'No tienes permisos para eliminar pedidos.'
    );
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Usuario')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_ota_id := nullif(btrim(coalesce(p_payload->>'ordenTallerId', '')), '')::uuid;
  exception when others then
    v_ota_id := null;
  end;

  begin
    v_prf_id := nullif(btrim(coalesce(p_payload->>'proformaId', '')), '')::uuid;
  exception when others then
    v_prf_id := null;
  end;

  begin
    v_ent_id := nullif(btrim(coalesce(p_payload->>'entregaId', '')), '')::uuid;
  exception when others then
    v_ent_id := null;
  end;

  if v_ota_id is null and v_prf_id is null and v_ent_id is null then
    return jsonb_build_object('ok', false, 'error', 'Identificador de pedido requerido.');
  end if;

  -- Resolver los tres vínculos posibles (orden taller, proforma y entrega)
  select *
    into v_orden
    from comun_comercio.com_orden_taller o
   where o.ota_negocio = v_negocio
     and (
       (v_ota_id is not null and o.ota_id = v_ota_id)
       or (v_prf_id is not null and o.ota_proforma_id = v_prf_id)
       or (v_ent_id is not null and o.ota_entrega_id = v_ent_id)
     )
   order by o.ota_creado_en desc
   limit 1;

  if v_orden.ota_id is not null then
    v_ota_id := v_orden.ota_id;
    v_prf_id := coalesce(v_prf_id, v_orden.ota_proforma_id);
    v_ent_id := coalesce(v_ent_id, v_orden.ota_entrega_id);
    v_codigo := v_orden.ota_codigo;
  end if;

  if v_prf_id is not null then
    select *
      into v_prf
      from comun_comercio.com_proforma p
     where p.prf_id = v_prf_id
       and lower(p.prf_negocio) = v_negocio
     limit 1;
    if v_prf.prf_id is not null then
      v_codigo := coalesce(v_codigo, v_prf.prf_detalle_proforma->>'codigo_orden', v_prf.prf_detalle_proforma->>'codigo_proforma');
    else
      v_prf_id := null;
    end if;
  end if;

  if v_ent_id is not null then
    select *
      into v_ent
      from comun_comercio.com_entrega_evidencia e
     where e.ent_id = v_ent_id
       and e.ent_negocio = v_negocio
     limit 1;
    if v_ent.ent_id is not null then
      v_codigo := coalesce(v_codigo, v_ent.ent_codigo_ot);
      v_prf_id := coalesce(v_prf_id, v_ent.ent_proforma_id);
      v_ota_id := coalesce(v_ota_id, v_ent.ent_orden_taller_id);
    else
      v_ent_id := null;
    end if;
  end if;

  if v_ota_id is null and v_prf_id is null and v_ent_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido especificado.');
  end if;

  if v_definitivo then
    -- Eliminación definitiva (solo SUPERADMIN / ADMINISTRADOR)
    delete from comun_comercio.com_entrega_evidencia e
     where e.ent_negocio = v_negocio
       and (
         (v_ent_id is not null and e.ent_id = v_ent_id)
         or (v_ota_id is not null and e.ent_orden_taller_id = v_ota_id)
         or (v_prf_id is not null and e.ent_proforma_id = v_prf_id)
       );

    delete from comun_comercio.com_orden_taller o
     where o.ota_negocio = v_negocio
       and (
         (v_ota_id is not null and o.ota_id = v_ota_id)
         or (v_prf_id is not null and o.ota_proforma_id = v_prf_id)
         or (v_ent_id is not null and o.ota_entrega_id = v_ent_id)
       );

    if v_prf_id is not null then
      delete from comun_comercio.com_proforma p
       where p.prf_id = v_prf_id
         and lower(p.prf_negocio) = v_negocio;
    end if;

    return jsonb_build_object(
      'ok', true,
      'modo', 'DEFINITIVO',
      'codigo', coalesce(v_codigo, 'PEDIDO')
    );
  end if;

  -- Borrado lógico (visible únicamente para el administrador en Papelera)
  if v_ota_id is not null then
    update comun_comercio.com_orden_taller
       set ota_eliminado_en = coalesce(ota_eliminado_en, now()),
           ota_eliminado_por = coalesce(ota_eliminado_por, v_uid),
           ota_eliminado_nombre = coalesce(ota_eliminado_nombre, v_usu_nombre),
           ota_eliminado_motivo = coalesce(v_motivo, ota_eliminado_motivo),
           ota_actualizado_en = now()
     where ota_negocio = v_negocio
       and (
         ota_id = v_ota_id
         or (v_prf_id is not null and ota_proforma_id = v_prf_id)
         or (v_ent_id is not null and ota_entrega_id = v_ent_id)
       );
  end if;

  if v_prf_id is not null then
    update comun_comercio.com_proforma
       set prf_eliminado_en = coalesce(prf_eliminado_en, now()),
           prf_estado = 'ANULADA',
           prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'eliminado_por_nombre', v_usu_nombre,
             'eliminado_motivo', v_motivo
           ),
           prf_actualizado_en = now()
     where prf_id = v_prf_id
       and lower(prf_negocio) = v_negocio;
  end if;

  if v_ent_id is not null or v_ota_id is not null or v_prf_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_eliminado_en = coalesce(ent_eliminado_en, now()),
           ent_estado = 'ANULADA',
           ent_actualizado_en = now()
     where ent_negocio = v_negocio
       and (
         (v_ent_id is not null and ent_id = v_ent_id)
         or (v_ota_id is not null and ent_orden_taller_id = v_ota_id)
         or (v_prf_id is not null and ent_proforma_id = v_prf_id)
       );
  end if;

  return jsonb_build_object(
    'ok', true,
    'modo', 'LOGICO',
    'codigo', coalesce(v_codigo, 'PEDIDO'),
    'eliminadoPorNombre', v_usu_nombre
  );
end;
$$;

grant execute on function comun_comercio.com_fn_eliminar_pedido_operativo(text, jsonb) to authenticated, service_role;

-- 4. RPC exclusivo de administrador para restaurar un pedido desde Papelera
create or replace function comun_comercio.com_fn_restaurar_pedido_eliminado(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_ota_id uuid;
  v_prf_id uuid;
  v_ent_id uuid;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR') then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo el administrador puede restaurar pedidos eliminados.'
    );
  end if;

  begin
    v_ota_id := nullif(btrim(coalesce(p_payload->>'ordenTallerId', '')), '')::uuid;
  exception when others then
    v_ota_id := null;
  end;

  begin
    v_prf_id := nullif(btrim(coalesce(p_payload->>'proformaId', '')), '')::uuid;
  exception when others then
    v_prf_id := null;
  end;

  begin
    v_ent_id := nullif(btrim(coalesce(p_payload->>'entregaId', '')), '')::uuid;
  exception when others then
    v_ent_id := null;
  end;

  if v_ota_id is not null then
    select coalesce(v_prf_id, ota_proforma_id), coalesce(v_ent_id, ota_entrega_id)
      into v_prf_id, v_ent_id
      from comun_comercio.com_orden_taller
     where ota_id = v_ota_id
       and ota_negocio = v_negocio;
  end if;

  update comun_comercio.com_orden_taller
     set ota_eliminado_en = null,
         ota_eliminado_por = null,
         ota_eliminado_nombre = null,
         ota_eliminado_motivo = null,
         ota_estado_taller = case when ota_estado_taller = 'ANULADO' then 'PENDIENTE_ENVIO' else ota_estado_taller end,
         ota_actualizado_en = now()
   where ota_negocio = v_negocio
     and (
       (v_ota_id is not null and ota_id = v_ota_id)
       or (v_prf_id is not null and ota_proforma_id = v_prf_id)
       or (v_ent_id is not null and ota_entrega_id = v_ent_id)
     );

  if v_prf_id is not null then
    update comun_comercio.com_proforma
       set prf_eliminado_en = null,
           prf_estado = case
             when prf_estado in ('ANULADA', 'ANULADO', 'CANCELADO') then 'PENDIENTE_PAGO'
             else prf_estado
           end,
           prf_actualizado_en = now()
     where prf_id = v_prf_id
       and lower(prf_negocio) = v_negocio;
  end if;

  update comun_comercio.com_entrega_evidencia
     set ent_eliminado_en = null,
         ent_estado = case
           when ent_estado = 'ANULADA' then
             case when nullif(btrim(coalesce(ent_foto_url, '')), '') is not null then 'ENTREGADA_PENDIENTE_INFORME' else 'PROGRAMADA' end
           else ent_estado
         end,
         ent_actualizado_en = now()
   where ent_negocio = v_negocio
     and (
       (v_ent_id is not null and ent_id = v_ent_id)
       or (v_ota_id is not null and ent_orden_taller_id = v_ota_id)
       or (v_prf_id is not null and ent_proforma_id = v_prf_id)
     );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function comun_comercio.com_fn_restaurar_pedido_eliminado(text, jsonb) to authenticated, service_role;

-- 5. Actualizar com_fn_obtener_consola_taller_y_despacho para incluir:
--    - esAdminEstricto (true SOLO para SUPERADMIN / ADMINISTRADOR)
--    - puedeEliminarLogico (true para SUPERADMIN / ADMINISTRADOR / OPERADOR / VENTAS)
--    - ordenesEliminadas (poblado SOLO si esAdminEstricto = true; '[]' para el resto)
create or replace function comun_comercio.com_fn_obtener_consola_taller_y_despacho(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_solo_taller boolean := (v_rol = 'TALLER');
  v_es_admin_estricto boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR'));
  v_puede_eliminar_logico boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS'));
  v_usu_nombre text;
  v_ordenes jsonb;
  v_ordenes_eliminadas jsonb := '[]'::jsonb;
  v_productos jsonb;
  v_repartidores jsonb := '[]'::jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder a Pedidos y Taller.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_ordenes
  from (
    select
      o.ota_id as "id",
      o.ota_codigo as "codigo",
      o.ota_origen_tipo as "origenTipo",
      coalesce(
        o.ota_clasificacion_pedido,
        comun_comercio.com_fn_inferir_clasificacion_pedido(
          null, o.ota_origen_tipo, o.ota_retiro_en_local, o.ota_sala_servicio, o.ota_producto_resumen, o.ota_ubicacion_entrega, o.ota_items
        )
      ) as "clasificacionPedido",
      o.ota_proforma_id as "proformaId",
      coalesce(o.ota_entrega_id, ev.ent_id) as "entregaId",
      o.ota_estado_taller as "estadoTaller",
      (case when v_es_solo_taller then 'VALIDADO'::text else coalesce(p.prf_estado, o.ota_estado_pago) end) as "estadoPago",
      (case when v_es_solo_taller then null::text else o.ota_metodo_pago end) as "metodoPago",
      o.ota_fecha_pedido as "fechaPedido",
      to_char(o.ota_fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
      (case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null::text end) as "fechaElaboracion",
      o.ota_franja_horaria as "franjaHoraria",
      coalesce(o.ota_hora_especifica, ev.ent_hora_solicitada) as "horaEspecifica",
      o.ota_producto_resumen as "productoResumen",
      coalesce(o.ota_items, '[]'::jsonb) as "items",
      coalesce(nullif(btrim(o.ota_cliente_solicita), ''), ev.ent_coordinador_nombre, 'Cliente'::text) as "clienteSolicita",
      (case when v_es_solo_taller then null::text else o.ota_cliente_telefono end) as "clienteTelefono",
      coalesce(nullif(btrim(o.ota_destinatario_fallecido), ''), ev.ent_fallecido_destinatario, ''::text) as "destinatarioFallecido",
      coalesce(o.ota_sala_servicio, ev.ent_sala_servicio) as "salaServicio",
      coalesce(nullif(btrim(o.ota_ubicacion_entrega), ''), ev.ent_ubicacion_nombre, ''::text) as "ubicacionEntrega",
      o.ota_enlace_mapa as "enlaceMapa",
      o.ota_retiro_en_local as "retiroEnLocal",
      o.ota_dedicatoria as "dedicatoria",
      o.ota_observaciones as "observaciones",
      (case when v_es_solo_taller then 0::numeric else o.ota_total_usd end) as "totalUsd",
      o.ota_enviado_taller_en as "enviadoTallerEn",
      o.ota_enviado_nombre as "enviadoNombre",
      o.ota_preparacion_en as "preparacionEn",
      o.ota_listo_en as "listoEn",
      coalesce(o.ota_entregado_en, case when ev.ent_estado not in ('PROGRAMADA', 'ANULADA') then ev.ent_capturado_en else null::timestamptz end) as "entregadoEn",
      o.ota_actualizado_taller_nombre as "actualizadoTallerNombre",
      o.ota_tarjeta_token as "tarjetaToken",
      coalesce(o.ota_tarjeta_tipo, 'DIPTICO'::text) as "tarjetaTipo",
      o.ota_tarjeta_musica_url as "tarjetaMusicaUrl",
      o.ota_tarjeta_musica_titulo as "tarjetaMusicaTitulo",
      coalesce(o.ota_tarjeta_lyrics, '[]'::jsonb) as "tarjetaLyrics",
      coalesce(o.ota_tarjeta_metadata, '{}'::jsonb) as "tarjetaMetadata",
      o.ota_repartidor_id as "repartidorId",
      o.ota_repartidor_nombre as "repartidorNombre",
      o.ota_repartidor_tipo as "repartidorTipo",
      coalesce(o.ota_en_ruta, false) as "enRuta",
      o.ota_en_ruta_desde as "enRutaDesde",
      o.ota_ruta_latitud as "rutaLatitud",
      o.ota_ruta_longitud as "rutaLongitud",
      o.ota_ruta_actualizada_en as "rutaActualizadaEn",
      coalesce(ev.ent_foto_url, o.ota_evidencia_foto_url, p.prf_detalle_proforma->>'entrega_foto_url') as "evidenciaFotoUrl",
      coalesce(ev.ent_mapa_url, o.ota_evidencia_mapa_url) as "evidenciaMapaUrl",
      coalesce(ev.ent_latitud, o.ota_evidencia_latitud) as "evidenciaLatitud",
      coalesce(ev.ent_longitud, o.ota_evidencia_longitud) as "evidenciaLongitud",
      coalesce(ev.ent_direccion_gps, o.ota_evidencia_direccion_gps) as "evidenciaDireccionGps",
      coalesce(nullif(btrim(ev.ent_entregador_nombre), 'Por asignar'), o.ota_entregado_por_nombre) as "entregadoPorNombre",
      ev.ent_estado as "estadoEvidencia",
      inf.ife_numero_informe as "numeroInforme"
    from comun_comercio.com_orden_taller o
    left join comun_comercio.com_proforma p on p.prf_id = o.ota_proforma_id
    left join lateral (
      select e.*
      from comun_comercio.com_entrega_evidencia e
      where e.ent_negocio = v_negocio
        and e.ent_eliminado_en is null
        and e.ent_estado <> 'ANULADA'
        and (
          e.ent_id = o.ota_entrega_id
          or e.ent_orden_taller_id = o.ota_id
          or (o.ota_proforma_id is not null and e.ent_proforma_id = o.ota_proforma_id)
        )
      order by
        (case when e.ent_foto_url is not null and btrim(e.ent_foto_url) <> '' then 0 else 1 end) asc,
        e.ent_actualizado_en desc
      limit 1
    ) ev on true
    left join comun_comercio.com_informe_entregas inf
      on inf.ife_id = ev.ent_informe_id
     and inf.ife_eliminado_en is null
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and (not v_es_solo_taller or o.ota_estado_taller <> 'PENDIENTE_ENVIO')
    order by
      (case when o.ota_estado_taller not in ('ENTREGADO', 'ANULADO') then 0 else 1 end) asc,
      o.ota_fecha_entrega desc,
      (case when o.ota_clasificacion_pedido = 'EXEQUIALES' or o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_creado_en desc
    limit 1500
  ) sub;

  -- SOLO el Administrador / Superadmin recibe pedidos con borrado lógico
  if v_es_admin_estricto then
    select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
    into v_ordenes_eliminadas
    from (
      select
        o.ota_id as "id",
        o.ota_codigo as "codigo",
        o.ota_origen_tipo as "origenTipo",
        coalesce(
          o.ota_clasificacion_pedido,
          comun_comercio.com_fn_inferir_clasificacion_pedido(
            null, o.ota_origen_tipo, o.ota_retiro_en_local, o.ota_sala_servicio, o.ota_producto_resumen, o.ota_ubicacion_entrega, o.ota_items
          )
        ) as "clasificacionPedido",
        o.ota_proforma_id as "proformaId",
        o.ota_entrega_id as "entregaId",
        o.ota_estado_taller as "estadoTaller",
        o.ota_estado_pago as "estadoPago",
        o.ota_metodo_pago as "metodoPago",
        o.ota_fecha_pedido as "fechaPedido",
        to_char(o.ota_fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
        (case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null::text end) as "fechaElaboracion",
        o.ota_franja_horaria as "franjaHoraria",
        o.ota_hora_especifica as "horaEspecifica",
        o.ota_producto_resumen as "productoResumen",
        coalesce(o.ota_items, '[]'::jsonb) as "items",
        coalesce(nullif(btrim(o.ota_cliente_solicita), ''), 'Cliente'::text) as "clienteSolicita",
        o.ota_cliente_telefono as "clienteTelefono",
        coalesce(o.ota_destinatario_fallecido, ''::text) as "destinatarioFallecido",
        o.ota_sala_servicio as "salaServicio",
        coalesce(o.ota_ubicacion_entrega, ''::text) as "ubicacionEntrega",
        o.ota_enlace_mapa as "enlaceMapa",
        o.ota_retiro_en_local as "retiroEnLocal",
        o.ota_dedicatoria as "dedicatoria",
        o.ota_observaciones as "observaciones",
        o.ota_total_usd as "totalUsd",
        o.ota_tarjeta_token as "tarjetaToken",
        coalesce(o.ota_tarjeta_tipo, 'DIPTICO'::text) as "tarjetaTipo",
        o.ota_eliminado_en as "eliminadoEn",
        coalesce(o.ota_eliminado_nombre, 'Staff') as "eliminadoPorNombre",
        o.ota_eliminado_motivo as "eliminadoMotivo"
      from comun_comercio.com_orden_taller o
      where o.ota_negocio = v_negocio
        and o.ota_eliminado_en is not null
      order by o.ota_eliminado_en desc
      limit 300
    ) sub;
  end if;

  if v_es_solo_taller then
    v_productos := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
    into v_productos
    from (
      select
        pr.pro_id as "productoId",
        pr.pro_nombre as "productoNombre",
        pr.pro_tipo as "tipoProducto",
        (upper(coalesce(pr.pro_tipo, '')) = 'RENTA' or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false)) as "esRenta",
        v.var_id as "varianteId",
        coalesce(v.var_sku, pr.pro_slug) as "sku",
        coalesce(v.var_nombre, 'Estándar'::text) as "varianteNombre",
        coalesce(v.var_precio, 0) as "pvp",
        coalesce(v.var_detalle_variante->>'portada_url', pr.pro_detalle_producto->>'portada_url') as "portadaUrl"
      from comun_comercio.com_producto pr
      join comun_comercio.com_variante v
        on v.var_producto_id = pr.pro_id
       and v.var_activo = true
       and v.var_eliminado_en is null
      where lower(pr.pro_negocio) = v_negocio
        and pr.pro_activo = true
        and pr.pro_eliminado_en is null
      order by pr.pro_nombre asc, v.var_orden asc
      limit 250
    ) sub;

    begin
      v_repartidores := comun_comercio.com_fn_listar_repartidores_negocio(v_negocio);
    exception when others then
      v_repartidores := '[]'::jsonb;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'rolOperativo', v_rol,
    'esAdminEstricto', v_es_admin_estricto,
    'puedeEliminarLogico', v_puede_eliminar_logico,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Operador'),
    'ordenes', v_ordenes,
    'ordenesEliminadas', v_ordenes_eliminadas,
    'productosCatalogo', v_productos,
    'repartidoresNegocio', v_repartidores
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_consola_taller_y_despacho(text) to authenticated, service_role;

notify pgrst, 'reload schema';
