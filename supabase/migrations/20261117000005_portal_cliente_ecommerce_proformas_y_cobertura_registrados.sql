-- =============================================================================
-- Migración: 20261117000003_portal_cliente_ecommerce_proformas_y_cobertura_registrados.sql
-- Requerimientos: PLT-008 / PLT-009 / PLT-011 / TNK-002 (Experiencia E-Commerce de Cliente,
--   Edición en Autoservicio de Proformas, Acceso a Confirmación de Entrega GPS y
--   Zona de Cobertura Gratuita Exclusiva para Clientes Registrados).
-- =============================================================================

-- 1. Actualizar RPC com_fn_guardar_logistica_negocio para persistir reglas de clientes registrados vs invitados
create or replace function comun_comercio.com_fn_guardar_logistica_negocio(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_zona jsonb;
  v_codigos_recibidos text[] := array[]::text[];
  v_codigo text;
  v_modo text;
begin
  if v_negocio = '' then
    raise exception 'Identificador de negocio inválido';
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado para modificar la logística de este negocio';
  end if;

  insert into comun_comercio.com_logistica_negocio as l (
    log_negocio,
    log_activo,
    log_origen_nombre,
    log_origen_direccion,
    log_origen_mapa_url,
    log_origen_lat,
    log_origen_lng,
    log_zona_gratis_nombre,
    log_etiqueta_envio_gratis,
    log_tarifa_por_km,
    log_subsidio_base_usd,
    log_recargo_minimo_extra,
    log_tarifa_base_no_incluido,
    log_recargo_hora_exacta,
    log_radio_maximo_km,
    log_factor_vial_respaldo,
    log_permitir_retiro_local,
    log_detalle_logistica,
    log_actualizado_en
  )
  values (
    v_negocio,
    coalesce((p_payload->>'activo')::boolean, true),
    coalesce(nullif(trim(p_payload->>'origenNombre'), ''), 'Taller Matriz'),
    nullif(trim(p_payload->>'origenDireccion'), ''),
    nullif(trim(p_payload->>'origenMapaUrl'), ''),
    coalesce((p_payload->>'origenLat')::numeric(10,7), -0.1648075),
    coalesce((p_payload->>'origenLng')::numeric(10,7), -78.4661750),
    coalesce(nullif(trim(p_payload->>'zonaGratisNombre'), ''), 'Centro-Norte de Quito'),
    coalesce(nullif(trim(p_payload->>'etiquetaEnvioGratis'), ''), '🌸 Envío Gratis en Centro-Norte de Quito'),
    greatest(0, coalesce((p_payload->>'tarifaPorKm')::numeric(12,2), 0.50)),
    greatest(0, coalesce((p_payload->>'subsidioBaseUsd')::numeric(12,2), 3.00)),
    greatest(0, coalesce((p_payload->>'recargoMinimoExtra')::numeric(12,2), 1.00)),
    greatest(0, coalesce((p_payload->>'tarifaBaseNoIncluido')::numeric(12,2), 3.00)),
    greatest(0, coalesce((p_payload->>'recargoHoraExacta')::numeric(12,2), 10.00)),
    greatest(1, coalesce((p_payload->>'radioMaximoKm')::numeric(12,2), 45.00)),
    greatest(1, coalesce((p_payload->>'factorVialRespaldo')::numeric(6,2), 1.32)),
    coalesce((p_payload->>'permitirRetiroLocal')::boolean, true),
    jsonb_build_object(
      'mostrarKilometrosCliente', coalesce((p_payload->>'mostrarKilometrosCliente')::boolean, true),
      'envioGratisSoloRegistrados', coalesce((p_payload->>'envioGratisSoloRegistrados')::boolean, true),
      'tarifaBaseNoRegistradoUsd', greatest(0, coalesce((p_payload->>'tarifaBaseNoRegistradoUsd')::numeric(12,2), 1.00)),
      'tarifaPorKmNoRegistradoUsd', greatest(0, coalesce((p_payload->>'tarifaPorKmNoRegistradoUsd')::numeric(12,2), 0.50))
    ),
    now()
  )
  on conflict (log_negocio) do update set
    log_activo = excluded.log_activo,
    log_origen_nombre = excluded.log_origen_nombre,
    log_origen_direccion = excluded.log_origen_direccion,
    log_origen_mapa_url = excluded.log_origen_mapa_url,
    log_origen_lat = excluded.log_origen_lat,
    log_origen_lng = excluded.log_origen_lng,
    log_zona_gratis_nombre = excluded.log_zona_gratis_nombre,
    log_etiqueta_envio_gratis = excluded.log_etiqueta_envio_gratis,
    log_tarifa_por_km = excluded.log_tarifa_por_km,
    log_subsidio_base_usd = excluded.log_subsidio_base_usd,
    log_recargo_minimo_extra = excluded.log_recargo_minimo_extra,
    log_tarifa_base_no_incluido = excluded.log_tarifa_base_no_incluido,
    log_recargo_hora_exacta = excluded.log_recargo_hora_exacta,
    log_radio_maximo_km = excluded.log_radio_maximo_km,
    log_factor_vial_respaldo = excluded.log_factor_vial_respaldo,
    log_permitir_retiro_local = excluded.log_permitir_retiro_local,
    log_detalle_logistica = coalesce(l.log_detalle_logistica, '{}'::jsonb) || excluded.log_detalle_logistica,
    log_actualizado_en = now();

  if jsonb_typeof(p_payload->'zonas') = 'array' then
    for v_zona in select * from jsonb_array_elements(p_payload->'zonas') loop
      v_codigo := lower(regexp_replace(coalesce(nullif(trim(v_zona->>'codigo'), ''), trim(v_zona->>'nombre'), 'zona'), '[^a-zA-Z0-9_]+', '_', 'g'));
      v_modo := upper(coalesce(v_zona->>'modoCobro', 'POR_KM'));
      if v_modo not in ('GRATIS', 'TARIFA_FIJA', 'POR_KM') then
        v_modo := 'POR_KM';
      end if;

      v_codigos_recibidos := array_append(v_codigos_recibidos, v_codigo);

      insert into comun_comercio.com_zona_cobertura (
        zon_negocio,
        zon_codigo,
        zon_nombre,
        zon_provincia,
        zon_modo_cobro,
        zon_tarifa_fija,
        zon_prioridad,
        zon_activo,
        zon_poligono,
        zon_detalle_zona,
        zon_actualizado_en,
        zon_eliminado_en
      )
      values (
        v_negocio,
        v_codigo,
        coalesce(nullif(trim(v_zona->>'nombre'), ''), initcap(replace(v_codigo, '_', ' '))),
        coalesce(nullif(trim(v_zona->>'provincia'), ''), 'Pichincha'),
        v_modo,
        greatest(0, coalesce((v_zona->>'tarifaFija')::numeric(12,2), 0.00)),
        coalesce((v_zona->>'prioridad')::integer, 10),
        coalesce((v_zona->>'activo')::boolean, true),
        coalesce(v_zona->'poligono', '[]'::jsonb),
        jsonb_build_object(
          'color', coalesce(v_zona->>'color', '#0284C7'),
          'sectores_referencia', coalesce(v_zona->'sectoresReferencia', '[]'::jsonb)
        ),
        now(),
        null
      )
      on conflict (zon_negocio, zon_codigo) do update set
        zon_nombre = excluded.zon_nombre,
        zon_provincia = excluded.zon_provincia,
        zon_modo_cobro = excluded.zon_modo_cobro,
        zon_tarifa_fija = excluded.zon_tarifa_fija,
        zon_prioridad = excluded.zon_prioridad,
        zon_activo = excluded.zon_activo,
        zon_poligono = excluded.zon_poligono,
        zon_detalle_zona = excluded.zon_detalle_zona,
        zon_actualizado_en = now(),
        zon_eliminado_en = null;
    end loop;

    update comun_comercio.com_zona_cobertura
    set zon_eliminado_en = now(),
        zon_activo = false,
        zon_actualizado_en = now()
    where zon_negocio = v_negocio
      and zon_eliminado_en is null
      and not (zon_codigo = any(v_codigos_recibidos));
  end if;

  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial, cfg_detalle_configuracion)
  values (v_negocio, initcap(v_negocio), jsonb_build_object('logistica', p_payload))
  on conflict (cfg_negocio) do update set
    cfg_detalle_configuracion = coalesce(comun_configuracion.cfg_negocio.cfg_detalle_configuracion, '{}'::jsonb)
      || jsonb_build_object('logistica', p_payload),
    cfg_actualizado_en = now();

  return jsonb_build_object('ok', true, 'negocio', v_negocio);
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_logistica_negocio(text, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_logistica_negocio(text, jsonb) to authenticated, service_role;

-- 2. Semilla por defecto: Zona gratuita exclusiva para clientes registrados ($1.00 + $0.50/km para no registrados)
update comun_comercio.com_logistica_negocio
set log_detalle_logistica = jsonb_build_object(
      'mostrarKilometrosCliente', true,
      'envioGratisSoloRegistrados', true,
      'tarifaBaseNoRegistradoUsd', 1.00,
      'tarifaPorKmNoRegistradoUsd', 0.50
    ) || coalesce(log_detalle_logistica, '{}'::jsonb),
    log_actualizado_en = now()
where log_negocio in ('tinkay', 'margaritas');

-- 3. Política RLS en com_entrega_evidencia: permitir al cliente titular consultar la evidencia de entrega de su pedido
drop policy if exists com_entrega_evidencia_lectura on comun_comercio.com_entrega_evidencia;
create policy com_entrega_evidencia_lectura on comun_comercio.com_entrega_evidencia
  for select using (
    comun_seguridad.seg_fn_es_delivery_o_staff_negocio(ent_negocio)
    or (
      auth.uid() is not null
      and ent_proforma_id is not null
      and exists (
        select 1
        from comun_comercio.com_proforma p
        where p.prf_id = ent_proforma_id
          and p.prf_cliente_id = auth.uid()
          and p.prf_eliminado_en is null
      )
    )
  );

-- 4. RPC transaccional para que el cliente edite su proforma de evento antes del pago/confirmación
create or replace function comun_comercio.com_fn_actualizar_proforma_cliente(
  p_proforma_id uuid,
  p_token text,
  p_subtotal numeric,
  p_iva numeric,
  p_total numeric,
  p_detalle jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_bloqueada boolean := false;
  v_uid uuid := auth.uid();
  v_item jsonb;
begin
  if p_proforma_id is null then
    return jsonb_build_object('ok', false, 'error', 'Identificador de proforma requerido.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'La proforma debe contener al menos un arreglo o montaje.');
  end if;

  select * into v_fila
  from comun_comercio.com_proforma
  where prf_id = p_proforma_id
    and prf_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma no existe o fue eliminada.');
  end if;

  -- Validar propiedad por cliente autenticado o por token criptográfico de aprobación
  if not (
    (v_uid is not null and v_fila.prf_cliente_id = v_uid)
    or (
      coalesce(length(btrim(p_token)), 0) >= 8
      and btrim(p_token) = btrim(coalesce(v_fila.prf_token_aprobacion, ''))
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para editar esta proforma.');
  end if;

  v_grupo_id := coalesce(v_fila.prf_detalle_proforma->>'grupo_proforma_id', v_fila.prf_id::text);

  select exists (
    select 1
    from comun_comercio.com_proforma h
    where h.prf_negocio = v_fila.prf_negocio
      and h.prf_eliminado_en is null
      and coalesce(h.prf_detalle_proforma->>'grupo_proforma_id', h.prf_id::text) = v_grupo_id
      and (
        upper(coalesce(h.prf_estado, '')) in (
          'RESERVADA_70', 'APROBADA', 'ORDEN_CONFIRMADA', 'FACTURADA',
          'PAGADO', 'EN_PREPARACION', 'EN_RUTA', 'DESPACHADO', 'ENTREGADO'
        )
        or coalesce((h.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
      )
  ) into v_bloqueada;

  if v_bloqueada then
    return jsonb_build_object('ok', false, 'error', 'La proforma ya tiene reserva o pago confirmado y no puede editarse.');
  end if;

  update comun_comercio.com_proforma
  set prf_subtotal = greatest(0, round(coalesce(p_subtotal, 0), 2)),
      prf_iva = greatest(0, round(coalesce(p_iva, 0), 2)),
      prf_total = greatest(0.01, round(coalesce(p_total, 0.01), 2)),
      prf_detalle_proforma = coalesce(p_detalle, prf_detalle_proforma),
      prf_actualizado_en = now()
  where prf_id = v_fila.prf_id;

  update comun_comercio.com_proforma_item
  set pfi_eliminado_en = now()
  where pfi_proforma_id = v_fila.prf_id
    and pfi_eliminado_en is null;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into comun_comercio.com_proforma_item (
      pfi_negocio,
      pfi_proforma_id,
      pfi_variante_id,
      pfi_es_item_libre,
      pfi_descripcion,
      pfi_cantidad,
      pfi_precio_unitario,
      pfi_descuento,
      pfi_impuesto,
      pfi_total_linea,
      pfi_detalle_item
    )
    values (
      v_fila.prf_negocio,
      v_fila.prf_id,
      null,
      true,
      coalesce(nullif(btrim(v_item->>'descripcion'), ''), 'Arreglo de Evento'),
      greatest(1, coalesce((v_item->>'cantidad')::numeric, 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric, 0)),
      0,
      coalesce(nullif(btrim(v_item->>'impuesto'), ''), 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric, 0)),
      v_item
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_fila.prf_id,
    'token_aprobacion', v_fila.prf_token_aprobacion
  );
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_proforma_cliente(uuid, text, numeric, numeric, numeric, jsonb, jsonb)
  to anon, authenticated, service_role;

-- 5. Pre-configuración de vistas de cliente e-commerce en seg_widget y seg_rol_widget (Regla 15 AGENTS.md)
do $$
declare
  v_neg text;
  v_wdg record;
  v_wid uuid;
begin
  for v_neg in select unnest(array['tinkay', 'margaritas']) loop
    for v_wdg in
      select * from (values
        ('mis_compras', 'Mis Pedidos y Entregas', 'Seguimiento completo de pedidos, evidencia fotográfica GPS y factura SRI', '/panel?vista=pedidos', 'pedidos'),
        ('mi_carrito', 'Mi Carrito de Compras', 'Edición de arreglos, dedicatorias, complementos y envío en carrito', '/panel?vista=carrito', 'catalogo'),
        ('mis_proformas', 'Mis Proformas de Eventos', 'Consulta, edición y pago de proformas de bodas y eventos', '/panel?vista=proformas', 'facturacion'),
        ('promociones_cliente', 'Promociones y Beneficios', 'Promociones exclusivas para clientes registrados y ofertas generales', '/panel?vista=promociones', 'resumen')
      ) as t(clave, nombre, descripcion, ruta, icono)
    loop
      insert into comun_seguridad.seg_widget (
        wdg_negocio,
        wdg_clave,
        wdg_nombre,
        wdg_activo,
        wdg_detalle_widget
      )
      values (
        v_neg,
        v_wdg.clave,
        v_wdg.nombre,
        true,
        jsonb_build_object(
          'descripcion', v_wdg.descripcion,
          'categoria', 'ecommerce_cliente',
          'ruta', v_wdg.ruta,
          'panel_defecto', 'panel_cuenta',
          'icono', v_wdg.icono
        )
      )
      on conflict (wdg_negocio, wdg_clave) do update set
        wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = coalesce(comun_seguridad.seg_widget.wdg_detalle_widget, '{}'::jsonb) || excluded.wdg_detalle_widget
      returning wdg_id into v_wid;

      if v_wid is not null then
        insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
        values (v_neg, 'CLIENTE', v_wid, true)
        on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
          rlw_visible = true;
      end if;
    end loop;
  end loop;
end $$;
