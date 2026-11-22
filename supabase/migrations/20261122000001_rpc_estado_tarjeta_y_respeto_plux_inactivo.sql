-- ==============================================================================
-- Migración: 20261122000001_rpc_estado_tarjeta_y_respeto_plux_inactivo.sql
-- Requerimientos: PLT-006 / PLT-009 / TRQ-ADM-004 / TNK-002
-- Descripción:
--   1. Crea la RPC transaccional `comun_comercio.com_fn_establecer_estado_tarjeta_negocio`
--      (SECURITY DEFINER) para habilitar/deshabilitar el procesamiento con tarjeta
--      de crédito/débito por negocio de forma atómica tanto en
--      `comun_comercio.com_pasarela_configuracion` (PLUX/PAYPHONE) como en
--      `comun_configuracion.cfg_negocio.cfg_detalle_configuracion.tienda_checkout`.
--   2. Corrige `comun_comercio.com_fn_preparar_pago_plux_proforma` para respetar
--      estrictamente cuando el negocio deshabilitó PLUX (`psc_activo = false` o
--      `tarjetaCreditoHabilitada = false`), evitando heredar la pasarela activa
--      de `tranqi` por respaldo silencioso.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC transaccional: habilitar / deshabilitar tarjeta de crédito por negocio
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_establecer_estado_tarjeta_negocio(
  p_negocio text,
  p_habilitado boolean,
  p_pasarela text default 'PLUX'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_pasarela text := upper(btrim(coalesce(p_pasarela, 'PLUX')));
  v_otra text;
  v_ahora timestamptz := now();
  v_nombre_comercio text;
  v_det_cfg jsonb;
  v_tienda_checkout jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para cambiar esta configuración.');
  end if;

  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para administrar pasarelas en este negocio.');
  end if;

  if v_pasarela not in ('PLUX', 'PAYPHONE') then
    v_pasarela := 'PLUX';
  end if;
  v_otra := case when v_pasarela = 'PLUX' then 'PAYPHONE' else 'PLUX' end;

  v_nombre_comercio := case v_negocio
    when 'tinkay' then 'Tinkay Floristería'
    when 'margaritas' then 'Margaritas Floristería'
    when 'fastfix' then 'FastFix Home'
    else 'Tranqi'
  end;

  if coalesce(p_habilitado, false) = false then
    -- Deshabilitar ambos procesadores de tarjeta en este negocio
    update comun_comercio.com_pasarela_configuracion
       set psc_activo = false,
           psc_actualizado_en = v_ahora
     where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
       and upper(psc_pasarela) in ('PLUX', 'PAYPHONE')
       and psc_eliminado_en is null;
  else
    -- Activar el procesador seleccionado (creándolo en PRUEBAS si no existía) y desactivar el alterno
    update comun_comercio.com_pasarela_configuracion
       set psc_activo = true,
           psc_actualizado_en = v_ahora
     where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
       and upper(psc_pasarela) = v_pasarela
       and psc_eliminado_en is null;

    if not found then
      if v_pasarela = 'PLUX' then
        insert into comun_comercio.com_pasarela_configuracion (
          psc_negocio, psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo,
          psc_credenciales_publicas, psc_orden_visual, psc_detalle_pasarela, psc_actualizado_en
        ) values (
          v_negocio, 'PLUX', 'PLUX (Tarjeta de Crédito / Débito)', 'PRUEBAS', true,
          jsonb_build_object('remail', 'admin.operaciones@tranqi24.com', 'nombre_comercio', v_nombre_comercio),
          1, jsonb_build_object('visibilidad', 'TODOS', 'probadores', '[]'::jsonb), v_ahora
        )
        on conflict (psc_negocio, psc_pasarela) do update
          set psc_activo = true,
              psc_eliminado_en = null,
              psc_actualizado_en = v_ahora;
      else
        insert into comun_comercio.com_pasarela_configuracion (
          psc_negocio, psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo,
          psc_credenciales_publicas, psc_orden_visual, psc_detalle_pasarela, psc_actualizado_en
        ) values (
          v_negocio, 'PAYPHONE', 'Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)', 'PRUEBAS', true,
          jsonb_build_object('storeId', 'STORE-DEMO-001', 'modoSimulado', true, 'moneda', 'USD', 'pais', 'EC'),
          2, '{}'::jsonb, v_ahora
        )
        on conflict (psc_negocio, psc_pasarela) do update
          set psc_activo = true,
              psc_eliminado_en = null,
              psc_actualizado_en = v_ahora;
      end if;
    end if;

    update comun_comercio.com_pasarela_configuracion
       set psc_activo = false,
           psc_actualizado_en = v_ahora
     where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
       and upper(psc_pasarela) = v_otra
       and psc_eliminado_en is null;
  end if;

  -- Sincronizar interruptor maestro en cfg_negocio.cfg_detalle_configuracion.tienda_checkout
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, v_nombre_comercio)
  on conflict (cfg_negocio) do nothing;

  select coalesce(cfg_detalle_configuracion, '{}'::jsonb)
    into v_det_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_negocio;

  v_tienda_checkout := case
    when jsonb_typeof(v_det_cfg -> 'tienda_checkout') = 'object' then v_det_cfg -> 'tienda_checkout'
    else '{}'::jsonb
  end;

  v_tienda_checkout := v_tienda_checkout || jsonb_build_object(
    'tarjetaCreditoHabilitada', coalesce(p_habilitado, false),
    'actualizadoEn', to_jsonb(v_ahora) #>> '{}'
  );

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{tienda_checkout}', v_tienda_checkout, true),
         cfg_actualizado_en = v_ahora
   where cfg_negocio = v_negocio;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'tarjetaHabilitada', coalesce(p_habilitado, false),
    'pasarelaActiva', case when coalesce(p_habilitado, false) then v_pasarela else null end
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_establecer_estado_tarjeta_negocio(text, boolean, text) from public;
grant execute on function comun_comercio.com_fn_establecer_estado_tarjeta_negocio(text, boolean, text) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Actualizar com_fn_obtener_pasarelas_activas para respetar el interruptor
--    maestro `tienda_checkout.tarjetaCreditoHabilitada` en cfg_negocio
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_obtener_pasarelas_activas(p_negocio text)
returns table (
  pasarela text,
  nombre_visible text,
  ambiente text,
  credenciales_publicas jsonb,
  comision_porcentaje numeric,
  orden_visual int
) language sql stable security definer
set search_path = ''
as $$
  select
    p.psc_pasarela,
    p.psc_nombre_visible,
    p.psc_ambiente,
    p.psc_credenciales_publicas,
    p.psc_comision_porcentaje,
    p.psc_orden_visual
  from comun_comercio.com_pasarela_configuracion p
  left join comun_configuracion.cfg_negocio c
    on comun_seguridad.seg_fn_normalizar_negocio(c.cfg_negocio) = comun_seguridad.seg_fn_normalizar_negocio(p.psc_negocio)
  where comun_seguridad.seg_fn_normalizar_negocio(p.psc_negocio) = comun_seguridad.seg_fn_normalizar_negocio(p_negocio)
    and p.psc_activo = true
    and p.psc_eliminado_en is null
    and p.psc_credenciales_publicas is not null
    and p.psc_credenciales_publicas <> '{}'::jsonb
    and coalesce(
      (c.cfg_detalle_configuracion -> 'tienda_checkout' ->> 'tarjetaCreditoHabilitada')::boolean,
      true
    ) = true
    and comun_comercio.com_fn_pasarela_visible(p.psc_ambiente, p.psc_detalle_pasarela)
  order by p.psc_orden_visual asc;
$$;

grant execute on function comun_comercio.com_fn_obtener_pasarelas_activas(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Actualizar com_fn_preparar_pago_plux_proforma para no heredar tranqi
--    cuando el comercio tiene PLUX o tarjetas deshabilitadas explícitamente
-- ------------------------------------------------------------------------------
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
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_prefijo text := case
    when v_negocio like '%tinkay%' then 'TNK'
    when v_negocio like '%margarita%' then 'MRG'
    when v_negocio like '%fastfix%' then 'FFH'
    else 'TRQ'
  end;
  v_modalidad text := upper(trim(coalesce(p_modalidad_cobro, 'TOTAL_100')));
  v_tarjeta_habilitada boolean := true;
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

  -- Verificar interruptor maestro de tarjeta en cfg_negocio
  select coalesce((c.cfg_detalle_configuracion -> 'tienda_checkout' ->> 'tarjetaCreditoHabilitada')::boolean, true)
    into v_tarjeta_habilitada
    from comun_configuracion.cfg_negocio c
   where comun_seguridad.seg_fn_normalizar_negocio(c.cfg_negocio) = v_negocio
   limit 1;

  if coalesce(v_tarjeta_habilitada, true) = false then
    return jsonb_build_object('ok', false, 'error', 'El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.');
  end if;

  -- Buscar fila propia del negocio (sin filtrar psc_activo para detectar deshabilitación explícita)
  select * into v_pasarela
  from comun_comercio.com_pasarela_configuracion
  where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
    and upper(psc_pasarela) = 'PLUX'
    and psc_eliminado_en is null
  limit 1;

  if found then
    if coalesce(v_pasarela.psc_activo, false) = false then
      return jsonb_build_object('ok', false, 'error', 'El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'La pasarela PLUX no está activa para este comercio.');
  end if;

  select * into v_prf
  from comun_comercio.com_proforma
  where prf_id = p_proforma_id
    and comun_seguridad.seg_fn_normalizar_negocio(prf_negocio) = v_negocio
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
    pag_negocio, pag_cliente_id, pag_pasarela, pag_identificador_cliente, pag_estado,
    pag_monto_total, pag_monto_con_iva, pag_monto_sin_iva, pag_monto_iva, pag_moneda,
    pag_referencia_id, pag_titular_email, pag_titular_telefono, pag_titular_identificacion,
    pag_detalle_transaccion
  )
  values (
    v_negocio, coalesce(v_usuario, v_prf.prf_cliente_id), 'PLUX', v_identificador, 'PENDIENTE',
    v_total_c / 100.0, v_base_grav_c / 100.0, v_base0_c / 100.0, v_iva_c / 100.0, 'USD',
    v_prf.prf_id, p_pagador->>'email', p_pagador->>'telefono', p_pagador->>'identificacion',
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

notify pgrst, 'reload schema';
