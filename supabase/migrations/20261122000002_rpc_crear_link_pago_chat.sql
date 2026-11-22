-- ==============================================================================
-- Migración: 20261122000002_rpc_crear_link_pago_chat.sql
-- Requerimientos: PLT-006 / PLT-009 / PLT-010 / TNK-002
-- Descripción:
--   Crea la RPC transaccional `comun_comercio.com_fn_crear_link_pago_chat`
--   (SECURITY DEFINER) que permite a operadores/asesores autenticados generar
--   enlaces de cobro (`/pagar/[token]`) desde el Chat Omnicanal con monto
--   editable, respaldados en `comun_comercio.com_proforma` + `com_proforma_item`
--   para cobro en línea con PLUX (tarjeta) o Transferencia/DeUna y facturación
--   electrónica automática SRI.
-- ==============================================================================

create or replace function comun_comercio.com_fn_crear_link_pago_chat(
  p_negocio text,
  p_monto_total numeric,
  p_concepto text default 'Pedido floral personalizado',
  p_iva_porcentaje numeric default 0,
  p_cliente_nombre text default 'Cliente Chat',
  p_cliente_telefono text default '',
  p_cliente_correo text default '',
  p_conversacion_id uuid default null,
  p_codigo_pedido text default null,
  p_detalle_extra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_total numeric(12,2);
  v_iva_pct numeric(5,2);
  v_subtotal numeric(12,2);
  v_iva numeric(12,2);
  v_base0_centavos integer;
  v_base_gravada_centavos integer;
  v_concepto text;
  v_cliente_nombre text;
  v_cliente_tel text;
  v_cliente_correo text;
  v_prefijo text;
  v_token text;
  v_prf_id uuid;
  v_prf_secuencial bigint;
  v_codigo text;
  v_impuesto_etiqueta text;
  v_comprador jsonb;
  v_detalle jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para generar links de pago.');
  end if;

  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos de operador o administrador en este negocio.');
  end if;

  v_total := round(coalesce(p_monto_total, 0)::numeric, 2);
  if v_total < 0.50 or v_total > 50000 then
    return jsonb_build_object('ok', false, 'error', 'El valor del link de pago debe estar entre $0.50 y $50,000.00 USD.');
  end if;

  v_iva_pct := case when coalesce(p_iva_porcentaje, 0) > 0 then 15 else 0 end;
  if v_iva_pct > 0 then
    v_subtotal := round((v_total / (1 + v_iva_pct / 100.0))::numeric, 2);
    v_iva := greatest(0, round((v_total - v_subtotal)::numeric, 2));
    v_base_gravada_centavos := round(v_subtotal * 100)::integer;
    v_base0_centavos := 0;
    v_impuesto_etiqueta := 'IVA_15';
  else
    v_subtotal := v_total;
    v_iva := 0;
    v_base_gravada_centavos := 0;
    v_base0_centavos := round(v_total * 100)::integer;
    v_impuesto_etiqueta := 'IVA_0';
  end if;

  v_concepto := left(coalesce(nullif(btrim(p_concepto), ''), 'Pedido personalizado'), 240);
  v_cliente_nombre := left(coalesce(nullif(btrim(p_cliente_nombre), ''), 'Cliente Chat'), 160);
  v_cliente_tel := left(coalesce(btrim(p_cliente_telefono), ''), 40);
  v_cliente_correo := left(coalesce(btrim(p_cliente_correo), ''), 160);

  v_prefijo := case v_negocio
    when 'tinkay' then 'TNK'
    when 'margaritas' then 'MRG'
    when 'fastfix' then 'FFH'
    else 'TRQ'
  end;

  v_token := replace(gen_random_uuid()::text, '-', '');

  v_comprador := jsonb_build_object(
    'nombreCompleto', v_cliente_nombre,
    'identificacion', '9999999999999',
    'correo', v_cliente_correo,
    'whatsapp', v_cliente_tel,
    'telefono', v_cliente_tel,
    'autorizaWhatsapp', true
  );

  v_detalle := coalesce(p_detalle_extra, '{}'::jsonb) || jsonb_build_object(
    'tipo_origen', 'LINK_PAGO_CHAT',
    'estado', 'PENDIENTE_PAGO',
    'concepto', v_concepto,
    'conversacion_id', p_conversacion_id,
    'codigo_pedido_vinculado', nullif(btrim(coalesce(p_codigo_pedido, '')), ''),
    'creado_por', v_uid,
    'comprador', v_comprador,
    'subtotal_base_imponible', v_subtotal,
    'total_iva', v_iva,
    'total_flete', 0,
    'total_pagar', v_total,
    'base_iva_0_centavos', v_base0_centavos,
    'base_iva_gravada_centavos', v_base_gravada_centavos,
    'monto_abonado_usd', 0,
    'saldo_pendiente_usd', v_total,
    'items', jsonb_build_array(
      jsonb_build_object(
        'descripcion', v_concepto,
        'producto_nombre', v_concepto,
        'cantidad', 1,
        'precio_unitario', v_total,
        'impuesto', v_impuesto_etiqueta,
        'total_linea', v_total
      )
    )
  );

  insert into comun_comercio.com_proforma (
    prf_negocio,
    prf_cliente_nombre,
    prf_cliente_contacto,
    prf_estado,
    prf_subtotal,
    prf_descuento,
    prf_iva,
    prf_total,
    prf_token_aprobacion,
    prf_vigencia_dias,
    prf_observaciones,
    prf_detalle_proforma
  ) values (
    v_negocio,
    v_cliente_nombre,
    v_comprador,
    'PENDIENTE_PAGO',
    v_subtotal,
    0,
    v_iva,
    v_total,
    v_token,
    7,
    v_concepto,
    v_detalle
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_prf_secuencial, v_token;

  v_codigo := v_prefijo || '-LNK-' || lpad(v_prf_secuencial::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object(
       'codigo_proforma', v_codigo,
       'codigo_orden', v_codigo,
       'grupo_proforma_id', v_prf_id::text
     ),
         prf_actualizado_en = now()
   where prf_id = v_prf_id;

  insert into comun_comercio.com_proforma_item (
    pfi_negocio,
    pfi_proforma_id,
    pfi_es_item_libre,
    pfi_descripcion,
    pfi_cantidad,
    pfi_precio_unitario,
    pfi_descuento,
    pfi_impuesto,
    pfi_total_linea,
    pfi_detalle_item
  ) values (
    v_negocio,
    v_prf_id,
    true,
    v_concepto,
    1,
    v_total,
    0,
    v_impuesto_etiqueta,
    v_total,
    jsonb_build_object('origen', 'LINK_PAGO_CHAT', 'iva_porcentaje', v_iva_pct)
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_prf_id,
    'secuencial', v_prf_secuencial,
    'codigo', v_codigo,
    'token_aprobacion', v_token,
    'subtotal', v_subtotal,
    'iva', v_iva,
    'total', v_total,
    'base_iva_0_centavos', v_base0_centavos,
    'base_iva_gravada_centavos', v_base_gravada_centavos
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_crear_link_pago_chat(
  text, numeric, text, numeric, text, text, text, uuid, text, jsonb
) from public, anon;

grant execute on function comun_comercio.com_fn_crear_link_pago_chat(
  text, numeric, text, numeric, text, text, text, uuid, text, jsonb
) to authenticated, service_role;
