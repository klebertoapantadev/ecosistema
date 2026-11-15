-- ==============================================================================
-- Migración: 20261114000001_proformas_eventos_autoservicio_y_plux_multiempresa.sql
-- Módulo: Proformas de Eventos en Autoservicio (TNK-002 / PLT-009),
--         Pasarela PLUX Multiempresa (aislamiento tinkay vs tranqi + Reserva 70%)
--         y Consentimiento LOPDP WhatsApp en Registro (PLT-001).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Garantizar privilegios por columna en comun_seguridad.seg_usuario (Regla 13)
-- ------------------------------------------------------------------------------
revoke update on comun_seguridad.seg_usuario from authenticated;

grant update (
  usu_nombres,
  usu_apellidos,
  usu_whatsapp,
  usu_cedula,
  usu_provincia_id,
  usu_ciudad_id,
  usu_autorizacion_whatsapp,
  usu_onboarding_completo,
  usu_terminos_aceptados_en,
  usu_terminos_version,
  usu_detalle_usuario,
  usu_actualizado_en
) on comun_seguridad.seg_usuario to authenticated;

-- ------------------------------------------------------------------------------
-- 2. Función auxiliar de prefijo comercial por negocio
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_prefijo_negocio(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_negocio, '')))
    when 'tinkay' then 'TNK'
    when 'tnk' then 'TNK'
    when 'margaritas' then 'MRG'
    when 'mrg' then 'MRG'
    when 'fastfix' then 'FFH'
    when 'ffh' then 'FFH'
    else 'TRQ'
  end;
$$;

grant execute on function comun_comercio.com_fn_prefijo_negocio(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Configuración independiente de PLUX para Tinkay (empresa separada de Tranqi)
--    Semilla inicial reutilizando las variables activas de tranqi sin acoplar filas
-- ------------------------------------------------------------------------------
do $$
declare
  v_tranqi comun_comercio.com_pasarela_configuracion%rowtype;
  v_remail text := 'admin.operaciones@tranqi24.com';
  v_ambiente text := 'PRUEBAS';
  v_privadas jsonb := '{}'::jsonb;
  v_negocio text;
  v_wdg_id uuid;
  v_per_id uuid;
begin
  select * into v_tranqi
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = 'tranqi'
    and psc_pasarela = 'PLUX'
    and psc_eliminado_en is null
  limit 1;

  if found then
    v_remail := coalesce(nullif(trim(v_tranqi.psc_credenciales_publicas->>'remail'), ''), v_remail);
    v_ambiente := coalesce(v_tranqi.psc_ambiente, 'PRUEBAS');
    v_privadas := coalesce(v_tranqi.psc_credenciales_privadas, '{}'::jsonb);
  end if;

  insert into comun_comercio.com_pasarela_configuracion (
    psc_negocio,
    psc_pasarela,
    psc_nombre_visible,
    psc_ambiente,
    psc_activo,
    psc_credenciales_publicas,
    psc_credenciales_privadas,
    psc_orden_visual,
    psc_detalle_pasarela
  )
  values (
    'tinkay',
    'PLUX',
    'PLUX (Tarjeta de Crédito / Débito)',
    v_ambiente,
    true,
    jsonb_build_object(
      'remail', v_remail,
      'nombre_comercio', 'Tinkay Floristería'
    ),
    v_privadas,
    1,
    jsonb_build_object('visibilidad', 'TODOS', 'probadores', '[]'::jsonb)
  )
  on conflict (psc_negocio, psc_pasarela) do update set
    psc_credenciales_publicas = case
      when coalesce(comun_comercio.com_pasarela_configuracion.psc_credenciales_publicas->>'remail', '') = ''
      then excluded.psc_credenciales_publicas
      else comun_comercio.com_pasarela_configuracion.psc_credenciales_publicas
    end,
    psc_credenciales_privadas = case
      when comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas is null
        or comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas = '{}'::jsonb
      then excluded.psc_credenciales_privadas
      else comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas
    end,
    psc_eliminado_en = null;

  -- Pre-configuración del widget pasarela_payphone / configuracion_pasarela por negocio y rol (Regla 15)
  foreach v_negocio in array array['tranqi', 'TRANQ', 'fastfix', 'FFH', 'tinkay', 'TNK', 'margaritas', 'MRG'] loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget,
      wdg_creado_en
    )
    values (
      v_negocio,
      'pasarela_payphone',
      'Pasarela de Pagos (PLUX / Payphone)',
      true,
      jsonb_build_object(
        'descripcion', 'Credenciales independientes de cobro con tarjeta (PLUX y Payphone), ambiente y webhook por empresa.',
        'categoria', 'Configuración',
        'ruta', '/panel/pasarelas',
        'panel_defecto', 'panel_configuracion',
        'icono', 'CreditCard'
      ),
      now()
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_activo = true,
      wdg_actualizado_en = now()
    returning wdg_id into v_wdg_id;

    if v_wdg_id is not null then
      insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      values
        (v_negocio, 'SUPERADMIN', v_wdg_id, true),
        (v_negocio, 'ADMINISTRADOR', v_wdg_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 4. RPC Autoservicio: Generar Proforma de Evento (clientes autenticados e invitados)
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_generar_proforma_evento(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(p_negocio);
  v_usuario uuid := auth.uid();
  v_comprador jsonb := coalesce(p_payload->'comprador', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_vigencia int := greatest(1, least(90, coalesce((p_payload->>'vigencia_dias')::int, 15)));
  v_subtotal numeric(12,2) := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_descuento numeric(12,2) := greatest(0, coalesce((p_payload->>'descuento_total')::numeric(12,2), 0));
  v_iva numeric(12,2) := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total numeric(12,2) := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_codigo text;
  v_item jsonb;
  v_whatsapp text;
  v_autoriza_wa boolean;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'La proforma debe contener al menos un artículo de evento.');
  end if;

  insert into comun_comercio.com_proforma (
    prf_negocio,
    prf_cliente_id,
    prf_cliente_nombre,
    prf_cliente_contacto,
    prf_estado,
    prf_subtotal,
    prf_descuento,
    prf_iva,
    prf_total,
    prf_vigencia_dias,
    prf_observaciones,
    prf_detalle_proforma
  )
  values (
    v_negocio,
    v_usuario,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), 'Cliente Evento'),
    v_comprador,
    'ENVIADA',
    v_subtotal,
    v_descuento,
    v_iva,
    v_total,
    v_vigencia,
    coalesce(p_payload->>'observaciones', ''),
    p_payload || jsonb_build_object(
      'tipo_origen', 'PROFORMA_EVENTO',
      'estado', 'ENVIADA',
      'porcentaje_reserva_sugerido', 70,
      'monto_reserva_70_usd', round((v_total * 0.70)::numeric, 2),
      'monto_abonado_usd', 0,
      'saldo_pendiente_usd', v_total
    )
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  v_codigo := v_prefijo || '-PRF-' || lpad(coalesce(v_secuencial, 1)::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object(
       'codigo_orden', v_codigo,
       'codigo_proforma', v_codigo,
       'codigo_base_proforma', v_codigo,
       'grupo_proforma_id', v_prf_id,
       'proforma_origen_id', v_prf_id,
       'version_numero', 1,
       'es_original', true,
       'etiqueta_version', coalesce(nullif(trim(p_payload->>'etiqueta_version'), ''), 'Original (Autoservicio)'),
       'creada_por_rol', 'CLIENTE'
     )
   where prf_id = v_prf_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
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
      v_negocio,
      v_prf_id,
      null,
      true,
      coalesce(v_item->>'descripcion', v_item->>'producto_nombre', 'Servicio de Evento'),
      greatest(0.01, coalesce((v_item->>'cantidad')::numeric(10,2), 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric(12,2), 0)),
      greatest(0, coalesce((v_item->>'descuento')::numeric(12,2), 0)),
      coalesce(v_item->>'impuesto', 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric(12,2), 0)),
      v_item
    );
  end loop;

  if v_logistica <> '{}'::jsonb then
    insert into comun_comercio.com_despacho_asignacion (
      dsp_negocio,
      dsp_orden_id,
      dsp_modalidad,
      dsp_tracking_url,
      dsp_costo_envio,
      dsp_estado,
      dsp_observaciones_coordinacion,
      dsp_detalle_despacho
    )
    values (
      v_negocio,
      v_prf_id,
      case when coalesce((v_logistica->>'retiro_en_local')::boolean, false) then 'RETIRO_LOCAL' else 'PROPIO' end,
      v_logistica->>'enlace_mapa',
      greatest(0, coalesce((p_payload->>'total_flete')::numeric(12,2), 0)),
      'ASIGNADO',
      coalesce(v_logistica->>'formula_calculo_interno', p_payload->>'observaciones', ''),
      v_logistica
    );
  end if;

  -- Si el usuario está autenticado y otorgó consentimiento WhatsApp, sincronizar en su ficha
  v_whatsapp := nullif(trim(coalesce(v_comprador->>'whatsapp', v_comprador->>'telefono', '')), '');
  v_autoriza_wa := coalesce((v_comprador->>'autorizaWhatsapp')::boolean, false);
  if v_usuario is not null and v_autoriza_wa and v_whatsapp is not null then
    update comun_seguridad.seg_usuario
       set usu_whatsapp = coalesce(nullif(usu_whatsapp, ''), v_whatsapp),
           usu_autorizacion_whatsapp = true,
           usu_actualizado_en = now()
     where usu_id = v_usuario;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'secuencial', v_secuencial,
    'codigo_proforma', v_codigo,
    'token_aprobacion', v_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_generar_proforma_evento(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_generar_proforma_evento(text, jsonb) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC Pedido Directo de Tienda (soporte nativo para carrito PLUX y Transferencia)
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_registrar_pedido_tienda(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(p_negocio);
  v_usuario uuid := auth.uid();
  v_comprador jsonb := coalesce(p_payload->'comprador', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_estado_inicial text := coalesce(nullif(trim(p_payload->>'estado'), ''), 'PENDIENTE_PAGO');
  v_subtotal numeric(12,2) := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_iva numeric(12,2) := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total numeric(12,2) := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_codigo text;
  v_item jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El pedido debe incluir al menos un producto.');
  end if;

  if v_estado_inicial not in ('PENDIENTE_PAGO', 'APROBADA') then
    v_estado_inicial := 'PENDIENTE_PAGO';
  end if;

  insert into comun_comercio.com_proforma (
    prf_negocio,
    prf_cliente_id,
    prf_cliente_nombre,
    prf_cliente_contacto,
    prf_estado,
    prf_subtotal,
    prf_descuento,
    prf_iva,
    prf_total,
    prf_observaciones,
    prf_detalle_proforma
  )
  values (
    v_negocio,
    v_usuario,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), 'Cliente'),
    v_comprador,
    v_estado_inicial,
    v_subtotal,
    0,
    v_iva,
    v_total,
    coalesce(p_payload->>'observaciones', ''),
    p_payload
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  v_codigo := v_prefijo || '-ORD-' || lpad(coalesce(v_secuencial, 1)::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object('codigo_orden', v_codigo)
   where prf_id = v_prf_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
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
      v_negocio,
      v_prf_id,
      null,
      true,
      coalesce(v_item->>'descripcion', v_item->>'producto_nombre', 'Producto'),
      greatest(0.01, coalesce((v_item->>'cantidad')::numeric(10,2), 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric(12,2), 0)),
      0,
      coalesce(v_item->>'impuesto', 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric(12,2), 0)),
      v_item
    );
  end loop;

  insert into comun_comercio.com_despacho_asignacion (
    dsp_negocio,
    dsp_orden_id,
    dsp_modalidad,
    dsp_tracking_url,
    dsp_costo_envio,
    dsp_estado,
    dsp_observaciones_coordinacion,
    dsp_detalle_despacho
  )
  values (
    v_negocio,
    v_prf_id,
    case when coalesce((v_logistica->>'retiro_en_local')::boolean, false) then 'RETIRO_LOCAL' else 'PROPIO' end,
    v_logistica->>'enlace_mapa',
    greatest(0, coalesce((p_payload->>'total_flete')::numeric(12,2), 0)),
    'ASIGNADO',
    coalesce(v_logistica->>'formula_calculo_interno', p_payload->>'observaciones', ''),
    v_logistica
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'codigo_orden', v_codigo,
    'token_aprobacion', v_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC Lectura Pública Segura por Token y Listado de Proformas del Cliente
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_obtener_proforma_por_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prf comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_items jsonb;
  v_variaciones jsonb;
  v_bloqueada boolean := false;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Enlace de proforma no válido.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_token_aprobacion = trim(p_token)
    and prf_eliminado_en is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma solicitada no existe o fue retirada.');
  end if;

  v_grupo_id := coalesce(
    nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), ''),
    v_prf.prf_id::text
  );

  select exists (
    select 1
    from comun_comercio.com_proforma g
    where g.prf_negocio = v_prf.prf_negocio
      and g.prf_eliminado_en is null
      and coalesce(nullif(trim(g.prf_detalle_proforma->>'grupo_proforma_id'), ''), g.prf_id::text) = v_grupo_id
      and (
        g.prf_estado in ('RESERVADA_70', 'APROBADA', 'ORDEN_CONFIRMADA', 'FACTURADA', 'PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO')
        or coalesce((g.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
      )
  ) into v_bloqueada;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pfi_id,
        'descripcion', pfi_descripcion,
        'cantidad', pfi_cantidad,
        'precio_unitario', pfi_precio_unitario,
        'descuento', pfi_descuento,
        'impuesto', pfi_impuesto,
        'total_linea', pfi_total_linea,
        'detalle', pfi_detalle_item
      )
      order by pfi_secuencial asc
    ),
    '[]'::jsonb
  )
  into v_items
  from comun_comercio.com_proforma_item
  where pfi_proforma_id = v_prf.prf_id
    and pfi_eliminado_en is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', vp.prf_id,
        'secuencial', vp.prf_secuencial,
        'negocio', vp.prf_negocio,
        'cliente_id', vp.prf_cliente_id,
        'cliente_nombre', vp.prf_cliente_nombre,
        'cliente_contacto', vp.prf_cliente_contacto,
        'estado', vp.prf_estado,
        'subtotal', vp.prf_subtotal,
        'descuento', vp.prf_descuento,
        'iva', vp.prf_iva,
        'total', vp.prf_total,
        'vigencia_dias', vp.prf_vigencia_dias,
        'token_aprobacion', vp.prf_token_aprobacion,
        'observaciones', vp.prf_observaciones,
        'detalle', vp.prf_detalle_proforma,
        'creado_en', vp.prf_creado_en,
        'actualizado_en', vp.prf_actualizado_en,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', i.pfi_id,
              'descripcion', i.pfi_descripcion,
              'cantidad', i.pfi_cantidad,
              'precio_unitario', i.pfi_precio_unitario,
              'descuento', i.pfi_descuento,
              'impuesto', i.pfi_impuesto,
              'total_linea', i.pfi_total_linea,
              'detalle', i.pfi_detalle_item
            )
            order by i.pfi_secuencial asc
          )
          from comun_comercio.com_proforma_item i
          where i.pfi_proforma_id = vp.prf_id
            and i.pfi_eliminado_en is null
        ), '[]'::jsonb)
      )
      order by coalesce((vp.prf_detalle_proforma->>'version_numero')::int, 1) asc, vp.prf_creado_en asc
    ),
    '[]'::jsonb
  )
  into v_variaciones
  from comun_comercio.com_proforma vp
  where vp.prf_negocio = v_prf.prf_negocio
    and vp.prf_eliminado_en is null
    and coalesce(nullif(trim(vp.prf_detalle_proforma->>'grupo_proforma_id'), ''), vp.prf_id::text) = v_grupo_id;

  return jsonb_build_object(
    'ok', true,
    'bloqueada_por_pago_grupo', v_bloqueada,
    'proforma', jsonb_build_object(
      'id', v_prf.prf_id,
      'secuencial', v_prf.prf_secuencial,
      'negocio', v_prf.prf_negocio,
      'cliente_id', v_prf.prf_cliente_id,
      'cliente_nombre', v_prf.prf_cliente_nombre,
      'cliente_contacto', v_prf.prf_cliente_contacto,
      'estado', v_prf.prf_estado,
      'subtotal', v_prf.prf_subtotal,
      'descuento', v_prf.prf_descuento,
      'iva', v_prf.prf_iva,
      'total', v_prf.prf_total,
      'vigencia_dias', v_prf.prf_vigencia_dias,
      'token_aprobacion', v_prf.prf_token_aprobacion,
      'observaciones', v_prf.prf_observaciones,
      'detalle', v_prf.prf_detalle_proforma,
      'creado_en', v_prf.prf_creado_en,
      'actualizado_en', v_prf.prf_actualizado_en,
      'items', v_items
    ),
    'variaciones', v_variaciones
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_proforma_por_token(text) from public;
grant execute on function comun_comercio.com_fn_obtener_proforma_por_token(text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_listar_mis_proformas(p_negocio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_lista jsonb;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para consultar tus proformas.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.prf_id,
        'secuencial', p.prf_secuencial,
        'codigo', coalesce(
          p.prf_detalle_proforma->>'codigo_proforma',
          p.prf_detalle_proforma->>'codigo_orden',
          comun_comercio.com_fn_prefijo_negocio(p.prf_negocio) || '-PRF-' || lpad(p.prf_secuencial::text, 4, '0')
        ),
        'tipo_origen', coalesce(p.prf_detalle_proforma->>'tipo_origen', 'PROFORMA_EVENTO'),
        'estado', p.prf_estado,
        'total', p.prf_total,
        'vigencia_dias', p.prf_vigencia_dias,
        'token_aprobacion', p.prf_token_aprobacion,
        'evento', p.prf_detalle_proforma->'evento',
        'monto_abonado_usd', coalesce((p.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0),
        'saldo_pendiente_usd', coalesce((p.prf_detalle_proforma->>'saldo_pendiente_usd')::numeric, p.prf_total),
        'creado_en', p.prf_creado_en
      )
      order by p.prf_creado_en desc
    ),
    '[]'::jsonb
  )
  into v_lista
  from comun_comercio.com_proforma p
  where p.prf_negocio = v_negocio
    and p.prf_cliente_id = v_usuario
    and p.prf_eliminado_en is null;

  return jsonb_build_object('ok', true, 'proformas', v_lista);
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_mis_proformas(text) from public, anon;
grant execute on function comun_comercio.com_fn_listar_mis_proformas(text) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6b. RPC Variaciones de Asesor + Eliminación / Confirmación por el Cliente
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_crear_variacion_proforma_asesor(
  p_proforma_base_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_es_autorizado boolean := false;
  v_base comun_comercio.com_proforma%rowtype;
  v_origen comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_prefijo text;
  v_max_version int;
  v_nueva_version int;
  v_codigo_base text;
  v_codigo_nuevo text;
  v_comprador jsonb;
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_vigencia int;
  v_subtotal numeric(12,2);
  v_descuento numeric(12,2);
  v_iva numeric(12,2);
  v_total numeric(12,2);
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_item jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'La variación debe incluir al menos un ítem.');
  end if;

  select * into v_base
  from comun_comercio.com_proforma
  where prf_id = p_proforma_base_id
    and prf_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma base no existe o fue eliminada.');
  end if;

  if current_user = 'service_role' then
    v_es_autorizado := true;
  elsif v_usuario is not null then
    select exists (
      select 1 from comun_seguridad.seg_usuario u
      where u.usu_id = v_usuario and u.usu_superadmin_plataforma = true
    ) or exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = v_usuario
        and lower(m.mem_negocio) in (lower(v_base.prf_negocio), lower(comun_comercio.com_fn_prefijo_negocio(v_base.prf_negocio)))
        and m.mem_estado in ('ACTIVO', 'ACTIVA')
        and upper(m.mem_rol) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'ASESOR', 'VENTAS', 'VENDEDOR')
    ) into v_es_autorizado;
  end if;

  if not v_es_autorizado then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para emitir variaciones de asesor.');
  end if;

  v_grupo_id := coalesce(
    nullif(trim(v_base.prf_detalle_proforma->>'grupo_proforma_id'), ''),
    v_base.prf_id::text
  );

  select * into v_origen
  from comun_comercio.com_proforma
  where prf_negocio = v_base.prf_negocio
    and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id
  order by coalesce((prf_detalle_proforma->>'version_numero')::int, 1) asc, prf_creado_en asc
  limit 1;

  if not found then
    v_origen := v_base;
  end if;

  select coalesce(max(coalesce((prf_detalle_proforma->>'version_numero')::int, 1)), 1)
  into v_max_version
  from comun_comercio.com_proforma
  where prf_negocio = v_base.prf_negocio
    and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id;

  v_nueva_version := v_max_version + 1;
  v_prefijo := comun_comercio.com_fn_prefijo_negocio(v_base.prf_negocio);
  v_codigo_base := coalesce(
    nullif(trim(v_origen.prf_detalle_proforma->>'codigo_base_proforma'), ''),
    nullif(trim(v_origen.prf_detalle_proforma->>'codigo_proforma'), ''),
    v_prefijo || '-PRF-' || lpad(coalesce(v_origen.prf_secuencial, 1)::text, 4, '0')
  );
  v_codigo_nuevo := v_codigo_base || '-V' || v_nueva_version::text;

  v_comprador := coalesce(p_payload->'comprador', v_base.prf_cliente_contacto, '{}'::jsonb);
  v_vigencia := greatest(1, least(90, coalesce((p_payload->>'vigencia_dias')::int, v_base.prf_vigencia_dias, 15)));
  v_subtotal := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_descuento := greatest(0, coalesce((p_payload->>'descuento_total')::numeric(12,2), 0));
  v_iva := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));

  insert into comun_comercio.com_proforma (
    prf_negocio,
    prf_cliente_id,
    prf_cliente_nombre,
    prf_cliente_contacto,
    prf_estado,
    prf_subtotal,
    prf_descuento,
    prf_iva,
    prf_total,
    prf_vigencia_dias,
    prf_observaciones,
    prf_detalle_proforma
  )
  values (
    v_base.prf_negocio,
    v_origen.prf_cliente_id,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), v_base.prf_cliente_nombre),
    v_comprador,
    'ENVIADA',
    v_subtotal,
    v_descuento,
    v_iva,
    v_total,
    v_vigencia,
    coalesce(p_payload->>'observaciones', v_base.prf_observaciones, ''),
    p_payload || jsonb_build_object(
      'tipo_origen', 'PROFORMA_EVENTO',
      'estado', 'ENVIADA',
      'codigo_orden', v_codigo_nuevo,
      'codigo_proforma', v_codigo_nuevo,
      'codigo_base_proforma', v_codigo_base,
      'grupo_proforma_id', v_grupo_id,
      'proforma_origen_id', v_origen.prf_id,
      'proforma_base_edicion_id', v_base.prf_id,
      'version_numero', v_nueva_version,
      'es_original', false,
      'etiqueta_version', coalesce(nullif(trim(p_payload->>'etiqueta_version'), ''), 'Propuesta V' || v_nueva_version::text || ' (Asesor)'),
      'creada_por_rol', 'ASESOR',
      'porcentaje_reserva_sugerido', 70,
      'monto_reserva_70_usd', round((v_total * 0.70)::numeric, 2),
      'monto_abonado_usd', 0,
      'saldo_pendiente_usd', v_total
    )
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  for v_item in select * from jsonb_array_elements(v_items) loop
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
      v_base.prf_negocio,
      v_prf_id,
      null,
      true,
      coalesce(v_item->>'descripcion', v_item->>'producto_nombre', 'Servicio de Evento'),
      greatest(0.01, coalesce((v_item->>'cantidad')::numeric(10,2), 1)),
      greatest(0, coalesce((v_item->>'precio_unitario')::numeric(12,2), 0)),
      greatest(0, coalesce((v_item->>'descuento')::numeric(12,2), 0)),
      coalesce(v_item->>'impuesto', 'IVA_0'),
      greatest(0, coalesce((v_item->>'total_linea')::numeric(12,2), 0)),
      v_item
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'proforma_origen_id', v_origen.prf_id,
    'token_origen', v_origen.prf_token_aprobacion,
    'version_numero', v_nueva_version,
    'codigo_proforma', v_codigo_nuevo,
    'token_aprobacion', v_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_crear_variacion_proforma_asesor(uuid, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_crear_variacion_proforma_asesor(uuid, jsonb) to authenticated, service_role;

create or replace function comun_comercio.com_fn_eliminar_proformas_cliente(
  p_token text,
  p_modo text,
  p_proforma_objetivo_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_modo text := upper(trim(coalesce(p_modo, 'UNA')));
  v_ref comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_bloqueada boolean := false;
  v_eliminadas int := 0;
  v_restante_token text;
begin
  if v_modo not in ('UNA', 'OTRAS', 'TODAS') then
    return jsonb_build_object('ok', false, 'error', 'Modo de eliminación no válido.');
  end if;

  if p_token is not null and length(trim(p_token)) >= 8 then
    select * into v_ref
    from comun_comercio.com_proforma
    where prf_token_aprobacion = trim(p_token)
      and prf_eliminado_en is null
    limit 1;
  elsif p_proforma_objetivo_id is not null and v_usuario is not null then
    select * into v_ref
    from comun_comercio.com_proforma
    where prf_id = p_proforma_objetivo_id
      and prf_cliente_id = v_usuario
      and prf_eliminado_en is null
    limit 1;
  end if;

  if v_ref.prf_id is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la proforma o ya fue eliminada.');
  end if;

  v_grupo_id := coalesce(
    nullif(trim(v_ref.prf_detalle_proforma->>'grupo_proforma_id'), ''),
    v_ref.prf_id::text
  );

  select exists (
    select 1
    from comun_comercio.com_proforma g
    where g.prf_negocio = v_ref.prf_negocio
      and g.prf_eliminado_en is null
      and coalesce(nullif(trim(g.prf_detalle_proforma->>'grupo_proforma_id'), ''), g.prf_id::text) = v_grupo_id
      and (
        g.prf_estado in ('RESERVADA_70', 'APROBADA', 'ORDEN_CONFIRMADA', 'FACTURADA', 'PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO')
        or coalesce((g.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
      )
  ) into v_bloqueada;

  if v_bloqueada then
    return jsonb_build_object(
      'ok', false,
      'error', 'No es posible eliminar proformas después de realizar el pedido o confirmar el pago.'
    );
  end if;

  if v_modo = 'UNA' then
    update comun_comercio.com_proforma
       set prf_eliminado_en = now(),
           prf_estado = 'ANULADA',
           prf_actualizado_en = now()
     where prf_negocio = v_ref.prf_negocio
       and prf_eliminado_en is null
       and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id
       and prf_id = coalesce(p_proforma_objetivo_id, v_ref.prf_id);
    get diagnostics v_eliminadas = row_count;
  elsif v_modo = 'OTRAS' then
    update comun_comercio.com_proforma
       set prf_eliminado_en = now(),
           prf_estado = 'ANULADA',
           prf_actualizado_en = now()
     where prf_negocio = v_ref.prf_negocio
       and prf_eliminado_en is null
       and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id
       and prf_id <> coalesce(p_proforma_objetivo_id, v_ref.prf_id);
    get diagnostics v_eliminadas = row_count;
  else
    update comun_comercio.com_proforma
       set prf_eliminado_en = now(),
           prf_estado = 'ANULADA',
           prf_actualizado_en = now()
     where prf_negocio = v_ref.prf_negocio
       and prf_eliminado_en is null
       and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id;
    get diagnostics v_eliminadas = row_count;
  end if;

  select prf_token_aprobacion into v_restante_token
  from comun_comercio.com_proforma
  where prf_negocio = v_ref.prf_negocio
    and prf_eliminado_en is null
    and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id
  order by coalesce((prf_detalle_proforma->>'version_numero')::int, 1) desc, prf_creado_en desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'eliminadas', v_eliminadas,
    'token_restante', v_restante_token
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_eliminar_proformas_cliente(text, text, uuid) from public;
grant execute on function comun_comercio.com_fn_eliminar_proformas_cliente(text, text, uuid) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(
  p_token text,
  p_modalidad_cobro text default 'RESERVA_70',
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prf comun_comercio.com_proforma%rowtype;
  v_grupo_id text;
  v_modalidad text := upper(trim(coalesce(p_modalidad_cobro, 'RESERVA_70')));
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Token de proforma inválido.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_token_aprobacion = trim(p_token)
    and prf_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La proforma no fue encontrada.');
  end if;

  v_grupo_id := coalesce(
    nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), ''),
    v_prf.prf_id::text
  );

  update comun_comercio.com_proforma
     set prf_estado = 'ORDEN_CONFIRMADA',
         prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado', 'ORDEN_CONFIRMADA',
           'metodo_pago', 'transferencia',
           'modalidad_comprometida', v_modalidad,
           'nota_transferencia', coalesce(p_nota, ''),
           'confirmada_transferencia_en', now(),
           'variacion_aceptada', true
         ),
         prf_actualizado_en = now()
   where prf_id = v_prf.prf_id;

  update comun_comercio.com_proforma
     set prf_estado = 'NO_ACEPTADA',
         prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado', 'NO_ACEPTADA',
           'descartada_por_aceptacion_id', v_prf.prf_id
         ),
         prf_actualizado_en = now()
   where prf_negocio = v_prf.prf_negocio
     and prf_eliminado_en is null
     and prf_id <> v_prf.prf_id
     and prf_estado in ('ENVIADA', 'PENDIENTE_PAGO')
     and coalesce(nullif(trim(prf_detalle_proforma->>'grupo_proforma_id'), ''), prf_id::text) = v_grupo_id;

  return jsonb_build_object('ok', true, 'id', v_prf.prf_id, 'estado', 'ORDEN_CONFIRMADA');
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(text, text, text) from public;
grant execute on function comun_comercio.com_fn_confirmar_orden_transferencia_proforma(text, text, text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. PLUX Multiempresa: Prefijo por Negocio + Preparación sobre Proforma/Pedido
--    (Soporta pago TOTAL_100, RESERVA_70 y SALDO_30 con IVA mixto 0% + 15%)
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_preparar_pago_plux(
  p_negocio text,
  p_variante_id uuid,
  p_pagador jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := lower(trim(coalesce(p_negocio, 'tranqi')));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(v_negocio);
  v_pasarela comun_comercio.com_pasarela_configuracion%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_producto text;
  v_base_c bigint;
  v_iva_c bigint;
  v_total_c bigint;
  v_identificador text;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para pagar.');
  end if;

  select * into v_pasarela
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = v_negocio
    and psc_pasarela = 'PLUX'
    and psc_activo = true
    and psc_eliminado_en is null;

  if not found or not comun_comercio.com_fn_pasarela_visible(v_pasarela.psc_ambiente, v_pasarela.psc_detalle_pasarela) then
    return jsonb_build_object('ok', false, 'error', 'PLUX no está disponible para esta cuenta.');
  end if;

  select v.* into v_variante
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id
    and v.var_negocio = v_negocio
    and v.var_activo = true
    and v.var_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El producto ya no está disponible.');
  end if;

  select pro_nombre into v_producto
  from comun_comercio.com_producto
  where pro_id = v_variante.var_producto_id
    and pro_negocio = v_negocio
    and pro_activo = true
    and pro_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El producto ya no está disponible.');
  end if;

  v_base_c := round(v_variante.var_precio * 100);
  v_iva_c := round(v_base_c * v_variante.var_tarifa_iva_porcentaje / 100);
  v_total_c := v_base_c + v_iva_c;

  if v_total_c <= 0 then
    return jsonb_build_object('ok', false, 'error', 'El producto no tiene precio.');
  end if;

  v_identificador := v_prefijo || '-PLX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio, pag_cliente_id, pag_pasarela, pag_identificador_cliente, pag_estado,
    pag_monto_total, pag_monto_con_iva, pag_monto_sin_iva, pag_monto_iva, pag_moneda,
    pag_titular_email, pag_titular_telefono, pag_titular_identificacion,
    pag_detalle_transaccion)
  values (
    v_negocio, v_usuario, 'PLUX', v_identificador, 'PENDIENTE',
    v_total_c / 100.0,
    case when v_iva_c > 0 then v_base_c / 100.0 else 0 end,
    case when v_iva_c > 0 then 0 else v_base_c / 100.0 end,
    v_iva_c / 100.0,
    'USD',
    p_pagador->>'email', p_pagador->>'telefono', p_pagador->>'identificacion',
    jsonb_build_object(
      'variante_id', v_variante.var_id,
      'producto', v_producto,
      'variante', v_variante.var_nombre,
      'ambiente', v_pasarela.psc_ambiente,
      'pagador', p_pagador));

  return jsonb_build_object(
    'ok', true,
    'identificador', v_identificador,
    'ambiente', v_pasarela.psc_ambiente,
    'remail', v_pasarela.psc_credenciales_publicas->>'remail',
    'nombre_comercio', coalesce(v_pasarela.psc_credenciales_publicas->>'nombre_comercio', initcap(v_negocio)),
    'descripcion', coalesce(v_producto || ' - ', '') || v_variante.var_nombre,
    'base_centavos', v_base_c,
    'iva_centavos', v_iva_c,
    'total_centavos', v_total_c);
end;
$$;

revoke execute on function comun_comercio.com_fn_preparar_pago_plux(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_preparar_pago_plux(text, uuid, jsonb) to authenticated;

create or replace function comun_comercio.com_fn_preparar_pago_plux_proforma(
  p_negocio text,
  p_proforma_id uuid,
  p_token text,
  p_pagador jsonb,
  p_modalidad_cobro text default 'TOTAL_100'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_prefijo text := comun_comercio.com_fn_prefijo_negocio(v_negocio);
  v_modalidad text := upper(trim(coalesce(p_modalidad_cobro, 'TOTAL_100')));
  v_pasarela comun_comercio.com_pasarela_configuracion%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_total_orden_c bigint;
  v_iva_orden_c bigint;
  v_base_orden_c bigint;
  v_base_grav_orden_c bigint;
  v_base0_orden_c bigint;
  v_abonado_prev_c bigint;
  v_restante_c bigint;
  v_factor numeric;
  v_base0_c bigint;
  v_base_grav_c bigint;
  v_iva_c bigint;
  v_total_c bigint;
  v_codigo text;
  v_etiqueta_cobro text;
  v_identificador text;
begin
  if v_modalidad not in ('TOTAL_100', 'RESERVA_70', 'SALDO_30') then
    return jsonb_build_object('ok', false, 'error', 'Modalidad de cobro no válida.');
  end if;

  select * into v_pasarela
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = v_negocio
    and psc_pasarela = 'PLUX'
    and psc_activo = true
    and psc_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La pasarela PLUX no está activa para este comercio.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_id = p_proforma_id
    and prf_negocio = v_negocio
    and prf_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'La orden o proforma no fue encontrada.');
  end if;

  if not (
    (p_token is not null and v_prf.prf_token_aprobacion = trim(p_token))
    or (v_usuario is not null and v_prf.prf_cliente_id = v_usuario)
  ) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para procesar el pago de esta proforma.');
  end if;

  if v_prf.prf_estado in ('CANCELADO', 'ENTREGADO') then
    return jsonb_build_object('ok', false, 'error', 'Esta orden ya no admite cobros en línea.');
  end if;

  v_total_orden_c := round(coalesce(v_prf.prf_total, 0) * 100);
  v_iva_orden_c := greatest(0, round(coalesce(v_prf.prf_iva, 0) * 100));
  v_base_orden_c := greatest(0, v_total_orden_c - v_iva_orden_c);

  if (v_prf.prf_detalle_proforma ? 'base_iva_gravada_centavos') and (v_prf.prf_detalle_proforma ? 'base_iva_0_centavos') then
    v_base_grav_orden_c := greatest(0, (v_prf.prf_detalle_proforma->>'base_iva_gravada_centavos')::bigint);
    v_base0_orden_c := greatest(0, v_base_orden_c - v_base_grav_orden_c);
  elsif v_iva_orden_c > 0 then
    v_base_grav_orden_c := least(v_base_orden_c, round(v_iva_orden_c * 100.0 / 15.0));
    v_base0_orden_c := greatest(0, v_base_orden_c - v_base_grav_orden_c);
  else
    v_base_grav_orden_c := 0;
    v_base0_orden_c := v_base_orden_c;
  end if;

  v_abonado_prev_c := greatest(0, round(coalesce((v_prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) * 100));

  if v_prf.prf_estado = 'APROBADA' and v_abonado_prev_c >= v_total_orden_c then
    return jsonb_build_object('ok', false, 'error', 'Esta proforma ya se encuentra pagada al 100%.');
  end if;

  if v_modalidad = 'RESERVA_70' then
    if v_prf.prf_estado = 'RESERVADA_70' or v_abonado_prev_c > 0 then
      return jsonb_build_object('ok', false, 'error', 'La reserva del 70% ya fue registrada. Puedes abonar el saldo restante.');
    end if;
    v_base0_c := round(v_base0_orden_c * 0.70);
    v_base_grav_c := round(v_base_grav_orden_c * 0.70);
    v_iva_c := round(v_iva_orden_c * 0.70);
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_etiqueta_cobro := 'Reserva 70% Evento';
  elsif v_modalidad = 'SALDO_30' or v_abonado_prev_c > 0 then
    v_restante_c := greatest(0, v_total_orden_c - v_abonado_prev_c);
    if v_restante_c <= 0 then
      return jsonb_build_object('ok', false, 'error', 'No existe saldo pendiente por pagar.');
    end if;
    v_factor := v_restante_c::numeric / greatest(1, v_total_orden_c)::numeric;
    v_iva_c := round(v_iva_orden_c * v_factor);
    v_base_grav_c := round(v_base_grav_orden_c * v_factor);
    v_base0_c := greatest(0, v_restante_c - v_iva_c - v_base_grav_c);
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_modalidad := 'SALDO_30';
    v_etiqueta_cobro := 'Liquidación Saldo 30%';
  else
    v_base0_c := v_base0_orden_c;
    v_base_grav_c := v_base_grav_orden_c;
    v_iva_c := v_iva_orden_c;
    v_total_c := v_base0_c + v_base_grav_c + v_iva_c;
    v_etiqueta_cobro := 'Pago Total 100%';
  end if;

  if v_total_c <= 0 then
    return jsonb_build_object('ok', false, 'error', 'El importe a cobrar debe ser mayor a cero.');
  end if;

  v_codigo := coalesce(
    v_prf.prf_detalle_proforma->>'codigo_proforma',
    v_prf.prf_detalle_proforma->>'codigo_orden',
    v_prefijo || '-PRF-' || lpad(coalesce(v_prf.prf_secuencial, 1)::text, 4, '0')
  );
  v_identificador := v_prefijo || '-PLX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio,
    pag_cliente_id,
    pag_pasarela,
    pag_identificador_cliente,
    pag_estado,
    pag_monto_total,
    pag_monto_con_iva,
    pag_monto_sin_iva,
    pag_monto_iva,
    pag_moneda,
    pag_referencia_id,
    pag_titular_email,
    pag_titular_telefono,
    pag_titular_identificacion,
    pag_detalle_transaccion
  )
  values (
    v_negocio,
    coalesce(v_usuario, v_prf.prf_cliente_id),
    'PLUX',
    v_identificador,
    'PENDIENTE',
    v_total_c / 100.0,
    v_base_grav_c / 100.0,
    v_base0_c / 100.0,
    v_iva_c / 100.0,
    'USD',
    v_prf.prf_id,
    p_pagador->>'email',
    p_pagador->>'telefono',
    p_pagador->>'identificacion',
    jsonb_build_object(
      'proforma_id', v_prf.prf_id,
      'codigo_orden', v_codigo,
      'modalidad_cobro', v_modalidad,
      'producto', v_codigo || ' (' || v_etiqueta_cobro || ')',
      'base0_centavos', v_base0_c,
      'base_gravada_centavos', v_base_grav_c,
      'iva_centavos', v_iva_c,
      'ambiente', v_pasarela.psc_ambiente,
      'pagador', p_pagador
    )
  );

  return jsonb_build_object(
    'ok', true,
    'identificador', v_identificador,
    'ambiente', v_pasarela.psc_ambiente,
    'remail', coalesce(v_pasarela.psc_credenciales_publicas->>'remail', 'admin.operaciones@tranqi24.com'),
    'nombre_comercio', coalesce(v_pasarela.psc_credenciales_publicas->>'nombre_comercio', initcap(v_negocio)),
    'descripcion', v_codigo || ' - ' || v_etiqueta_cobro,
    'base_centavos', v_base0_c + v_base_grav_c,
    'base0_centavos', v_base0_c,
    'base_gravada_centavos', v_base_grav_c,
    'iva_centavos', v_iva_c,
    'total_centavos', v_total_c
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_preparar_pago_plux_proforma(text, uuid, text, jsonb, text) from public;
grant execute on function comun_comercio.com_fn_preparar_pago_plux_proforma(text, uuid, text, jsonb, text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. Confirmación Transaccional PLUX (Suscripciones + Pedidos + Reserva 70% Eventos)
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_confirmar_pago_plux(p_negocio text, p_notificacion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, 'tranqi')));
  v_payload jsonb;
  v_pago comun_comercio.com_transaccion_pago%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_prf_id uuid;
  v_modalidad text;
  v_nuevo_abonado numeric(12,2);
  v_saldo numeric(12,2);
  v_nuevo_estado_prf text;
  v_estado_raw text;
  v_estado text;
  v_motivo text;
  v_monto numeric;
  v_frecuencia text;
  v_suscripcion uuid;
  v_autorizacion text;
  v_marca text;
  v_ultimos4 text;
begin
  v_payload := case
    when jsonb_typeof(p_notificacion->'detail') = 'object' then p_notificacion || (p_notificacion->'detail')
    else coalesce(p_notificacion, '{}'::jsonb)
  end;

  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = v_negocio
    and pag_identificador_cliente = v_payload->>'extras'
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'PAGO_DESCONOCIDO');
  end if;

  if v_pago.pag_estado <> 'PENDIENTE' then
    return jsonb_build_object('ok', true, 'repetido', true, 'estado', v_pago.pag_estado);
  end if;

  v_monto := case
    when coalesce(v_payload->>'amount', '') ~ '^[0-9]+(\.[0-9]+)?$' then (v_payload->>'amount')::numeric
    else v_pago.pag_monto_total
  end;

  v_estado_raw := upper(trim(coalesce(v_payload->>'state', v_payload->>'estado', v_payload->>'status', '')));

  if v_estado_raw not in ('PAGADO', 'APROBADO', 'SUCCEEDED', 'SUCCEDED') then
    v_estado := 'RECHAZADO';
    v_motivo := coalesce(nullif(v_estado_raw, ''), 'SIN_ESTADO');
  elsif v_monto is null or abs(v_monto - v_pago.pag_monto_total) >= 0.005 then
    v_estado := 'RECHAZADO';
    v_motivo := 'MONTO_DISTINTO';
  else
    v_estado := 'APROBADO';
  end if;

  v_autorizacion := coalesce(v_payload->>'token', v_payload->>'id_transaccion');
  v_marca := upper(coalesce(v_payload->>'cardIssuer', 'TARJETA'));
  v_ultimos4 := right(regexp_replace(coalesce(v_payload->>'cardInfo', ''), '\s+', '', 'g'), 4);

  update comun_comercio.com_transaccion_pago
     set pag_estado = v_estado,
         pag_transaccion_pasarela_id = coalesce(v_payload->>'id_transaccion', v_payload->>'idTransaction', v_payload->>'token'),
         pag_autorizacion_codigo = v_autorizacion,
         pag_tarjeta_tipo = case lower(coalesce(v_payload->>'cardType', ''))
                              when 'debit' then 'DEBITO'
                              else 'CREDITO'
                            end,
         pag_tarjeta_marca = v_marca,
         pag_tarjeta_ultimos_digitos = v_ultimos4,
         pag_confirmado_en = case when v_estado = 'APROBADO' then now() end,
         pag_detalle_transaccion = pag_detalle_transaccion
           || jsonb_build_object('webhook', v_payload, 'motivo', v_motivo),
         pag_actualizado_en = now()
   where pag_id = v_pago.pag_id;

  if v_estado <> 'APROBADO' then
    return jsonb_build_object('ok', true, 'estado', v_estado, 'motivo', v_motivo);
  end if;

  -- A) Si corresponde a una variante de suscripción (ej. Tranqi), activar suscripción
  if (v_pago.pag_detalle_transaccion ? 'variante_id') and (v_pago.pag_detalle_transaccion->>'variante_id') is not null then
    select * into v_variante
    from comun_comercio.com_variante
    where var_id = (v_pago.pag_detalle_transaccion->>'variante_id')::uuid;

    if found and v_pago.pag_cliente_id is not null
       and (v_variante.var_tipo_oferta like 'RECURRENTE%' or v_variante.var_frecuencia_recurrencia is not null) then
      v_frecuencia := coalesce(v_variante.var_frecuencia_recurrencia,
                               case when v_variante.var_tipo_oferta = 'RECURRENTE_ANUAL' then 'ANUAL' else 'MENSUAL' end);

      update comun_comercio.com_suscripcion
         set sub_estado = 'CANCELADA',
             sub_cancelado_en = now(),
             sub_actualizado_en = now()
       where sub_negocio = v_pago.pag_negocio
         and sub_cliente_id = v_pago.pag_cliente_id
         and sub_estado = 'ACTIVA'
         and sub_eliminado_en is null;

      insert into comun_comercio.com_suscripcion (
        sub_negocio, sub_cliente_id, sub_variante_id, sub_estado, sub_frecuencia,
        sub_monto_periodo, sub_proximo_cobro_en, sub_ultimo_cobro_en, sub_detalle_suscripcion)
      values (
        v_pago.pag_negocio, v_pago.pag_cliente_id, v_variante.var_id, 'ACTIVA', v_frecuencia,
        v_pago.pag_monto_total,
        now() + case v_frecuencia
                  when 'SEMANAL' then interval '7 days'
                  when 'QUINCENAL' then interval '15 days'
                  when 'ANUAL' then interval '1 year'
                  else interval '1 month'
                end,
        now(),
        jsonb_build_object('pago_id', v_pago.pag_id, 'pasarela', 'PLUX'))
      returning sub_id into v_suscripcion;

      update comun_comercio.com_transaccion_pago
         set pag_referencia_id = v_suscripcion
       where pag_id = v_pago.pag_id;
    end if;
  end if;

  -- B) Si corresponde a una Proforma de Evento o Pedido de Tienda, actualizar estado y abono
  v_prf_id := coalesce(
    v_pago.pag_referencia_id,
    case
      when (v_pago.pag_detalle_transaccion->>'proforma_id') ~* '^[0-9a-f-]{36}$'
      then (v_pago.pag_detalle_transaccion->>'proforma_id')::uuid
      else null
    end
  );

  if v_prf_id is not null then
    select * into v_prf
    from comun_comercio.com_proforma
    where prf_id = v_prf_id
      and prf_negocio = v_pago.pag_negocio
    for update;

    if found then
      v_modalidad := upper(coalesce(v_pago.pag_detalle_transaccion->>'modalidad_cobro', 'TOTAL_100'));
      v_nuevo_abonado := round((coalesce((v_prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) + v_pago.pag_monto_total)::numeric, 2);
      v_saldo := greatest(0, round((v_prf.prf_total - v_nuevo_abonado)::numeric, 2));
      v_nuevo_estado_prf := case
        when v_saldo > 0.02 and v_modalidad = 'RESERVA_70' then 'RESERVADA_70'
        else 'APROBADA'
      end;

      update comun_comercio.com_proforma
         set prf_estado = v_nuevo_estado_prf,
             prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
               'estado', v_nuevo_estado_prf,
               'metodo_pago', 'plux',
               'modalidad_ultimo_cobro', v_modalidad,
               'monto_abonado_usd', v_nuevo_abonado,
               'saldo_pendiente_usd', v_saldo,
               'ultimo_pago_plux', jsonb_build_object(
                 'pago_id', v_pago.pag_id,
                 'identificador', v_pago.pag_identificador_cliente,
                 'autorizacion', v_autorizacion,
                 'marca', v_marca,
                 'ultimos_digitos', v_ultimos4,
                 'monto_usd', v_pago.pag_monto_total,
                 'confirmado_en', now()
               ),
               'variacion_aceptada', true
             ),
             prf_actualizado_en = now()
       where prf_id = v_prf.prf_id;

      if nullif(trim(v_prf.prf_detalle_proforma->>'grupo_proforma_id'), '') is not null then
        update comun_comercio.com_proforma
           set prf_estado = 'NO_ACEPTADA',
               prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
                 'estado', 'NO_ACEPTADA',
                 'descartada_por_pago_id', v_prf.prf_id
               ),
               prf_actualizado_en = now()
         where prf_negocio = v_prf.prf_negocio
           and prf_eliminado_en is null
           and prf_id <> v_prf.prf_id
           and prf_estado in ('ENVIADA', 'PENDIENTE_PAGO')
           and coalesce(prf_detalle_proforma->>'grupo_proforma_id', '') = (v_prf.prf_detalle_proforma->>'grupo_proforma_id');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'estado', v_estado,
    'suscripcion_id', v_suscripcion,
    'proforma_id', v_prf_id
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) to service_role;

create or replace function comun_comercio.com_fn_confirmar_pago_plux_cliente(
  p_negocio text,
  p_identificador text,
  p_notificacion jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := lower(trim(coalesce(p_negocio, 'tranqi')));
  v_cliente_pago uuid;
begin
  select pag_cliente_id into v_cliente_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = v_negocio
    and pag_identificador_cliente = p_identificador
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pago no encontrado.');
  end if;

  -- Si el pago pertenece a un usuario registrado, exigir que coincida con auth.uid()
  -- salvo pagos emitidos desde proforma pública con token (pag_cliente_id puede ser null o de proforma compartida).
  if v_cliente_pago is not null and v_usuario is not null and v_cliente_pago is distinct from v_usuario then
    return jsonb_build_object('ok', false, 'error', 'Pago no autorizado para este usuario.');
  end if;

  return comun_comercio.com_fn_confirmar_pago_plux(
    v_negocio,
    coalesce(p_notificacion, '{}'::jsonb) || jsonb_build_object('extras', p_identificador)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_consultar_pago_plux_publico(p_identificador text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pago comun_comercio.com_transaccion_pago%rowtype;
begin
  if p_identificador is null or p_identificador !~ '^[A-Z]{3}-PLX-[0-9A-F]{12}$' then
    return jsonb_build_object('ok', false, 'error', 'Identificador inválido.');
  end if;

  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_identificador_cliente = p_identificador
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pago desconocido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pago_id', v_pago.pag_id,
    'estado', v_pago.pag_estado,
    'motivo', v_pago.pag_detalle_transaccion->>'motivo',
    'autorizacion', v_pago.pag_autorizacion_codigo,
    'marca_tarjeta', v_pago.pag_tarjeta_marca,
    'ultimos_digitos', v_pago.pag_tarjeta_ultimos_digitos
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_consultar_pago_plux_publico(text) from public;
grant execute on function comun_comercio.com_fn_consultar_pago_plux_publico(text) to anon, authenticated, service_role;
