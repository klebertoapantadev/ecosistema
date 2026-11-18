-- =============================================================================
-- Migración: Refactorizar serialización JSONB con to_jsonb(registro) en lugar
--            de jsonb_build_object(...) con >100 argumentos posicionales
-- Fecha: 2026-11-18
-- Contexto:
--   PostgreSQL compila internamente con FUNC_MAX_ARGS = 100. La función nativa
--   jsonb_build_object('k1', v1, 'k2', v2, ...) recibe cada clave y cada valor
--   como un argumento separado (54 propiedades = 108 argumentos), disparando en
--   tiempo de ejecución: "cannot pass more than 100 arguments to a function".
--   Al proyectar una fila tipada con alias camelCase ("id", "codigo", ...) y
--   convertir el registro completo mediante to_jsonb(sub), PostgreSQL recibe
--   1 único objeto compuesto sin límite de 100 argumentos.
-- =============================================================================

-- 1. Consola integral de Envío de Pedidos, Calendario y Taller (1 argumento record -> to_jsonb)
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
  v_usu_nombre text;
  v_ordenes jsonb;
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
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Operador'),
    'ordenes', v_ordenes,
    'productosCatalogo', v_productos,
    'repartidoresNegocio', v_repartidores
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_consola_taller_y_despacho(text) to authenticated, service_role;

-- 2. Tablero de Entregas GPS + Convenio IESS también estandarizado con to_jsonb(sub) (evita acercarse a 100 argumentos)
create or replace function comun_comercio.com_fn_obtener_tablero_entregas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_admin boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR'));
  v_es_subcontratado boolean := (v_rol = 'DELIVERY_EXTERNO');
  v_es_delivery_interno boolean := (v_rol = 'DELIVERY');
  v_usu_nombre text;
  v_convenios jsonb;
  v_entregas jsonb;
  v_informes jsonb;
  v_pedidos_pendientes jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'DELIVERY', 'DELIVERY_EXTERNO') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder al módulo de entregas.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Colaborador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_convenios
  from (
    select
      c.cve_id as "id",
      c.cve_codigo as "codigo",
      c.cve_nombre as "nombre",
      c.cve_prefijo_informe as "prefijoInforme",
      c.cve_siguiente_numero as "siguienteNumero",
      (case when v_es_admin then c.cve_datos_proveedor else '{}'::jsonb end) as "datosProveedor"
    from comun_comercio.com_convenio_entrega c
    where c.cve_negocio = v_negocio
      and c.cve_activo = true
      and c.cve_eliminado_en is null
    order by c.cve_secuencial asc
  ) sub;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_entregas
  from (
    select
      e.ent_id as "id",
      e.ent_secuencial as "secuencial",
      e.ent_uuid_cliente as "uuidCliente",
      coalesce(e.ent_codigo_ot, 'OT-' || lpad(e.ent_secuencial::text, 4, '0')) as "codigoOt",
      e.ent_tipo_origen as "tipoOrigen",
      coalesce(
        e.ent_clasificacion_pedido,
        ot.ota_clasificacion_pedido,
        case when e.ent_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' then 'EXEQUIALES'::text else 'DOMICILIO'::text end
      ) as "clasificacionPedido",
      e.ent_convenio_id as "convenioId",
      e.ent_proforma_id as "proformaId",
      coalesce(e.ent_orden_taller_id, ot.ota_id) as "ordenTallerId",
      coalesce(ot.ota_estado_taller, e.ent_detalle_entrega->>'estado_taller') as "estadoTaller",
      coalesce(e.ent_hora_solicitada, ot.ota_hora_especifica, e.ent_detalle_entrega->>'hora_solicitada') as "horaSolicitada",
      e.ent_entregado_por as "entregadoPor",
      e.ent_entregador_nombre as "entregadorNombre",
      coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) as "repartidorAsignadoId",
      coalesce(e.ent_repartidor_asignado_nombre, ot.ota_repartidor_nombre) as "repartidorAsignadoNombre",
      coalesce(e.ent_repartidor_tipo, ot.ota_repartidor_tipo) as "repartidorTipo",
      (coalesce(e.ent_en_ruta, false) or coalesce(ot.ota_en_ruta, false)) as "enRuta",
      coalesce(e.ent_ruta_latitud, ot.ota_ruta_latitud) as "rutaLatitud",
      coalesce(e.ent_ruta_longitud, ot.ota_ruta_longitud) as "rutaLongitud",
      coalesce(e.ent_ruta_actualizada_en, ot.ota_ruta_actualizada_en) as "rutaActualizadaEn",
      e.ent_fallecido_destinatario as "fallecidoDestinatario",
      e.ent_fecha_servicio as "fechaServicio",
      e.ent_capturado_en as "capturadoEn",
      e.ent_sincronizado_en as "sincronizadoEn",
      e.ent_descripcion_servicio as "descripcionServicio",
      coalesce(e.ent_sala_servicio, ot.ota_sala_servicio, e.ent_detalle_entrega->>'sala_servicio') as "salaServicio",
      e.ent_ubicacion_nombre as "ubicacionNombre",
      coalesce(e.ent_coordinador_nombre, ot.ota_cliente_solicita) as "coordinadorNombre",
      e.ent_recursos_utilizados as "recursosUtilizados",
      e.ent_latitud as "latitud",
      e.ent_longitud as "longitud",
      e.ent_precision_metros as "precisionMetros",
      e.ent_direccion_gps as "direccionGps",
      e.ent_foto_url as "fotoUrl",
      e.ent_mapa_url as "mapaUrl",
      (case when v_es_admin then e.ent_factura_referencia else null::text end) as "facturaReferencia",
      (case when v_es_admin then e.ent_documentos_adjuntos else null::text end) as "documentosAdjuntos",
      e.ent_observaciones as "observaciones",
      e.ent_informe_id as "informeId",
      (case when v_es_admin then i.ife_numero_informe else null::text end) as "numeroInforme",
      e.ent_estado as "estado"
    from comun_comercio.com_entrega_evidencia e
    left join comun_comercio.com_informe_entregas i on i.ife_id = e.ent_informe_id
    left join comun_comercio.com_orden_taller ot
      on ot.ota_entrega_id = e.ent_id
     and ot.ota_eliminado_en is null
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
      and (
        (not v_es_subcontratado and not v_es_delivery_interno)
        or (
          v_es_subcontratado
          and (
            coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid
            or e.ent_entregado_por = v_uid
          )
        )
        or (
          v_es_delivery_interno
          and (
            (e.ent_estado = 'PROGRAMADA' and (coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) is null or coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid))
            or e.ent_entregado_por = v_uid
            or coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid
          )
        )
      )
    order by
      (case when coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid and e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      (case when e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      (case when coalesce(ot.ota_estado_taller, '') = 'LISTO_ENTREGA' then 0 else 1 end) asc,
      e.ent_fecha_servicio desc,
      e.ent_creado_en desc
    limit 400
  ) sub;

  if v_es_admin then
    select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
    into v_informes
    from (
      select
        i.ife_id as "id",
        i.ife_secuencial as "secuencial",
        i.ife_convenio_id as "convenioId",
        i.ife_numero_informe as "numeroInforme",
        i.ife_fecha_informe as "fechaInforme",
        i.ife_fecha_inicio as "fechaInicio",
        i.ife_fecha_fin as "fechaFin",
        i.ife_total_entregas as "totalEntregas",
        i.ife_factura_referencia as "facturaReferencia",
        i.ife_documentos_adjuntos as "documentosAdjuntos",
        i.ife_estado as "estado",
        i.ife_pdf_url as "pdfUrl",
        i.ife_generado_nombre as "generadoNombre",
        i.ife_detalle_informe as "detalleInforme",
        i.ife_creado_en as "creadoEn"
      from comun_comercio.com_informe_entregas i
      where i.ife_negocio = v_negocio
        and i.ife_eliminado_en is null
      order by i.ife_creado_en desc
      limit 120
    ) sub;
  else
    v_informes := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_pedidos_pendientes
  from (
    select
      coalesce(o.ota_proforma_id, o.ota_id) as "proformaId",
      o.ota_id as "ordenTallerId",
      o.ota_codigo as "codigoOrden",
      coalesce(
        o.ota_clasificacion_pedido,
        comun_comercio.com_fn_inferir_clasificacion_pedido(
          null, o.ota_origen_tipo, o.ota_retiro_en_local, o.ota_sala_servicio, o.ota_producto_resumen, o.ota_ubicacion_entrega, o.ota_items
        )
      ) as "clasificacionPedido",
      (case when v_es_subcontratado or v_es_delivery_interno then 'VALIDADO'::text else o.ota_estado_pago end) as "estadoPago",
      o.ota_estado_taller as "estadoTaller",
      to_char(o.ota_fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
      o.ota_franja_horaria as "franjaHoraria",
      o.ota_cliente_solicita as "compradorNombre",
      coalesce(nullif(o.ota_destinatario_fallecido, ''), o.ota_cliente_solicita) as "destinatarioNombre",
      coalesce(o.ota_cliente_telefono, ''::text) as "destinatarioTelefono",
      coalesce(nullif(o.ota_ubicacion_entrega, ''), 'Retiro / Coordinar dirección'::text) as "direccionEntrega",
      o.ota_enlace_mapa as "enlaceMapa",
      o.ota_producto_resumen as "resumenItems",
      o.ota_repartidor_id as "repartidorAsignadoId",
      o.ota_repartidor_nombre as "repartidorAsignadoNombre",
      o.ota_repartidor_tipo as "repartidorTipo",
      coalesce(o.ota_en_ruta, false) as "enRuta",
      o.ota_ruta_latitud as "rutaLatitud",
      o.ota_ruta_longitud as "rutaLongitud",
      o.ota_ruta_actualizada_en as "rutaActualizadaEn",
      o.ota_creado_en as "creadoEn"
    from comun_comercio.com_orden_taller o
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and o.ota_origen_tipo <> 'EXEQUIALES_LLAMADA'
      and o.ota_estado_taller not in ('ENTREGADO', 'ANULADO')
      and (
        (not v_es_subcontratado and not v_es_delivery_interno)
        or (v_es_subcontratado and o.ota_repartidor_id = v_uid)
        or (
          v_es_delivery_interno
          and o.ota_estado_taller <> 'PENDIENTE_ENVIO'
          and (o.ota_repartidor_id is null or o.ota_repartidor_id = v_uid)
        )
      )
    order by
      (case when o.ota_repartidor_id = v_uid then 0 else 1 end) asc,
      (case when o.ota_estado_taller = 'LISTO_ENTREGA' then 0 when o.ota_estado_taller = 'EN_PREPARACION' then 1 else 2 end) asc,
      o.ota_fecha_entrega asc,
      o.ota_creado_en desc
    limit 120
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualId', v_uid,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Colaborador'),
    'rolOperativo', v_rol,
    'esAdminOperador', v_es_admin,
    'esSubcontratado', v_es_subcontratado,
    'convenios', v_convenios,
    'entregas', v_entregas,
    'informes', v_informes,
    'pedidosPendientesTienda', v_pedidos_pendientes
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tablero_entregas(text) to authenticated, service_role;

notify pgrst, 'reload schema';
