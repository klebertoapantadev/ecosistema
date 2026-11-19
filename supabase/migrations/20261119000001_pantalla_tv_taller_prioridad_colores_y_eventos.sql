-- ==============================================================================
-- Migración: 20261119000001_pantalla_tv_taller_prioridad_colores_y_eventos.sql
-- Requerimientos: PLT-009 / TNK-005 / MRG — Pantalla Smart TV Taller & Showroom Eventos
-- Descripción:
--   1. Nuevas columnas en comun_comercio.com_orden_taller:
--      - ota_prioridad_orden (priorización manual del orden de elaboración #1, #2, #3...)
--      - ota_colores (colores de flores/envoltura solicitados para el taller)
--      - ota_extras (extras adicionales: chocolates, globos, peluches, vinos, etc.)
--   2. Habilitación de Realtime en comun_configuracion.cfg_negocio para control remoto
--      en vivo de la Smart TV (YouTube URL, distribución Izq/Der, Modo Taller/Eventos,
--      álbumes de Google Fotos).
--   3. Actualización de sincronización, consulta y edición de com_orden_taller para
--      proyectar prioridadOrden, colores y extras (usando to_jsonb(sub)).
--   4. RPCs SECURITY DEFINER:
--      - com_fn_reordenar_prioridad_taller(p_negocio, p_orden_ids)
--      - com_fn_obtener_config_tv_taller(p_negocio)
--      - com_fn_guardar_config_tv_taller(p_negocio, p_config)
--      - com_fn_obtener_tablero_tv_taller(p_negocio, p_token)
--      - com_fn_actualizar_estado_tv_kiosco(p_negocio, p_orden_id, p_nuevo_estado, p_token)
-- ==============================================================================

-- 1. Nuevas columnas en com_orden_taller (idempotente)
do $$
begin
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    alter table comun_comercio.com_orden_taller
      add column if not exists ota_prioridad_orden integer,
      add column if not exists ota_colores text,
      add column if not exists ota_extras text;

    create index if not exists idx_com_orden_taller_tv_prioridad
      on comun_comercio.com_orden_taller (ota_negocio, ota_fecha_entrega asc, ota_prioridad_orden asc nulls last, ota_creado_en asc)
      where ota_eliminado_en is null;
  end if;
end $$;

-- 2. Habilitar Realtime en comun_configuracion.cfg_negocio (idempotente)
do $$
begin
  if to_regclass('comun_configuracion.cfg_negocio') is not null then
    alter publication supabase_realtime add table comun_configuracion.cfg_negocio;
  end if;
exception when others then
  null;
end $$;

-- 3. Actualizar sincronizador de ventas para capturar colores y extras desde proformas/web/IA
create or replace function comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(p_negocio text default 'tinkay')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_prefijo text := case
    when v_negocio = 'tinkay' then 'TNK'
    when v_negocio = 'margaritas' then 'MRG'
    when v_negocio = 'fastfix' then 'FFH'
    else 'TRQ'
  end;
  r record;
  v_fecha_ent date;
  v_origen text;
  v_estado_inicial text;
  v_resumen text;
  v_dedicatoria text;
  v_colores text;
  v_extras text;
  v_retiro boolean;
  v_sala text;
  v_ubicacion text;
  v_clasificacion text;
  v_tiene_renta boolean;
  v_nueva_ota_id uuid;
begin
  for r in
    select p.*
    from comun_comercio.com_proforma p
    where lower(p.prf_negocio) = v_negocio
      and p.prf_eliminado_en is null
      and upper(coalesce(p.prf_estado, '')) not in ('CANCELADO', 'ANULADO', 'NO_ACEPTADA')
      and (
        coalesce(p.prf_detalle_proforma->>'tipo_origen', '') <> 'PROFORMA_EVENTO'
        or upper(coalesce(p.prf_estado, '')) in ('ORDEN_CONFIRMADA', 'RESERVADA_70', 'APROBADA', 'EN_PREPARACION', 'EN_PRODUCCION', 'EN_RUTA', 'ENTREGADO')
      )
      and not exists (
        select 1
        from comun_comercio.com_orden_taller o
        where o.ota_proforma_id = p.prf_id
          and o.ota_eliminado_en is null
      )
  loop
    begin
      v_fecha_ent := coalesce(
        nullif(btrim(coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'fecha_entrega',
          r.prf_detalle_proforma->'logistica_entrega'->>'fechaEntrega',
          r.prf_detalle_proforma->'evento'->>'fechaEvento',
          ''
        )), '')::date,
        (r.prf_creado_en at time zone 'America/Guayaquil')::date
      );
    exception when others then
      v_fecha_ent := (r.prf_creado_en at time zone 'America/Guayaquil')::date;
    end;

    v_origen := case
      when coalesce(r.prf_detalle_proforma->>'tipo_origen', '') = 'PROFORMA_EVENTO' then 'PROFORMA_EVENTO'
      else 'VENTA_TIENDA'
    end;

    v_estado_inicial := case
      when upper(coalesce(r.prf_estado, '')) = 'ENTREGADO' or coalesce((r.prf_detalle_proforma->>'entrega_confirmada')::boolean, false) then 'ENTREGADO'
      when upper(coalesce(r.prf_estado, '')) in ('EN_RUTA', 'EN_CAMINO') then 'LISTO_ENTREGA'
      when upper(coalesce(r.prf_estado, '')) in ('EN_PREPARACION', 'EN_PRODUCCION') then 'EN_PREPARACION'
      else 'PENDIENTE_ENVIO'
    end;

    select coalesce(
      string_agg(
        coalesce(it->>'cantidad', '1') || 'x ' || coalesce(it->>'producto_nombre', it->>'descripcion', it->>'nombre', 'Arreglo'),
        ' + '
      ),
      'Pedido floral'
    ),
    string_agg(
      case
        when coalesce(it->'dedicatoria'->>'mensaje', '') <> '' then
          'Para: ' || coalesce(it->'dedicatoria'->>'para', '-') || ' | De: ' || coalesce(it->'dedicatoria'->>'de', '-') || ' — "' || (it->'dedicatoria'->>'mensaje') || '"'
        else null
      end,
      ' || '
    ),
    nullif(btrim(coalesce(
      string_agg(nullif(btrim(coalesce(it->>'colores', it->>'color', it->'personalizacion'->>'colores', '')), ''), ', '),
      ''
    )), ''),
    nullif(btrim(coalesce(
      string_agg(nullif(btrim(coalesce(it->>'extras', it->'personalizacion'->>'extras', '')), ''), ', '),
      ''
    )), '')
    into v_resumen, v_dedicatoria, v_colores, v_extras
    from jsonb_array_elements(
      case when jsonb_typeof(r.prf_detalle_proforma->'items') = 'array' then r.prf_detalle_proforma->'items' else '[]'::jsonb end
    ) it;

    v_colores := coalesce(
      nullif(btrim(coalesce(
        r.prf_detalle_proforma->>'colores',
        r.prf_detalle_proforma->'logistica_entrega'->>'colores',
        r.prf_detalle_proforma->'evento'->>'colores',
        ''
      )), ''),
      v_colores
    );

    v_extras := coalesce(
      nullif(btrim(coalesce(
        r.prf_detalle_proforma->>'extras',
        r.prf_detalle_proforma->'logistica_entrega'->>'extras',
        ''
      )), ''),
      v_extras
    );

    select exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(r.prf_detalle_proforma->'items') = 'array' then r.prf_detalle_proforma->'items' else '[]'::jsonb end
      ) it
      join comun_comercio.com_producto pr
        on (it->>'producto_id' is not null and pr.pro_id::text = (it->>'producto_id'))
        or (it->>'productoId' is not null and pr.pro_id::text = (it->>'productoId'))
      where upper(coalesce(pr.pro_tipo, '')) = 'RENTA'
         or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false) = true
    ) into v_tiene_renta;

    v_retiro := coalesce((r.prf_detalle_proforma->'logistica_entrega'->>'retiro_en_local')::boolean, false);
    v_sala := nullif(btrim(coalesce(r.prf_detalle_proforma->'logistica_entrega'->>'sala_servicio', r.prf_detalle_proforma->>'sala_servicio', '')), '');
    v_ubicacion := coalesce(
      r.prf_detalle_proforma->'logistica_entrega'->>'direccion',
      r.prf_detalle_proforma->'ubicacion'->>'direccion',
      case when v_retiro then 'Retiro en Tienda' else '' end
    );

    v_clasificacion := comun_comercio.com_fn_inferir_clasificacion_pedido(
      coalesce(
        r.prf_detalle_proforma->>'clasificacion_pedido',
        case when v_tiene_renta then 'EVENTOS' else null end
      ),
      v_origen,
      v_retiro,
      v_sala,
      v_resumen,
      v_ubicacion,
      coalesce(r.prf_detalle_proforma->'items', '[]'::jsonb)
    );

    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_clasificacion_pedido,
      ota_proforma_id,
      ota_estado_taller,
      ota_estado_pago,
      ota_metodo_pago,
      ota_fecha_pedido,
      ota_fecha_entrega,
      ota_franja_horaria,
      ota_hora_especifica,
      ota_producto_resumen,
      ota_items,
      ota_colores,
      ota_extras,
      ota_cliente_solicita,
      ota_cliente_telefono,
      ota_destinatario_fallecido,
      ota_sala_servicio,
      ota_ubicacion_entrega,
      ota_enlace_mapa,
      ota_retiro_en_local,
      ota_dedicatoria,
      ota_tarjeta_token,
      ota_tarjeta_tipo,
      ota_observaciones,
      ota_total_usd
    ) values (
      v_negocio,
      coalesce(
        r.prf_detalle_proforma->>'codigo_orden',
        r.prf_detalle_proforma->>'codigo_proforma',
        v_prefijo || '-ORD-' || lpad(r.prf_secuencial::text, 4, '0')
      ),
      v_origen,
      v_clasificacion,
      r.prf_id,
      v_estado_inicial,
      coalesce(r.prf_estado, 'PENDIENTE_PAGO'),
      coalesce(r.prf_detalle_proforma->>'metodo_pago', 'web'),
      r.prf_creado_en,
      v_fecha_ent,
      comun_comercio.com_fn_normalizar_franja_horaria(
        coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'franja_horaria',
          r.prf_detalle_proforma->'logistica_entrega'->>'franjaHoraria',
          'A) 09:00 - 13:00'
        )
      ),
      nullif(btrim(coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'hora_exacta',
        r.prf_detalle_proforma->'evento'->>'horaEvento',
        ''
      )), ''),
      coalesce(v_resumen, 'Pedido floral'),
      coalesce(r.prf_detalle_proforma->'items', '[]'::jsonb),
      v_colores,
      v_extras,
      coalesce(
        r.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        r.prf_detalle_proforma->'comprador'->>'nombre',
        r.prf_cliente_contacto->>'nombre',
        'Cliente Tienda'
      ),
      coalesce(
        r.prf_detalle_proforma->'comprador'->>'whatsapp',
        r.prf_detalle_proforma->'comprador'->>'telefono',
        r.prf_cliente_contacto->>'telefono',
        ''
      ),
      coalesce(
        nullif(btrim(coalesce(
          r.prf_detalle_proforma->'logistica_entrega'->>'destinatario_nombre',
          r.prf_detalle_proforma->'logistica_entrega'->>'destinatarioNombre',
          ''
        )), ''),
        r.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        'Destinatario'
      ),
      v_sala,
      v_ubicacion,
      coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'enlace_mapa',
        r.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa'
      ),
      v_retiro,
      v_dedicatoria,
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      case when v_clasificacion in ('CONDOLENCIAS', 'EXEQUIALES') then 'CONDOLENCIAS_PLANA' else 'DIPTICO' end,
      nullif(btrim(coalesce(
        r.prf_detalle_proforma->'logistica_entrega'->>'notas',
        r.prf_detalle_proforma->'logistica_entrega'->>'referencia',
        r.prf_detalle_proforma->'evento'->>'notasEvento',
        r.prf_detalle_proforma->>'observaciones',
        ''
      )), ''),
      coalesce(r.prf_total, 0)
    )
    on conflict do nothing;
  end loop;

  -- Sincronizar OTs Exequiales previas registradas directamente en com_entrega_evidencia
  for r in
    select e.*
    from comun_comercio.com_entrega_evidencia e
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
      and e.ent_tipo_origen = 'ORDEN_TRABAJO_CONVENIO'
      and e.ent_estado <> 'ANULADA'
      and not exists (
        select 1
        from comun_comercio.com_orden_taller o
        where (o.ota_entrega_id = e.ent_id or e.ent_orden_taller_id = o.ota_id)
          and o.ota_eliminado_en is null
      )
  loop
    insert into comun_comercio.com_orden_taller (
      ota_negocio,
      ota_codigo,
      ota_origen_tipo,
      ota_clasificacion_pedido,
      ota_entrega_id,
      ota_estado_taller,
      ota_estado_pago,
      ota_metodo_pago,
      ota_fecha_pedido,
      ota_fecha_entrega,
      ota_fecha_elaboracion,
      ota_hora_especifica,
      ota_producto_resumen,
      ota_items,
      ota_cliente_solicita,
      ota_destinatario_fallecido,
      ota_sala_servicio,
      ota_ubicacion_entrega,
      ota_tarjeta_token,
      ota_tarjeta_tipo,
      ota_observaciones,
      ota_enviado_taller_en,
      ota_entregado_en,
      ota_entregado_por_nombre,
      ota_evidencia_foto_url,
      ota_evidencia_mapa_url,
      ota_evidencia_latitud,
      ota_evidencia_longitud,
      ota_evidencia_direccion_gps
    ) values (
      v_negocio,
      coalesce(r.ent_codigo_ot, 'OT-' || lpad(r.ent_secuencial::text, 4, '0')),
      'EXEQUIALES_LLAMADA',
      'EXEQUIALES',
      r.ent_id,
      case when r.ent_estado = 'PROGRAMADA' then 'ENVIADO_TALLER' else 'ENTREGADO' end,
      'CONVENIO_IESS',
      'convenio',
      r.ent_creado_en,
      (r.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      (r.ent_fecha_servicio at time zone 'America/Guayaquil')::date,
      coalesce(r.ent_hora_solicitada, to_char(r.ent_fecha_servicio at time zone 'America/Guayaquil', 'HH24:MI')),
      coalesce(r.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
      jsonb_build_array(jsonb_build_object(
        'descripcion', coalesce(r.ent_descripcion_servicio, 'Set condolencias (3 arreglos)'),
        'cantidad', 1
      )),
      coalesce(nullif(btrim(r.ent_coordinador_nombre), ''), r.ent_detalle_entrega->>'quien_solicita', 'Exequiales IESS'),
      coalesce(r.ent_fallecido_destinatario, ''),
      coalesce(r.ent_sala_servicio, r.ent_detalle_entrega->>'sala_servicio'),
      'Exequiales',
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
      'CONDOLENCIAS_PLANA',
      r.ent_observaciones,
      r.ent_creado_en,
      case when r.ent_estado <> 'PROGRAMADA' then r.ent_capturado_en else null end,
      r.ent_entregador_nombre,
      r.ent_foto_url,
      r.ent_mapa_url,
      r.ent_latitud,
      r.ent_longitud,
      r.ent_direccion_gps
    )
    on conflict do nothing
    returning ota_id into v_nueva_ota_id;

    if v_nueva_ota_id is not null then
      update comun_comercio.com_entrega_evidencia
         set ent_orden_taller_id = v_nueva_ota_id,
             ent_clasificacion_pedido = 'EXEQUIALES'
       where ent_id = r.ent_id;
    end if;
  end loop;
end;
$$;

grant execute on function comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(text) to authenticated, service_role;

-- 4. Actualizar com_fn_obtener_consola_taller_y_despacho para proyectar prioridadOrden, colores y extras
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
      o.ota_colores as "colores",
      o.ota_extras as "extras",
      o.ota_prioridad_orden as "prioridadOrden",
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
      coalesce(o.ota_prioridad_orden, 999999) asc,
      o.ota_fecha_entrega desc,
      (case when o.ota_clasificacion_pedido = 'EXEQUIALES' or o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_creado_en desc
    limit 1500
  ) sub;

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
        o.ota_colores as "colores",
        o.ota_extras as "extras",
        o.ota_prioridad_orden as "prioridadOrden",
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

-- 5. Actualizar com_fn_crear_o_actualizar_pedido_operador para persistir colores, extras y prioridadOrden
create or replace function comun_comercio.com_fn_crear_o_actualizar_pedido_operador(
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
  v_usu_nombre text;
  v_orden_id uuid;
  v_origen text;
  v_clasificacion text;
  v_es_exequiales boolean;
  v_enviar boolean;
  v_fecha_entrega date;
  v_fecha_elab date;
  v_hora text;
  v_franja text;
  v_sala text;
  v_solicita text;
  v_destinatario text;
  v_ubicacion text;
  v_retiro boolean;
  v_resumen text;
  v_items jsonb;
  v_colores text;
  v_extras text;
  v_prioridad integer;
  v_convenio_id uuid;
  v_entrega_id uuid;
  v_codigo text;
  v_fecha_serv_ts timestamptz;
  v_orden comun_comercio.com_orden_taller;
  v_tarjeta_tipo text;
  v_tarjeta_musica_url text;
  v_tarjeta_musica_titulo text;
  v_dedicatoria_nueva text;
  v_meta jsonb;
  v_historial jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar o programar pedidos.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_orden_id := nullif(btrim(coalesce(p_payload->>'ordenId', '')), '')::uuid;
  exception when others then
    v_orden_id := null;
  end;

  v_origen := case
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'EXEQUIALES_LLAMADA' then 'EXEQUIALES_LLAMADA'
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'VENTA_TIENDA' then 'VENTA_TIENDA'
    when upper(coalesce(p_payload->>'origenTipo', '')) = 'PROFORMA_EVENTO' then 'PROFORMA_EVENTO'
    else 'MANUAL_ADMIN'
  end;

  v_retiro := coalesce((p_payload->>'retiroEnLocal')::boolean, false);
  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', '')), '');
  v_solicita := coalesce(nullif(btrim(coalesce(p_payload->>'clienteSolicita', '')), ''), 'Cliente');
  v_resumen := coalesce(
    nullif(btrim(coalesce(p_payload->>'productoResumen', '')), ''),
    case when v_origen = 'EXEQUIALES_LLAMADA' then 'Set condolencias (3 arreglos)' else 'Arreglo floral' end
  );
  v_items := case
    when jsonb_typeof(p_payload->'items') = 'array' and jsonb_array_length(p_payload->'items') > 0 then p_payload->'items'
    else jsonb_build_array(jsonb_build_object('descripcion', v_resumen, 'cantidad', 1))
  end;
  v_colores := nullif(btrim(coalesce(p_payload->>'colores', '')), '');
  v_extras := nullif(btrim(coalesce(p_payload->>'extras', '')), '');
  begin
    v_prioridad := nullif(btrim(coalesce(p_payload->>'prioridadOrden', '')), '')::integer;
  exception when others then
    v_prioridad := null;
  end;

  v_ubicacion := coalesce(
    nullif(btrim(coalesce(p_payload->>'ubicacionEntrega', '')), ''),
    case
      when v_retiro then 'Retiro en Tienda'
      when v_origen = 'EXEQUIALES_LLAMADA' then 'Exequiales'
      else 'Por coordinar'
    end
  );

  v_clasificacion := comun_comercio.com_fn_inferir_clasificacion_pedido(
    p_payload->>'clasificacionPedido',
    v_origen,
    v_retiro,
    v_sala,
    v_resumen,
    v_ubicacion,
    v_items
  );

  v_es_exequiales := (v_clasificacion = 'EXEQUIALES');

  if v_es_exequiales then
    v_retiro := false;
    v_ubicacion := 'Exequiales';
  end if;

  v_destinatario := nullif(btrim(coalesce(p_payload->>'destinatarioFallecido', '')), '');

  if v_es_exequiales and (
    v_destinatario is null
    or lower(v_destinatario) in ('por coordinar', 'por confirmar', 'destinatario')
    or lower(v_destinatario) like 'por confirmar (%'
    or lower(v_destinatario) like 'por coordinar (%'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'En pedidos de Exequiales, el nombre de la Persona Fallecida (Destinatario) es obligatorio.'
    );
  end if;

  if v_destinatario is null then
    v_destinatario := v_solicita;
  end if;

  v_enviar := coalesce((p_payload->>'enviarATaller')::boolean, v_es_exequiales);

  begin
    v_fecha_entrega := coalesce(
      nullif(btrim(coalesce(p_payload->>'fechaEntrega', '')), '')::date,
      (now() at time zone 'America/Guayaquil')::date
    );
  exception when others then
    v_fecha_entrega := (now() at time zone 'America/Guayaquil')::date;
  end;

  begin
    v_fecha_elab := nullif(btrim(coalesce(p_payload->>'fechaElaboracion', '')), '')::date;
  exception when others then
    v_fecha_elab := null;
  end;

  if v_enviar and v_fecha_elab is null then
    v_fecha_elab := (now() at time zone 'America/Guayaquil')::date;
  end if;

  v_hora := nullif(btrim(coalesce(p_payload->>'horaEspecifica', '')), '');
  v_franja := case
    when nullif(btrim(coalesce(p_payload->>'franjaHoraria', '')), '') is not null
      then comun_comercio.com_fn_normalizar_franja_horaria(p_payload->>'franjaHoraria')
    when v_es_exequiales then null
    else 'A) 09:00 - 13:00'
  end;

  v_tarjeta_tipo := case
    when p_payload->>'tarjetaTipo' in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then p_payload->>'tarjetaTipo'
    when v_clasificacion in ('CONDOLENCIAS', 'EXEQUIALES') then 'CONDOLENCIAS_PLANA'
    else 'DIPTICO'
  end;

  v_tarjeta_musica_url := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaUrl', '')), '')
  end;
  v_tarjeta_musica_titulo := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaTitulo', '')), '')
  end;
  v_dedicatoria_nueva := case
    when v_es_exequiales then null
    else nullif(btrim(coalesce(p_payload->>'dedicatoria', '')), '')
  end;

  -- Edición de una orden existente
  if v_orden_id is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller
     where ota_id = v_orden_id and ota_negocio = v_negocio;

    if v_orden.ota_id is null then
      return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido para actualizar.');
    end if;

    v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);

    if not v_es_exequiales and v_dedicatoria_nueva is distinct from v_orden.ota_dedicatoria then
      v_historial := coalesce(v_meta->'historial_cambios', '[]'::jsonb);
      v_historial := v_historial || jsonb_build_array(jsonb_build_object(
        'autor', v_usu_nombre,
        'rol', 'STAFF_FLORISTERIA',
        'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'dedicatoria_anterior', v_orden.ota_dedicatoria,
        'dedicatoria_nueva', v_dedicatoria_nueva
      ));
      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_historial, true);
    end if;

    update comun_comercio.com_orden_taller
       set ota_clasificacion_pedido = v_clasificacion,
           ota_fecha_entrega = v_fecha_entrega,
           ota_fecha_elaboracion = coalesce(v_fecha_elab, ota_fecha_elaboracion),
           ota_franja_horaria = case
             when p_payload ? 'franjaHoraria' then v_franja
             else coalesce(v_franja, ota_franja_horaria)
           end,
           ota_hora_especifica = case
             when p_payload ? 'horaEspecifica' then v_hora
             else ota_hora_especifica
           end,
           ota_producto_resumen = v_resumen,
           ota_items = v_items,
           ota_colores = case when p_payload ? 'colores' then v_colores else ota_colores end,
           ota_extras = case when p_payload ? 'extras' then v_extras else ota_extras end,
           ota_prioridad_orden = case when p_payload ? 'prioridadOrden' then v_prioridad else ota_prioridad_orden end,
           ota_cliente_solicita = v_solicita,
           ota_cliente_telefono = case
             when v_es_exequiales then null
             when p_payload ? 'clienteTelefono' then nullif(btrim(p_payload->>'clienteTelefono'), '')
             else ota_cliente_telefono
           end,
           ota_destinatario_fallecido = v_destinatario,
           ota_sala_servicio = case
             when not v_es_exequiales then null
             when p_payload ? 'salaServicio' then v_sala
             else ota_sala_servicio
           end,
           ota_ubicacion_entrega = case
             when v_es_exequiales then 'Exequiales'
             when p_payload ? 'ubicacionEntrega' then coalesce(nullif(btrim(p_payload->>'ubicacionEntrega'), ''), ota_ubicacion_entrega)
             else ota_ubicacion_entrega
           end,
           ota_enlace_mapa = case
             when v_es_exequiales then null
             when p_payload ? 'enlaceMapa' then nullif(btrim(p_payload->>'enlaceMapa'), '')
             else ota_enlace_mapa
           end,
           ota_retiro_en_local = case
             when v_es_exequiales then false
             when p_payload ? 'retiroEnLocal' then v_retiro
             else ota_retiro_en_local
           end,
           ota_dedicatoria = case
             when v_es_exequiales then null
             when p_payload ? 'dedicatoria' then v_dedicatoria_nueva
             else ota_dedicatoria
           end,
           ota_tarjeta_tipo = coalesce(v_tarjeta_tipo, ota_tarjeta_tipo),
           ota_tarjeta_musica_url = case when v_es_exequiales then null else coalesce(v_tarjeta_musica_url, ota_tarjeta_musica_url) end,
           ota_tarjeta_musica_titulo = case when v_es_exequiales then null else coalesce(v_tarjeta_musica_titulo, ota_tarjeta_musica_titulo) end,
           ota_tarjeta_metadata = v_meta,
           ota_observaciones = case when p_payload ? 'observaciones' then nullif(btrim(p_payload->>'observaciones'), '') else ota_observaciones end,
           ota_estado_taller = case
             when v_enviar and ota_estado_taller = 'PENDIENTE_ENVIO' then 'ENVIADO_TALLER'
             else ota_estado_taller
           end,
           ota_enviado_taller_en = case
             when v_enviar and ota_enviado_taller_en is null then now()
             else ota_enviado_taller_en
           end,
           ota_enviado_por = case when v_enviar then coalesce(ota_enviado_por, v_uid) else ota_enviado_por end,
           ota_enviado_nombre = case when v_enviar then coalesce(ota_enviado_nombre, v_usu_nombre) else ota_enviado_nombre end,
           ota_actualizado_en = now()
     where ota_id = v_orden_id
       and ota_negocio = v_negocio
     returning * into v_orden;

    if v_orden.ota_entrega_id is not null then
      update comun_comercio.com_entrega_evidencia
         set ent_fallecido_destinatario = v_orden.ota_destinatario_fallecido,
             ent_descripcion_servicio = v_orden.ota_producto_resumen,
             ent_sala_servicio = v_orden.ota_sala_servicio,
             ent_coordinador_nombre = v_orden.ota_cliente_solicita,
             ent_hora_solicitada = coalesce(v_orden.ota_hora_especifica, v_orden.ota_franja_horaria),
             ent_ubicacion_nombre = v_orden.ota_ubicacion_entrega,
             ent_clasificacion_pedido = v_orden.ota_clasificacion_pedido,
             ent_actualizado_en = now()
       where ent_id = v_orden.ota_entrega_id;
    end if;

    if v_orden.ota_proforma_id is not null then
      update comun_comercio.com_proforma
         set prf_detalle_proforma = jsonb_set(
               jsonb_set(
                 coalesce(prf_detalle_proforma, '{}'::jsonb)
                   || jsonb_strip_nulls(jsonb_build_object('colores', v_orden.ota_colores, 'extras', v_orden.ota_extras)),
                 '{clasificacion_pedido}',
                 to_jsonb(v_orden.ota_clasificacion_pedido),
                 true
               ),
               '{logistica_entrega}',
               (coalesce(prf_detalle_proforma->'logistica_entrega', '{}'::jsonb) - 'hora_exacta') || jsonb_build_object(
                 'fecha_entrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
                 'franja_horaria', coalesce(v_orden.ota_franja_horaria, ''),
                 'hora_exacta', v_orden.ota_hora_especifica,
                 'direccion', coalesce(v_orden.ota_ubicacion_entrega, ''),
                 'enlace_mapa', coalesce(v_orden.ota_enlace_mapa, ''),
                 'retiro_en_local', v_orden.ota_retiro_en_local,
                 'destinatario_nombre', v_orden.ota_destinatario_fallecido,
                 'sala_servicio', v_orden.ota_sala_servicio
               ),
               true
             ),
             prf_actualizado_en = now()
       where prf_id = v_orden.ota_proforma_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'ordenId', v_orden.ota_id,
      'codigo', v_orden.ota_codigo,
      'clasificacionPedido', v_orden.ota_clasificacion_pedido,
      'estadoTaller', v_orden.ota_estado_taller,
      'tarjetaToken', v_orden.ota_tarjeta_token
    );
  end if;

  -- Creación de orden nueva
  if v_es_exequiales or v_origen = 'EXEQUIALES_LLAMADA' then
    select cve_id into v_convenio_id
    from comun_comercio.com_convenio_entrega
    where cve_negocio = v_negocio and cve_eliminado_en is null
    order by cve_secuencial asc
    limit 1;

    begin
      if v_hora is not null and v_hora ~ '^\d{1,2}:\d{2}' then
        v_fecha_serv_ts := ((v_fecha_entrega::text || ' ' || substring(v_hora from '^\d{1,2}:\d{2}') || ':00')::timestamp at time zone 'America/Guayaquil');
      else
        v_fecha_serv_ts := ((v_fecha_entrega::text || ' 12:00:00')::timestamp at time zone 'America/Guayaquil');
      end if;
    exception when others then
      v_fecha_serv_ts := now();
    end;

    insert into comun_comercio.com_entrega_evidencia (
      ent_uuid_cliente,
      ent_negocio,
      ent_tipo_origen,
      ent_clasificacion_pedido,
      ent_convenio_id,
      ent_entregador_nombre,
      ent_fallecido_destinatario,
      ent_fecha_servicio,
      ent_capturado_en,
      ent_descripcion_servicio,
      ent_sala_servicio,
      ent_hora_solicitada,
      ent_ubicacion_nombre,
      ent_coordinador_nombre,
      ent_recursos_utilizados,
      ent_observaciones,
      ent_detalle_entrega,
      ent_estado
    ) values (
      gen_random_uuid(),
      v_negocio,
      'ORDEN_TRABAJO_CONVENIO',
      'EXEQUIALES',
      v_convenio_id,
      'Por asignar',
      v_destinatario,
      v_fecha_serv_ts,
      now(),
      v_resumen,
      v_sala,
      coalesce(v_hora, v_franja),
      'Exequiales',
      v_solicita,
      'Flores, follaje, bases y oasis',
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      jsonb_strip_nulls(jsonb_build_object(
        'sala_servicio', v_sala,
        'hora_solicitada', coalesce(v_hora, v_franja),
        'quien_solicita', v_solicita,
        'clasificacion_pedido', 'EXEQUIALES',
        'colores', v_colores,
        'extras', v_extras
      )),
      'PROGRAMADA'
    )
    returning ent_id, coalesce(ent_codigo_ot, 'OT-' || lpad(ent_secuencial::text, 4, '0'))
    into v_entrega_id, v_codigo;

    update comun_comercio.com_entrega_evidencia
       set ent_codigo_ot = v_codigo
     where ent_id = v_entrega_id
       and ent_codigo_ot is null;
  else
    v_codigo := 'PED-' || to_char(v_fecha_entrega, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  end if;

  v_meta := jsonb_build_object(
    'origen', case when v_origen = 'MANUAL_ADMIN' then 'OPERADOR_FLORISTERIA' else 'AUTOMATICO_SISTEMA' end,
    'creado_por', v_usu_nombre,
    'historial_cambios', case
      when v_es_exequiales then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object(
        'autor', v_usu_nombre,
        'rol', 'CREADOR',
        'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'dedicatoria', v_dedicatoria_nueva
      ))
    end,
    'vistas_cliente', 0,
    'impresiones', 0
  );

  insert into comun_comercio.com_orden_taller (
    ota_negocio,
    ota_codigo,
    ota_origen_tipo,
    ota_clasificacion_pedido,
    ota_entrega_id,
    ota_estado_taller,
    ota_estado_pago,
    ota_metodo_pago,
    ota_fecha_entrega,
    ota_fecha_elaboracion,
    ota_franja_horaria,
    ota_hora_especifica,
    ota_producto_resumen,
    ota_items,
    ota_colores,
    ota_extras,
    ota_prioridad_orden,
    ota_cliente_solicita,
    ota_cliente_telefono,
    ota_destinatario_fallecido,
    ota_sala_servicio,
    ota_ubicacion_entrega,
    ota_enlace_mapa,
    ota_retiro_en_local,
    ota_dedicatoria,
    ota_tarjeta_token,
    ota_tarjeta_tipo,
    ota_tarjeta_musica_url,
    ota_tarjeta_musica_titulo,
    ota_tarjeta_metadata,
    ota_observaciones,
    ota_total_usd,
    ota_enviado_taller_en,
    ota_enviado_por,
    ota_enviado_nombre
  ) values (
    v_negocio,
    v_codigo,
    case when v_es_exequiales then 'EXEQUIALES_LLAMADA' else v_origen end,
    v_clasificacion,
    v_entrega_id,
    case when v_enviar then 'ENVIADO_TALLER' else 'PENDIENTE_ENVIO' end,
    coalesce(nullif(btrim(p_payload->>'estadoPago'), ''), case when v_es_exequiales then 'CONVENIO_IESS' else 'PENDIENTE_PAGO' end),
    coalesce(nullif(btrim(p_payload->>'metodoPago'), ''), case when v_es_exequiales then 'convenio' else 'manual' end),
    v_fecha_entrega,
    v_fecha_elab,
    v_franja,
    v_hora,
    v_resumen,
    v_items,
    v_colores,
    v_extras,
    v_prioridad,
    v_solicita,
    case when v_es_exequiales then null else nullif(btrim(p_payload->>'clienteTelefono'), '') end,
    v_destinatario,
    case when v_es_exequiales then v_sala else null end,
    v_ubicacion,
    case when v_es_exequiales then null else nullif(btrim(p_payload->>'enlaceMapa'), '') end,
    v_retiro,
    v_dedicatoria_nueva,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
    v_tarjeta_tipo,
    v_tarjeta_musica_url,
    v_tarjeta_musica_titulo,
    v_meta,
    nullif(btrim(p_payload->>'observaciones'), ''),
    coalesce((p_payload->>'totalUsd')::numeric, 0),
    case when v_enviar then now() else null end,
    case when v_enviar then v_uid else null end,
    case when v_enviar then v_usu_nombre else null end
  ) returning * into v_orden;

  if v_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_orden_taller_id = v_orden.ota_id
     where ent_id = v_entrega_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'entregaId', v_entrega_id,
    'clasificacionPedido', v_orden.ota_clasificacion_pedido,
    'estadoTaller', v_orden.ota_estado_taller,
    'tarjetaToken', v_orden.ota_tarjeta_token
  );
end;
$$;

grant execute on function comun_comercio.com_fn_crear_o_actualizar_pedido_operador(text, jsonb) to authenticated, service_role;

-- 6. RPC transaccional para priorizar/reordenar el orden de elaboración en taller (#1, #2, #3...)
create or replace function comun_comercio.com_fn_reordenar_prioridad_taller(
  p_negocio text,
  p_orden_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_idx int := 1;
  v_id uuid;
  v_actualizados int := 0;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para priorizar pedidos de taller.');
  end if;

  if p_orden_ids is null or array_length(p_orden_ids, 1) is null then
    return jsonb_build_object('ok', true, 'actualizados', 0);
  end if;

  foreach v_id in array p_orden_ids loop
    update comun_comercio.com_orden_taller
       set ota_prioridad_orden = v_idx,
           ota_actualizado_en = now()
     where ota_id = v_id
       and ota_negocio = v_negocio
       and ota_eliminado_en is null;
    if found then
      v_actualizados := v_actualizados + 1;
    end if;
    v_idx := v_idx + 1;
  end loop;

  return jsonb_build_object('ok', true, 'actualizados', v_actualizados);
end;
$$;

grant execute on function comun_comercio.com_fn_reordenar_prioridad_taller(text, uuid[]) to authenticated, service_role;

-- 7. RPC para leer configuración de Pantalla TV Taller & Showroom Eventos (Staff autenticado)
create or replace function comun_comercio.com_fn_obtener_config_tv_taller(p_negocio text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_cfg jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para consultar la configuración de TV.');
  end if;

  select coalesce(c.cfg_detalle_configuracion->'pantalla_tv_taller', '{}'::jsonb)
    into v_cfg
    from comun_configuracion.cfg_negocio c
   where lower(c.cfg_negocio) = v_negocio
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'config', coalesce(v_cfg, '{}'::jsonb)
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_config_tv_taller(text) to authenticated, service_role;

-- 8. RPC para guardar configuración remota de Pantalla TV Taller & Showroom Eventos
create or replace function comun_comercio.com_fn_guardar_config_tv_taller(
  p_negocio text,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_cfg_id uuid;
  v_det_previo jsonb;
  v_tv_previo jsonb;
  v_tv_nuevo jsonb;
  v_token text;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para configurar la Pantalla TV.');
  end if;

  select c.cfg_id, coalesce(c.cfg_detalle_configuracion, '{}'::jsonb)
    into v_cfg_id, v_det_previo
    from comun_configuracion.cfg_negocio c
   where lower(c.cfg_negocio) = v_negocio
   limit 1;

  v_tv_previo := coalesce(v_det_previo->'pantalla_tv_taller', '{}'::jsonb);
  v_token := nullif(btrim(coalesce(p_config->>'tokenKiosco', v_tv_previo->>'tokenKiosco', '')), '');
  if v_token is null or coalesce((p_config->>'regenerarToken')::boolean, false) then
    v_token := substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 24);
  end if;

  v_tv_nuevo := (v_tv_previo || coalesce(p_config, '{}'::jsonb) - 'regenerarToken')
    || jsonb_build_object(
      'tokenKiosco', v_token,
      'actualizadoEn', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );

  if v_cfg_id is not null then
    update comun_configuracion.cfg_negocio
       set cfg_detalle_configuracion = jsonb_set(
             coalesce(cfg_detalle_configuracion, '{}'::jsonb),
             '{pantalla_tv_taller}',
             v_tv_nuevo,
             true
           ),
           cfg_actualizado_en = now()
     where cfg_id = v_cfg_id;
  else
    insert into comun_configuracion.cfg_negocio (
      cfg_negocio,
      cfg_detalle_configuracion
    ) values (
      v_negocio,
      jsonb_build_object('pantalla_tv_taller', v_tv_nuevo)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'config', v_tv_nuevo
  );
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_config_tv_taller(text, jsonb) to authenticated, service_role;

-- 9. RPC integral para la Smart TV (acepta sesión autenticada O token Kiosco revocable)
--    Devuelve SOLO datos operativos mínimos de pantalla (sin teléfonos, sin montos) + productos de eventos.
create or replace function comun_comercio.com_fn_obtener_tablero_tv_taller(
  p_negocio text,
  p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := case when v_uid is not null then comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio) else '' end;
  v_autenticado boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER'));
  v_cfg_tv jsonb := '{}'::jsonb;
  v_token_guardado text;
  v_kiosco_activo boolean;
  v_kiosco_valido boolean := false;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_ordenes jsonb := '[]'::jsonb;
  v_productos_eventos jsonb := '[]'::jsonb;
begin
  select coalesce(c.cfg_detalle_configuracion->'pantalla_tv_taller', '{}'::jsonb)
    into v_cfg_tv
    from comun_configuracion.cfg_negocio c
   where lower(c.cfg_negocio) = v_negocio
   limit 1;

  v_token_guardado := nullif(btrim(coalesce(v_cfg_tv->>'tokenKiosco', '')), '');
  v_kiosco_activo := coalesce((v_cfg_tv->>'kioscoActivo')::boolean, true);

  if not v_autenticado then
    if v_kiosco_activo and v_token_guardado is not null and nullif(btrim(coalesce(p_token, '')), '') = v_token_guardado then
      v_kiosco_valido := true;
    else
      return jsonb_build_object(
        'ok', false,
        'error', 'Acceso no autorizado a Pantalla TV. Inicia sesión o usa un enlace Kiosco válido.'
      );
    end if;
  end if;

  if v_autenticado then
    perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);
  end if;

  -- Órdenes activas de hoy/atrasadas en taller + listas y entregadas de hoy
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
      o.ota_estado_taller as "estadoTaller",
      to_char(o.ota_fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
      (case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null::text end) as "fechaElaboracion",
      o.ota_franja_horaria as "franjaHoraria",
      o.ota_hora_especifica as "horaEspecifica",
      o.ota_producto_resumen as "productoResumen",
      o.ota_colores as "colores",
      o.ota_extras as "extras",
      o.ota_observaciones as "observaciones",
      o.ota_sala_servicio as "salaServicio",
      o.ota_retiro_en_local as "retiroEnLocal",
      o.ota_prioridad_orden as "prioridadOrden",
      o.ota_enviado_taller_en as "enviadoTallerEn",
      o.ota_preparacion_en as "preparacionEn",
      o.ota_listo_en as "listoEn",
      o.ota_entregado_en as "entregadoEn"
    from comun_comercio.com_orden_taller o
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and o.ota_estado_taller in ('ENVIADO_TALLER', 'EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')
      and (
        -- Pendientes de taller: hoy, atrasados o con fecha de elaboración hoy
        (
          o.ota_estado_taller in ('ENVIADO_TALLER', 'EN_PREPARACION')
          and (
            o.ota_fecha_entrega <= v_hoy
            or o.ota_fecha_elaboracion = v_hoy
          )
        )
        or (
          -- Listos y entregados: solo los del día de hoy (o entregados/listos hoy)
          o.ota_estado_taller in ('LISTO_ENTREGA', 'ENTREGADO')
          and (
            o.ota_fecha_entrega = v_hoy
            or o.ota_fecha_elaboracion = v_hoy
            or (o.ota_listo_en is not null and (o.ota_listo_en at time zone 'America/Guayaquil')::date = v_hoy)
            or (o.ota_entregado_en is not null and (o.ota_entregado_en at time zone 'America/Guayaquil')::date = v_hoy)
          )
        )
      )
    order by
      coalesce(o.ota_prioridad_orden, 999999) asc,
      (case when o.ota_clasificacion_pedido = 'EXEQUIALES' or o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_fecha_entrega asc,
      o.ota_creado_en asc
    limit 200
  ) sub;

  -- Productos de Eventos / Renta / Ceremonias para el Modo Showroom Eventos
  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_productos_eventos
  from (
    select
      pr.pro_id as "productoId",
      pr.pro_nombre as "nombre",
      coalesce(pr.pro_descripcion_corta, pr.pro_descripcion, ''::text) as "descripcion",
      pr.pro_slug as "slug",
      pr.pro_tipo as "tipo",
      coalesce(
        pr.pro_detalle_producto->>'portada_url',
        (select v2.var_detalle_variante->>'portada_url'
           from comun_comercio.com_variante v2
          where v2.var_producto_id = pr.pro_id and v2.var_activo = true and v2.var_eliminado_en is null
          order by v2.var_orden asc limit 1),
        ''::text
      ) as "imagenUrl",
      coalesce(
        (select min(v3.var_precio)
           from comun_comercio.com_variante v3
          where v3.var_producto_id = pr.pro_id and v3.var_activo = true and v3.var_eliminado_en is null),
        0::numeric
      ) as "precioDesde",
      coalesce(cat.cat_nombre, 'Eventos'::text) as "categoriaNombre"
    from comun_comercio.com_producto pr
    left join comun_comercio.com_categoria cat on cat.cat_id = pr.pro_categoria_id
    where lower(pr.pro_negocio) = v_negocio
      and pr.pro_activo = true
      and pr.pro_eliminado_en is null
      and (
        upper(coalesce(pr.pro_tipo, '')) = 'RENTA'
        or coalesce((pr.pro_detalle_producto->>'es_renta')::boolean, false) = true
        or lower(coalesce(cat.cat_nombre, '')) like '%evento%'
        or lower(coalesce(cat.cat_nombre, '')) like '%boda%'
        or lower(coalesce(cat.cat_nombre, '')) like '%matrimon%'
        or lower(coalesce(cat.cat_nombre, '')) like '%decorac%'
        or lower(coalesce(cat.cat_nombre, '')) like '%mobiliario%'
        or lower(coalesce(cat.cat_nombre, '')) like '%ceremonia%'
        or lower(coalesce(cat.cat_slug, '')) like '%evento%'
        or lower(coalesce(pr.pro_nombre, '')) like '%evento%'
        or lower(coalesce(pr.pro_nombre, '')) like '%boda%'
        or lower(coalesce(pr.pro_nombre, '')) like '%arco%'
        or lower(coalesce(pr.pro_nombre, '')) like '%mesa%'
        or lower(coalesce(pr.pro_nombre, '')) like '%backing%'
      )
    order by pr.pro_destacado desc nulls last, pr.pro_nombre asc
    limit 80
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'modoAcceso', case when v_autenticado then 'AUTENTICADO' else 'KIOSCO' end,
    'puedeInteractuar', (v_autenticado or coalesce((v_cfg_tv->>'permitirCambiarEstadoKiosco')::boolean, true)),
    'hoyYmd', to_char(v_hoy, 'YYYY-MM-DD'),
    'ordenes', v_ordenes,
    'productosEventos', v_productos_eventos,
    'configTv', case when v_autenticado then v_cfg_tv else (v_cfg_tv - 'tokenKiosco') end
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tablero_tv_taller(text, text) to anon, authenticated, service_role;

-- 10. RPC para avanzar estado desde la Smart TV (con sesión o con token Kiosco permitido)
create or replace function comun_comercio.com_fn_actualizar_estado_tv_kiosco(
  p_negocio text,
  p_orden_id uuid,
  p_nuevo_estado text,
  p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := case when v_uid is not null then comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio) else '' end;
  v_autenticado boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER'));
  v_cfg_tv jsonb := '{}'::jsonb;
  v_token_guardado text;
  v_kiosco_activo boolean;
  v_kiosco_interactivo boolean;
  v_estado text := upper(btrim(coalesce(p_nuevo_estado, '')));
  v_actor text := 'Pantalla TV Taller';
  v_orden comun_comercio.com_orden_taller;
begin
  if v_estado not in ('EN_PREPARACION', 'LISTO_ENTREGA') then
    return jsonb_build_object('ok', false, 'error', 'Desde la Pantalla TV solo se permite pasar a En Preparación o Listo para Entrega.');
  end if;

  if v_autenticado then
    select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Taller TV')
      into v_actor
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_uid;
  else
    select coalesce(c.cfg_detalle_configuracion->'pantalla_tv_taller', '{}'::jsonb)
      into v_cfg_tv
      from comun_configuracion.cfg_negocio c
     where lower(c.cfg_negocio) = v_negocio
     limit 1;

    v_token_guardado := nullif(btrim(coalesce(v_cfg_tv->>'tokenKiosco', '')), '');
    v_kiosco_activo := coalesce((v_cfg_tv->>'kioscoActivo')::boolean, true);
    v_kiosco_interactivo := coalesce((v_cfg_tv->>'permitirCambiarEstadoKiosco')::boolean, true);

    if not (v_kiosco_activo and v_kiosco_interactivo and v_token_guardado is not null and nullif(btrim(coalesce(p_token, '')), '') = v_token_guardado) then
      return jsonb_build_object('ok', false, 'error', 'Esta Pantalla TV está en modo solo lectura o el enlace Kiosco no es válido.');
    end if;
  end if;

  update comun_comercio.com_orden_taller
     set ota_estado_taller = v_estado,
         ota_preparacion_en = case when v_estado = 'EN_PREPARACION' then coalesce(ota_preparacion_en, now()) else ota_preparacion_en end,
         ota_listo_en = case when v_estado = 'LISTO_ENTREGA' then coalesce(ota_listo_en, now()) else ota_listo_en end,
         ota_actualizado_taller_nombre = v_actor,
         ota_actualizado_en = now()
   where ota_id = p_orden_id
     and ota_negocio = v_negocio
     and ota_eliminado_en is null
   returning * into v_orden;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido en taller.');
  end if;

  if v_orden.ota_proforma_id is not null and v_estado = 'EN_PREPARACION' then
    update comun_comercio.com_proforma
       set prf_estado = case when prf_estado in ('ORDEN_CONFIRMADA', 'APROBADA', 'PENDIENTE_PAGO') then 'EN_PREPARACION' else prf_estado end,
           prf_actualizado_en = now()
     where prf_id = v_orden.ota_proforma_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'estadoTaller', v_orden.ota_estado_taller
  );
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_estado_tv_kiosco(text, uuid, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
