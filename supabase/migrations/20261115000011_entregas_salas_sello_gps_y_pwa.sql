-- ==============================================================================
-- Migración: 20261115000011_entregas_salas_sello_gps_y_pwa.sql
--
-- Ajusta el módulo de Entregas Exequiales IESS y POD (TNK-005):
--   1. Agrega columna ent_sala_servicio en comun_comercio.com_entrega_evidencia
--      ('Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Capilla / Oficina').
--   2. Actualiza com_fn_obtener_tablero_entregas, com_fn_registrar_o_sincronizar_entrega
--      y com_fn_actualizar_entrega_evidencia para que Sala sea el único dato
--      requerido en campo en órdenes Exequiales, dejando Nombre del Fallecido,
--      Ubicación y Coordinador como opcionales/editables antes del informe.
-- ==============================================================================

do $$
begin
  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    alter table comun_comercio.com_entrega_evidencia
      add column if not exists ent_sala_servicio text;
  end if;
end $$;

create or replace function comun_comercio.com_fn_obtener_tablero_entregas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_es_admin boolean;
  v_convenios jsonb;
  v_entregas jsonb;
  v_informes jsonb;
  v_pedidos_pendientes jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder al módulo de entregas.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Colaborador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cve_id,
      'codigo', c.cve_codigo,
      'nombre', c.cve_nombre,
      'prefijoInforme', c.cve_prefijo_informe,
      'siguienteNumero', c.cve_siguiente_numero,
      'datosProveedor', c.cve_datos_proveedor
    ) order by c.cve_secuencial asc
  ), '[]'::jsonb)
  into v_convenios
  from comun_comercio.com_convenio_entrega c
  where c.cve_negocio = v_negocio
    and c.cve_activo = true
    and c.cve_eliminado_en is null;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_entregas
  from (
    select jsonb_build_object(
      'id', e.ent_id,
      'secuencial', e.ent_secuencial,
      'uuidCliente', e.ent_uuid_cliente,
      'codigoOt', coalesce(e.ent_codigo_ot, 'OT-' || lpad(e.ent_secuencial::text, 4, '0')),
      'tipoOrigen', e.ent_tipo_origen,
      'convenioId', e.ent_convenio_id,
      'proformaId', e.ent_proforma_id,
      'entregadoPor', e.ent_entregado_por,
      'entregadorNombre', e.ent_entregador_nombre,
      'fallecidoDestinatario', e.ent_fallecido_destinatario,
      'fechaServicio', e.ent_fecha_servicio,
      'capturadoEn', e.ent_capturado_en,
      'sincronizadoEn', e.ent_sincronizado_en,
      'descripcionServicio', e.ent_descripcion_servicio,
      'salaServicio', coalesce(e.ent_sala_servicio, e.ent_detalle_entrega->>'sala_servicio'),
      'ubicacionNombre', e.ent_ubicacion_nombre,
      'coordinadorNombre', e.ent_coordinador_nombre,
      'recursosUtilizados', e.ent_recursos_utilizados,
      'latitud', e.ent_latitud,
      'longitud', e.ent_longitud,
      'precisionMetros', e.ent_precision_metros,
      'direccionGps', e.ent_direccion_gps,
      'fotoUrl', e.ent_foto_url,
      'mapaUrl', e.ent_mapa_url,
      'facturaReferencia', e.ent_factura_referencia,
      'documentosAdjuntos', e.ent_documentos_adjuntos,
      'observaciones', e.ent_observaciones,
      'informeId', e.ent_informe_id,
      'numeroInforme', i.ife_numero_informe,
      'estado', e.ent_estado
    ) as item
    from comun_comercio.com_entrega_evidencia e
    left join comun_comercio.com_informe_entregas i on i.ife_id = e.ent_informe_id
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
    order by
      (case when e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      e.ent_fecha_servicio desc,
      e.ent_creado_en desc
    limit 400
  ) sub;

  if v_es_admin then
    select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
    into v_informes
    from (
      select jsonb_build_object(
        'id', i.ife_id,
        'secuencial', i.ife_secuencial,
        'convenioId', i.ife_convenio_id,
        'numeroInforme', i.ife_numero_informe,
        'fechaInforme', i.ife_fecha_informe,
        'fechaInicio', i.ife_fecha_inicio,
        'fechaFin', i.ife_fecha_fin,
        'totalEntregas', i.ife_total_entregas,
        'facturaReferencia', i.ife_factura_referencia,
        'documentosAdjuntos', i.ife_documentos_adjuntos,
        'estado', i.ife_estado,
        'pdfUrl', i.ife_pdf_url,
        'generadoNombre', i.ife_generado_nombre,
        'detalleInforme', i.ife_detalle_informe,
        'creadoEn', i.ife_creado_en
      ) as item
      from comun_comercio.com_informe_entregas i
      where i.ife_negocio = v_negocio
        and i.ife_eliminado_en is null
      order by i.ife_creado_en desc
      limit 120
    ) sub;
  else
    v_informes := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_pedidos_pendientes
  from (
    select jsonb_build_object(
      'proformaId', p.prf_id,
      'codigoOrden', coalesce(p.prf_detalle_proforma->>'codigo_orden', 'ORD-' || lpad(p.prf_secuencial::text, 4, '0')),
      'estadoPago', p.prf_estado,
      'compradorNombre', coalesce(p.prf_detalle_proforma->'comprador'->>'nombreCompleto', p.prf_detalle_proforma->'comprador'->>'nombre', 'Cliente Web'),
      'destinatarioNombre', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'destinatarioNombre',
        p.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        'Destinatario'
      ),
      'destinatarioTelefono', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'destinatarioTelefono',
        p.prf_detalle_proforma->'comprador'->>'whatsapp',
        ''
      ),
      'direccionEntrega', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'direccion',
        p.prf_detalle_proforma->'logistica_entrega'->>'sectorReferencia',
        'Retiro / Coordinar dirección'
      ),
      'enlaceMapa', p.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa',
      'resumenItems', coalesce((
        select string_agg(coalesce(it->>'cantidad', '1') || 'x ' || coalesce(it->>'descripcion', it->>'nombre', 'Arreglo'), ', ')
        from jsonb_array_elements(
          case when jsonb_typeof(p.prf_detalle_proforma->'items') = 'array' then p.prf_detalle_proforma->'items' else '[]'::jsonb end
        ) it
      ), 'Pedido Floral'),
      'creadoEn', p.prf_creado_en
    ) as item
    from comun_comercio.com_proforma p
    where lower(p.prf_negocio) = v_negocio
      and p.prf_eliminado_en is null
      and coalesce(p.prf_detalle_proforma->>'tipo_origen', '') <> 'PROFORMA_EVENTO'
      and upper(coalesce(p.prf_estado, '')) not in ('CANCELADO', 'ANULADO', 'NO_ACEPTADA')
      and coalesce((p.prf_detalle_proforma->>'entrega_confirmada')::boolean, false) = false
      and not exists (
        select 1
        from comun_comercio.com_entrega_evidencia ev
        where ev.ent_proforma_id = p.prf_id
          and ev.ent_eliminado_en is null
          and ev.ent_estado <> 'ANULADA'
      )
    order by p.prf_creado_en desc
    limit 100
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualId', v_uid,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Colaborador'),
    'esAdminOperador', v_es_admin,
    'convenios', v_convenios,
    'entregas', v_entregas,
    'informes', v_informes,
    'pedidosPendientesTienda', v_pedidos_pendientes
  );
end;
$$;

create or replace function comun_comercio.com_fn_registrar_o_sincronizar_entrega(
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
  v_uuid_cli uuid;
  v_entrega_id uuid;
  v_tipo_origen text;
  v_convenio_id uuid;
  v_proforma_id uuid;
  v_estado text;
  v_fecha_serv timestamptz;
  v_capturado timestamptz;
  v_lat numeric(10,7);
  v_lng numeric(10,7);
  v_prec numeric(8,2);
  v_sala text;
  v_fallecido text;
  v_reg comun_comercio.com_entrega_evidencia;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar entregas.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Delivery')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_uuid_cli := coalesce(nullif(btrim(p_payload->>'uuidCliente'), '')::uuid, gen_random_uuid());
  exception when others then
    v_uuid_cli := gen_random_uuid();
  end;

  begin
    v_entrega_id := nullif(btrim(coalesce(p_payload->>'entregaId', '')), '')::uuid;
  exception when others then
    v_entrega_id := null;
  end;

  v_tipo_origen := case
    when upper(coalesce(p_payload->>'tipoOrigen', '')) = 'PEDIDO_TIENDA' then 'PEDIDO_TIENDA'
    else 'ORDEN_TRABAJO_CONVENIO'
  end;

  v_sala := nullif(btrim(coalesce(p_payload->>'salaServicio', p_payload->'detalleExtra'->>'sala_servicio', '')), '');
  v_fallecido := coalesce(
    nullif(btrim(coalesce(p_payload->>'fallecidoDestinatario', '')), ''),
    case
      when v_sala is not null then 'Por confirmar (' || v_sala || ')'
      else 'Destinatario'
    end
  );

  begin
    v_convenio_id := nullif(btrim(coalesce(p_payload->>'convenioId', '')), '')::uuid;
  exception when others then
    v_convenio_id := null;
  end;

  if v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' and v_convenio_id is null then
    select cve_id into v_convenio_id
    from comun_comercio.com_convenio_entrega
    where cve_negocio = v_negocio and cve_eliminado_en is null
    order by cve_secuencial asc
    limit 1;
  end if;

  begin
    v_proforma_id := nullif(btrim(coalesce(p_payload->>'proformaId', '')), '')::uuid;
  exception when others then
    v_proforma_id := null;
  end;

  v_estado := coalesce(
    nullif(btrim(coalesce(p_payload->>'estado', '')), ''),
    case
      when v_tipo_origen = 'PEDIDO_TIENDA' then 'ENTREGADO_PEDIDO_REGULAR'
      when coalesce(btrim(p_payload->>'fotoUrl'), '') = '' and coalesce((p_payload->>'soloProgramarOt')::boolean, false) then 'PROGRAMADA'
      else 'ENTREGADA_PENDIENTE_INFORME'
    end
  );

  begin
    v_fecha_serv := coalesce(nullif(btrim(p_payload->>'fechaServicio'), '')::timestamptz, now());
  exception when others then
    v_fecha_serv := now();
  end;

  begin
    v_capturado := coalesce(nullif(btrim(p_payload->>'capturadoEn'), '')::timestamptz, now());
  exception when others then
    v_capturado := now();
  end;

  begin
    v_lat := nullif(btrim(coalesce(p_payload->>'latitud', '')), '')::numeric(10,7);
    v_lng := nullif(btrim(coalesce(p_payload->>'longitud', '')), '')::numeric(10,7);
    v_prec := nullif(btrim(coalesce(p_payload->>'precisionMetros', '')), '')::numeric(8,2);
  exception when others then
    v_lat := null;
    v_lng := null;
    v_prec := null;
  end;

  if v_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_entregado_por = coalesce(v_uid, ent_entregado_por),
           ent_entregador_nombre = coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, ent_entregador_nombre),
           ent_fallecido_destinatario = coalesce(nullif(btrim(p_payload->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
           ent_fecha_servicio = coalesce(v_fecha_serv, ent_fecha_servicio),
           ent_capturado_en = v_capturado,
           ent_sincronizado_en = now(),
           ent_descripcion_servicio = coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), ent_descripcion_servicio),
           ent_sala_servicio = coalesce(v_sala, ent_sala_servicio),
           ent_ubicacion_nombre = coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), ent_ubicacion_nombre),
           ent_coordinador_nombre = coalesce(nullif(btrim(p_payload->>'coordinadorNombre'), ''), ent_coordinador_nombre),
           ent_recursos_utilizados = coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), ent_recursos_utilizados),
           ent_latitud = coalesce(v_lat, ent_latitud),
           ent_longitud = coalesce(v_lng, ent_longitud),
           ent_precision_metros = coalesce(v_prec, ent_precision_metros),
           ent_direccion_gps = coalesce(nullif(btrim(p_payload->>'direccionGps'), ''), ent_direccion_gps),
           ent_foto_url = coalesce(nullif(btrim(p_payload->>'fotoUrl'), ''), ent_foto_url),
           ent_mapa_url = coalesce(nullif(btrim(p_payload->>'mapaUrl'), ''), ent_mapa_url),
           ent_observaciones = coalesce(nullif(btrim(p_payload->>'observaciones'), ''), ent_observaciones),
           ent_detalle_entrega = coalesce(ent_detalle_entrega, '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end,
           ent_estado = case when ent_estado = 'INCLUIDA_EN_INFORME' then 'INCLUIDA_EN_INFORME' else 'ENTREGADA_PENDIENTE_INFORME' end,
           ent_actualizado_en = now()
     where ent_id = v_entrega_id
       and ent_negocio = v_negocio
     returning * into v_reg;
  else
    insert into comun_comercio.com_entrega_evidencia (
      ent_uuid_cliente,
      ent_negocio,
      ent_tipo_origen,
      ent_convenio_id,
      ent_proforma_id,
      ent_entregado_por,
      ent_entregador_nombre,
      ent_fallecido_destinatario,
      ent_fecha_servicio,
      ent_capturado_en,
      ent_sincronizado_en,
      ent_descripcion_servicio,
      ent_sala_servicio,
      ent_ubicacion_nombre,
      ent_coordinador_nombre,
      ent_recursos_utilizados,
      ent_latitud,
      ent_longitud,
      ent_precision_metros,
      ent_direccion_gps,
      ent_foto_url,
      ent_mapa_url,
      ent_factura_referencia,
      ent_documentos_adjuntos,
      ent_observaciones,
      ent_estado,
      ent_detalle_entrega
    ) values (
      v_uuid_cli,
      v_negocio,
      v_tipo_origen,
      v_convenio_id,
      v_proforma_id,
      v_uid,
      coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, 'Delivery'),
      v_fallecido,
      v_fecha_serv,
      v_capturado,
      now(),
      coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), 'Set condolencias (3 arreglos)'),
      v_sala,
      coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), coalesce(v_sala, '')),
      nullif(btrim(coalesce(p_payload->>'coordinadorNombre', '')), ''),
      coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), 'Flores, follaje, bases y oasis'),
      v_lat,
      v_lng,
      v_prec,
      nullif(btrim(coalesce(p_payload->>'direccionGps', '')), ''),
      nullif(btrim(coalesce(p_payload->>'fotoUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'mapaUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'facturaReferencia', '')), ''),
      nullif(btrim(coalesce(p_payload->>'documentosAdjuntos', '')), ''),
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      v_estado,
      coalesce(p_payload->'detalleExtra', '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end
    )
    on conflict (ent_uuid_cliente) do update set
      ent_foto_url = coalesce(excluded.ent_foto_url, comun_comercio.com_entrega_evidencia.ent_foto_url),
      ent_mapa_url = coalesce(excluded.ent_mapa_url, comun_comercio.com_entrega_evidencia.ent_mapa_url),
      ent_latitud = coalesce(excluded.ent_latitud, comun_comercio.com_entrega_evidencia.ent_latitud),
      ent_longitud = coalesce(excluded.ent_longitud, comun_comercio.com_entrega_evidencia.ent_longitud),
      ent_sala_servicio = coalesce(excluded.ent_sala_servicio, comun_comercio.com_entrega_evidencia.ent_sala_servicio),
      ent_sincronizado_en = now(),
      ent_actualizado_en = now()
    returning * into v_reg;

    if v_reg.ent_codigo_ot is null then
      update comun_comercio.com_entrega_evidencia
         set ent_codigo_ot = (case when v_tipo_origen = 'PEDIDO_TIENDA' then 'POD-' else 'OT-' end) || lpad(v_reg.ent_secuencial::text, 4, '0')
       where ent_id = v_reg.ent_id
       returning * into v_reg;
    end if;
  end if;

  if v_tipo_origen = 'PEDIDO_TIENDA' and v_proforma_id is not null then
    update comun_comercio.com_proforma
       set prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'entrega_confirmada', true,
             'entrega_confirmada_en', v_capturado,
             'entrega_entregador_nombre', v_reg.ent_entregador_nombre,
             'entrega_foto_url', v_reg.ent_foto_url,
             'entrega_latitud', v_reg.ent_latitud,
             'entrega_longitud', v_reg.ent_longitud
           ),
           prf_actualizado_en = now()
     where prf_id = v_proforma_id;

    insert into comun_comercio.com_despacho_asignacion (
      dsp_negocio, dsp_orden_id, dsp_modalidad, dsp_conductor_nombre, dsp_estado, dsp_comprobante_entrega
    ) values (
      v_negocio,
      v_proforma_id,
      'PROPIO',
      v_reg.ent_entregador_nombre,
      'ENTREGADO',
      jsonb_build_object(
        'evidencia_id', v_reg.ent_id,
        'foto_url', v_reg.ent_foto_url,
        'latitud', v_reg.ent_latitud,
        'longitud', v_reg.ent_longitud,
        'entregado_en', v_capturado
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'entregaId', v_reg.ent_id,
    'codigoOt', v_reg.ent_codigo_ot,
    'estado', v_reg.ent_estado
  );
end;
$$;

create or replace function comun_comercio.com_fn_actualizar_entrega_evidencia(
  p_negocio text,
  p_entrega_id uuid,
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_sala text := nullif(btrim(coalesce(p_cambios->>'salaServicio', '')), '');
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo administración u operaciones pueden editar registros antes del informe.');
  end if;

  update comun_comercio.com_entrega_evidencia
     set ent_fallecido_destinatario = coalesce(nullif(btrim(p_cambios->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
         ent_fecha_servicio = coalesce(nullif(btrim(p_cambios->>'fechaServicio'), '')::timestamptz, ent_fecha_servicio),
         ent_descripcion_servicio = coalesce(nullif(btrim(p_cambios->>'descripcionServicio'), ''), ent_descripcion_servicio),
         ent_sala_servicio = case when p_cambios ? 'salaServicio' then v_sala else ent_sala_servicio end,
         ent_ubicacion_nombre = coalesce(p_cambios->>'ubicacionNombre', ent_ubicacion_nombre),
         ent_coordinador_nombre = coalesce(p_cambios->>'coordinadorNombre', ent_coordinador_nombre),
         ent_recursos_utilizados = coalesce(nullif(btrim(p_cambios->>'recursosUtilizados'), ''), ent_recursos_utilizados),
         ent_entregador_nombre = coalesce(nullif(btrim(p_cambios->>'entregadorNombre'), ''), ent_entregador_nombre),
         ent_factura_referencia = coalesce(p_cambios->>'facturaReferencia', ent_factura_referencia),
         ent_documentos_adjuntos = coalesce(p_cambios->>'documentosAdjuntos', ent_documentos_adjuntos),
         ent_foto_url = coalesce(nullif(btrim(p_cambios->>'fotoUrl'), ''), ent_foto_url),
         ent_mapa_url = coalesce(nullif(btrim(p_cambios->>'mapaUrl'), ''), ent_mapa_url),
         ent_detalle_entrega = coalesce(ent_detalle_entrega, '{}'::jsonb) || case when v_sala is not null then jsonb_build_object('sala_servicio', v_sala) else '{}'::jsonb end,
         ent_estado = case
           when coalesce((p_cambios->>'anular')::boolean, false) then 'ANULADA'
           else ent_estado
         end,
         ent_actualizado_en = now()
   where ent_id = p_entrega_id
     and ent_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
