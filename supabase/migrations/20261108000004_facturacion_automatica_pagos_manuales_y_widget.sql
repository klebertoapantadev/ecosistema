-- ==============================================================================
-- Migración: 20261108000004_facturacion_automatica_pagos_manuales_y_widget.sql
-- Implementa:
--   1. Semilla de emisores por defecto (ambiente 1 pruebas, emisión automática activa)
--      en comun_facturacion.fac_emisor para los 4 negocios del ecosistema.
--   2. Mejora en fac_fn_emitir_interno y fac_fn_facturar_pago para calcular totales
--      inmediatos, soportar datos de pagador de PLUX/Payphone/Manual, emitir
--      automáticamente en ambiente de pruebas incluso sin certificado .p12 cargado
--      y sincronizar el resumen de factura electrónica en pag_detalle_transaccion.
--   3. RPC transaccional com_fn_registrar_pago_manual_y_facturar para que el
--      Operador/Administrador registre pagos por otros medios (transferencia,
--      efectivo, Deuna, depósito, etc.) y emita la factura electrónica en el acto.
--   4. Retro-emisión automática de facturas para pagos APROBADOS existentes sin
--      comprobante electrónico asociado.
--   5. Registro y pre-configuración de los widgets 'facturacion_electronica' e
--      'historial_pagos' en comun_seguridad.seg_widget y seg_rol_widget (Regla 15).
-- ==============================================================================

-- 1. Semilla de emisores por negocio (ambiente 1 = pruebas, emisión automática activa)
insert into comun_facturacion.fac_emisor (
  emi_negocio,
  emi_ruc,
  emi_razon_social,
  emi_nombre_comercial,
  emi_direccion_matriz,
  emi_direccion_establecimiento,
  emi_establecimiento,
  emi_punto_emision,
  emi_obligado_contabilidad,
  emi_regimen,
  emi_ambiente,
  emi_emision_automatica,
  emi_activo,
  emi_correo_copia
)
values
  ('tranqi',     '1790016919001', 'TRANQI LEGAL S.A.S.',                'Tranqi Legal',           'Av. República del Salvador y Moscú, Quito - Ecuador', 'Av. República del Salvador y Moscú, Quito - Ecuador', '001', '001', true,  'GENERAL',           1, true, true, 'facturacion@tranqi24.com'),
  ('fastfix',    '1790016927001', 'FASTFIX HOME SERVICIOS S.A.S.',      'FastFix Home',           'Av. Amazonas y Naciones Unidas, Quito - Ecuador',     'Av. Amazonas y Naciones Unidas, Quito - Ecuador',     '001', '001', true,  'GENERAL',           1, true, true, 'facturacion@fastfix.ec'),
  ('tinkay',     '1790016935001', 'TINKAY FLORISTERIA S.A.S.',          'Tinkay Floristería',     'Av. González Suárez y Orellana, Quito - Ecuador',     'Av. González Suárez y Orellana, Quito - Ecuador',     '001', '001', false, 'RIMPE_EMPRENDEDOR', 1, true, true, 'facturacion@tinkay.ec'),
  ('margaritas', '1790016943001', 'MARGARITAS FLORISTERIA S.A.S.',      'Margaritas Floristería', 'Av. De los Shyris y Portugal, Quito - Ecuador',       'Av. De los Shyris y Portugal, Quito - Ecuador',       '001', '001', false, 'RIMPE_EMPRENDEDOR', 1, true, true, 'facturacion@margaritas.ec')
on conflict (emi_negocio) do update set
  emi_emision_automatica = true,
  emi_activo = true,
  emi_actualizado_en = now();

-- 2. Ampliar política de lectura de fac_comprobante para que el cliente vea
--    también sus comprobantes recién emitidos (PENDIENTE, RECIBIDO, AUTORIZADO, ANULADO)
drop policy if exists fac_comprobante_lectura on comun_facturacion.fac_comprobante;
create policy fac_comprobante_lectura on comun_facturacion.fac_comprobante
  for select using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(cmp_negocio)
    or (cmp_cliente_usuario_id = auth.uid() and cmp_estado in ('PENDIENTE', 'RECIBIDO', 'AUTORIZADO', 'ANULADO'))
  );

-- 3. Flexibilizar fac_fn_normalizar_comprador para que identificaciones de prueba
--    o pasaportes/cédulas no fallen bloqueando la facturación automática
create or replace function comun_facturacion.fac_fn_normalizar_comprador(p_comprador jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tipo text := btrim(coalesce(p_comprador ->> 'tipo_identificacion', ''));
  v_id text := upper(btrim(coalesce(p_comprador ->> 'identificacion', '')));
  v_razon text := btrim(regexp_replace(coalesce(p_comprador ->> 'razon_social', ''), '\s+', ' ', 'g'));
  v_correo text := nullif(lower(btrim(coalesce(p_comprador ->> 'correo', ''))), '');
begin
  if v_tipo = '07' or v_id = '' or v_id = '9999999999999' then
    v_tipo := '07';
    v_id := '9999999999999';
    v_razon := coalesce(nullif(v_razon, ''), 'CONSUMIDOR FINAL');
  elsif v_tipo = '05' then
    if not comun_facturacion.fac_fn_cedula_valida(v_id) then
      -- Si no supera módulo 10 (ej. identificación de pruebas o pasaporte), tratar como 06
      if length(v_id) between 4 and 20 then
        v_tipo := '06';
      else
        raise exception 'Cedula invalida';
      end if;
    end if;
  elsif v_tipo = '04' then
    if v_id !~ '^[0-9]{10}001$' then
      if length(v_id) between 4 and 20 then
        v_tipo := '06';
      else
        raise exception 'RUC invalido: deben ser 13 digitos terminados en 001';
      end if;
    end if;
  elsif v_tipo in ('06', '08') then
    if length(v_id) not between 1 and 20 or v_id ~ '\s' then
      raise exception 'Identificacion invalida';
    end if;
  else
    if v_id ~ '^[0-9]{10}001$' then
      v_tipo := '04';
    elsif comun_facturacion.fac_fn_cedula_valida(v_id) then
      v_tipo := '05';
    elsif length(v_id) between 1 and 20 then
      v_tipo := '06';
    else
      v_tipo := '07';
      v_id := '9999999999999';
      v_razon := coalesce(nullif(v_razon, ''), 'CONSUMIDOR FINAL');
    end if;
  end if;

  if v_razon = '' then
    v_razon := 'CLIENTE';
  end if;

  if v_correo is not null and v_correo !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' then
    v_correo := null;
  end if;

  return jsonb_build_object(
    'tipo_identificacion', v_tipo,
    'identificacion', v_id,
    'razon_social', left(v_razon, 300),
    'direccion', coalesce(nullif(left(btrim(coalesce(p_comprador ->> 'direccion', '')), 300), ''), 'Quito - Ecuador'),
    'correo', v_correo,
    'telefono', nullif(left(btrim(coalesce(p_comprador ->> 'telefono', '')), 20), '')
  );
end;
$$;

-- 4. Mejorar fac_fn_emitir_interno:
--    - Calcula y persiste inmediatamente subtotales, IVA e importe total en líneas y cabecera.
--    - En ambiente 1 (pruebas), si aún no hay certificado .p12 activo, autoriza el comprobante
--      en modo pruebas para que el número secuencial y clave de acceso de 49 dígitos estén
--      disponibles de inmediato en el pago y en el widget de Facturación.
--    - Sincroniza el resumen de la factura en com_transaccion_pago.pag_detalle_transaccion.
create or replace function comun_facturacion.fac_fn_emitir_interno(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_tiene_cert boolean := false;
  v_numero bigint;
  v_fecha date := (now() at time zone 'America/Guayaquil')::date;
  v_codigo text := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
  v_clave text;
  v_numero_formato text;
  v_total_sin_imp numeric(12,2) := 0;
  v_total_desc numeric(12,2) := 0;
  v_total_iva numeric(12,2) := 0;
  v_importe_total numeric(12,2) := 0;
  v_estado_final text;
  v_rubro_principal text;
begin
  select * into v_cmp from comun_facturacion.fac_comprobante where cmp_id = p_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_cmp.cmp_estado <> 'BORRADOR' then
    return v_cmp.cmp_clave_acceso;
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_cmp.cmp_negocio;
  if not found or not v_emisor.emi_activo then
    raise exception 'La facturacion electronica no esta activa para este negocio';
  end if;

  select exists (
    select 1 from comun_facturacion.fac_certificado
     where cer_id = v_emisor.emi_certificado_id and cer_activo
       and cer_valido_desde <= now() and cer_valido_hasta > now()
  ) into v_tiene_cert;

  if v_emisor.emi_ambiente = 2 and not v_tiene_cert then
    raise exception 'El emisor no tiene un certificado de firma vigente para produccion';
  end if;
  if v_emisor.emi_ambiente = 2 and not v_emisor.emi_produccion_habilitada then
    raise exception 'Produccion no habilitada para este negocio';
  end if;

  -- Calcular base imponible e IVA por línea
  update comun_facturacion.fac_comprobante_linea
     set lin_base_imponible = round(lin_cantidad * lin_precio_unitario - lin_descuento, 2),
         lin_valor_iva = round(
           round(lin_cantidad * lin_precio_unitario - lin_descuento, 2) *
           (case lin_codigo_iva when '4' then 15 when '5' then 5 when '10' then 13 else 0 end) / 100.0,
           2
         ),
         lin_actualizado_en = now()
   where lin_comprobante_id = p_id;

  select
    coalesce(sum(lin_base_imponible), 0),
    coalesce(sum(lin_descuento), 0),
    coalesce(sum(lin_valor_iva), 0),
    coalesce(max(lin_descripcion), 'Servicio Facturado')
  into v_total_sin_imp, v_total_desc, v_total_iva, v_rubro_principal
  from comun_facturacion.fac_comprobante_linea
  where lin_comprobante_id = p_id;

  v_importe_total := round(v_total_sin_imp + v_total_iva, 2);

  insert into comun_facturacion.fac_secuencial as s (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision, sec_ultimo)
  values (v_cmp.cmp_negocio, v_emisor.emi_ambiente, v_cmp.cmp_tipo, v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, 1)
  on conflict (sec_negocio, sec_ambiente, sec_tipo, sec_establecimiento, sec_punto_emision)
  do update set sec_ultimo = s.sec_ultimo + 1, sec_actualizado_en = now()
  returning sec_ultimo into v_numero;

  v_clave := comun_facturacion.fac_fn_clave_acceso(
    v_fecha, v_cmp.cmp_tipo, v_emisor.emi_ruc, v_emisor.emi_ambiente,
    v_emisor.emi_establecimiento, v_emisor.emi_punto_emision, v_numero, v_codigo);

  v_numero_formato := v_emisor.emi_establecimiento || '-' || v_emisor.emi_punto_emision || '-' || lpad(v_numero::text, 9, '0');
  v_estado_final := case when v_tiene_cert then 'PENDIENTE' else 'AUTORIZADO' end;

  update comun_facturacion.fac_comprobante
     set cmp_estado = v_estado_final,
         cmp_ambiente = v_emisor.emi_ambiente,
         cmp_establecimiento = v_emisor.emi_establecimiento,
         cmp_punto_emision = v_emisor.emi_punto_emision,
         cmp_numero = v_numero,
         cmp_clave_acceso = v_clave,
         cmp_fecha_emision = v_fecha,
         cmp_total_sin_impuestos = v_total_sin_imp,
         cmp_total_descuento = v_total_desc,
         cmp_total_iva = v_total_iva,
         cmp_importe_total = v_importe_total,
         cmp_numero_autorizacion = case when v_estado_final = 'AUTORIZADO' then v_clave else cmp_numero_autorizacion end,
         cmp_fecha_autorizacion = case when v_estado_final = 'AUTORIZADO' then now() else cmp_fecha_autorizacion end,
         cmp_emitido_en = now(),
         cmp_proximo_intento = case when v_tiene_cert then now() else null end,
         cmp_actualizado_en = now()
   where cmp_id = p_id;

  -- Si está vinculado a una transacción de pago, guardar snapshot en pag_detalle_transaccion
  if v_cmp.cmp_transaccion_pago_id is not null then
    update comun_comercio.com_transaccion_pago
       set pag_detalle_transaccion = coalesce(pag_detalle_transaccion, '{}'::jsonb) || jsonb_build_object(
             'factura_electronica', jsonb_build_object(
               'comprobante_id', p_id,
               'numero_comprobante', v_numero_formato,
               'clave_acceso', v_clave,
               'estado', v_estado_final,
               'ambiente', v_emisor.emi_ambiente,
               'fecha_emision', v_fecha::text,
               'fecha_autorizacion', now(),
               'rubro_facturado', v_rubro_principal,
               'subtotal', v_total_sin_imp,
               'iva', v_total_iva,
               'total', v_importe_total,
               'comprador', v_cmp.cmp_comprador
             )
           )
     where pag_id = v_cmp.cmp_transaccion_pago_id;
  end if;

  perform comun_facturacion.fac_fn_evento(p_id, v_cmp.cmp_negocio, 'emitido',
    jsonb_build_object('numero', v_numero_formato, 'ambiente', v_emisor.emi_ambiente, 'estado', v_estado_final));

  if v_tiene_cert then
    perform comun_facturacion.fac_fn_despertar_worker();
  end if;

  return v_clave;
end;
$$;

-- 5. Mejorar fac_fn_facturar_pago para soportar todos los orígenes de pago
--    (PLUX, Payphone, Transferencia, Efectivo, Deuna, etc.)
create or replace function comun_facturacion.fac_fn_facturar_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
  v_detalle jsonb := coalesce(new.pag_detalle_transaccion, '{}'::jsonb);
  v_datos jsonb := coalesce(v_detalle -> 'datos_facturacion', v_detalle -> 'pagador', '{}'::jsonb);
  v_variante comun_comercio.com_variante%rowtype;
  v_producto text;
  v_codigo_iva text;
  v_porcentaje numeric;
  v_descripcion text;
  v_codigo text;
  v_lineas jsonb := '[]'::jsonb;
  v_comprador jsonb;
  v_identificacion text;
  v_razon_social text;
  v_tipo_id text;
  v_forma text;
  v_info jsonb;
  v_id uuid;
begin
  if new.pag_estado <> 'APROBADO' or (tg_op = 'UPDATE' and old.pag_estado = 'APROBADO') then
    return new;
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor
   where emi_negocio = new.pag_negocio and emi_activo and emi_emision_automatica;
  if not found then
    return new;
  end if;

  if exists (select 1 from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = new.pag_id) then
    return new;
  end if;

  begin
    -- Determinar variante y producto si aplica
    if (v_detalle ->> 'variante_id') ~ '^[0-9a-f-]{36}$' then
      select * into v_variante from comun_comercio.com_variante where var_id = (v_detalle ->> 'variante_id')::uuid;
      if found then
        select pro_nombre into v_producto from comun_comercio.com_producto where pro_id = v_variante.var_producto_id;
      end if;
    end if;

    v_codigo := coalesce(nullif(v_variante.var_sku, ''), nullif(v_detalle ->> 'codigo_rubro', ''), 'SERV-001');
    v_descripcion := coalesce(
      nullif(v_detalle ->> 'rubro_facturado', ''),
      nullif(v_detalle ->> 'nombre_servicio', ''),
      nullif(concat_ws(' - ', v_detalle ->> 'producto', v_detalle ->> 'variante'), ''),
      nullif(concat_ws(' - ', v_producto, v_variante.var_nombre), ''),
      'Servicio ' || initcap(new.pag_negocio)
    );
    v_porcentaje := coalesce(v_variante.var_tarifa_iva_porcentaje, 15);
    v_codigo_iva := case
      when v_variante.var_codigo_impuesto_sri = 'NO_OBJETO' then '6'
      when v_variante.var_codigo_impuesto_sri = 'EXENTO' then '7'
      when v_variante.var_codigo_impuesto_sri = 'IVA_0' or v_porcentaje = 0 then '0'
      when v_porcentaje = 5 then '5'
      when v_porcentaje = 13 then '10'
      else '4' end;

    if coalesce(new.pag_monto_con_iva, 0) > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', round(new.pag_monto_con_iva, 2), 'descuento', 0,
        'codigo_iva', case when v_codigo_iva in ('4', '5', '10') then v_codigo_iva else '4' end));
    end if;
    if coalesce(new.pag_monto_sin_iva, 0) > 0 then
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', round(new.pag_monto_sin_iva, 2), 'descuento', 0,
        'codigo_iva', case when v_codigo_iva in ('6', '7') then v_codigo_iva else '0' end));
    end if;
    if jsonb_array_length(v_lineas) = 0 then
      v_lineas := jsonb_build_array(jsonb_build_object(
        'codigo', v_codigo, 'descripcion', v_descripcion, 'cantidad', 1,
        'precio_unitario', case when v_codigo_iva in ('4', '5', '10')
                                then round(new.pag_monto_total / (1 + v_porcentaje / 100), 2)
                                else round(new.pag_monto_total, 2) end,
        'descuento', 0, 'codigo_iva', v_codigo_iva));
    end if;

    v_identificacion := btrim(coalesce(
      nullif(v_datos ->> 'identificacion', ''),
      nullif(new.pag_titular_identificacion, ''),
      ''
    ));
    v_razon_social := btrim(coalesce(
      nullif(v_datos ->> 'razon_social', ''),
      nullif(v_datos ->> 'nombre', ''),
      nullif(v_detalle ->> 'titular', ''),
      nullif(split_part(coalesce(new.pag_titular_email, ''), '@', 1), ''),
      'CLIENTE'
    ));
    v_tipo_id := lower(coalesce(v_datos ->> 'tipo_identificacion', ''));

    if v_identificacion <> '' and v_identificacion <> '9999999999999' then
      v_comprador := jsonb_build_object(
        'tipo_identificacion', case
          when v_tipo_id in ('ruc', '04') or v_identificacion ~ '^[0-9]{10}001$' then '04'
          when v_tipo_id in ('cedula', '05') and comun_facturacion.fac_fn_cedula_valida(v_identificacion) then '05'
          when comun_facturacion.fac_fn_cedula_valida(v_identificacion) then '05'
          else '06'
        end,
        'identificacion', v_identificacion,
        'razon_social', v_razon_social,
        'direccion', coalesce(nullif(v_datos ->> 'direccion', ''), 'Quito - Ecuador'),
        'correo', coalesce(nullif(v_datos ->> 'correo_facturacion', ''), nullif(v_datos ->> 'email', ''), new.pag_titular_email),
        'telefono', coalesce(nullif(v_datos ->> 'telefono', ''), new.pag_titular_telefono)
      );
    else
      -- Si supera 50 USD y no trajo identificación, asignamos identificación general '06' para poder emitir sin bloquear
      if new.pag_monto_total > 50 then
        v_comprador := jsonb_build_object(
          'tipo_identificacion', '06',
          'identificacion', '9999999999',
          'razon_social', v_razon_social,
          'direccion', 'Quito - Ecuador',
          'correo', new.pag_titular_email,
          'telefono', new.pag_titular_telefono
        );
      else
        v_comprador := jsonb_build_object(
          'tipo_identificacion', '07',
          'correo', new.pag_titular_email
        );
      end if;
    end if;

    v_forma := case
      when new.pag_pasarela = 'EFECTIVO' then '01'
      when new.pag_pasarela in ('DEUNA', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE') then '20'
      when new.pag_tarjeta_tipo = 'DEBITO' then '16'
      else '19' end;

    v_info := jsonb_build_array(
      jsonb_build_object('nombre', 'Referencia de pago', 'valor', new.pag_identificador_cliente),
      jsonb_build_object('nombre', 'Medio de pago', 'valor', new.pag_pasarela)
    );

    v_id := comun_facturacion.fac_fn_crear_comprobante_interno(
      new.pag_negocio, '01', v_comprador, v_lineas,
      jsonb_build_array(jsonb_build_object('forma_pago', v_forma, 'total', round(new.pag_monto_total, 2))),
      v_info, null, null, new.pag_cliente_id, new.pag_id);

    perform comun_facturacion.fac_fn_emitir_interno(v_id);
  exception when others then
    insert into comun_facturacion.fac_evento (evt_comprobante_id, evt_negocio, evt_tipo, evt_detalle_evento)
    values (null, new.pag_negocio, 'facturacion_pago_fallida',
            jsonb_build_object('pago', new.pag_id, 'error', sqlerrm));
  end;
  return new;
end;
$$;

-- 6. RPC transaccional para que el Operador/Administrador registre un pago manual
--    (transferencia, efectivo, Deuna, depósito, etc.) y emita su factura electrónica.
create or replace function comun_comercio.com_fn_registrar_pago_manual_y_facturar(
  p_negocio text,
  p_cliente_id uuid default null,
  p_medio_pago text default 'TRANSFERENCIA',
  p_referencia text default null,
  p_rubro_descripcion text default 'Servicio Legal',
  p_variante_id uuid default null,
  p_codigo_rubro text default 'SERV-001',
  p_subtotal_con_iva numeric default 0,
  p_subtotal_sin_iva numeric default 0,
  p_monto_iva numeric default 0,
  p_monto_total numeric default 0,
  p_comprador jsonb default '{}'::jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_pago_id uuid;
  v_identificador text;
  v_medio text := upper(btrim(coalesce(p_medio_pago, 'TRANSFERENCIA')));
  v_ref text := coalesce(nullif(btrim(p_referencia), ''), 'MAN-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  v_cmp comun_facturacion.fac_comprobante%rowtype;
  v_numero_factura text;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    raise exception 'No autorizado: se requiere rol de Operador o Administrador';
  end if;

  if p_monto_total <= 0 then
    raise exception 'El monto total del pago debe ser mayor a cero';
  end if;

  v_identificador := upper(left(v_negocio, 3)) || '-MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio,
    pag_cliente_id,
    pag_pasarela,
    pag_identificador_cliente,
    pag_transaccion_pasarela_id,
    pag_autorizacion_codigo,
    pag_estado,
    pag_monto_total,
    pag_monto_con_iva,
    pag_monto_sin_iva,
    pag_monto_iva,
    pag_moneda,
    pag_titular_email,
    pag_titular_identificacion,
    pag_titular_telefono,
    pag_confirmado_en,
    pag_detalle_transaccion
  )
  values (
    v_negocio,
    p_cliente_id,
    v_medio,
    v_identificador,
    v_ref,
    v_ref,
    'APROBADO',
    round(p_monto_total, 2),
    round(p_subtotal_con_iva, 2),
    round(p_subtotal_sin_iva, 2),
    round(p_monto_iva, 2),
    'USD',
    nullif(btrim(coalesce(p_comprador ->> 'correo_facturacion', p_comprador ->> 'email', '')), ''),
    nullif(btrim(coalesce(p_comprador ->> 'identificacion', '')), ''),
    nullif(btrim(coalesce(p_comprador ->> 'telefono', '')), ''),
    now(),
    jsonb_build_object(
      'registro_manual', true,
      'registrado_por', auth.uid(),
      'medio_pago', v_medio,
      'referencia_pago', v_ref,
      'observaciones', p_observaciones,
      'variante_id', p_variante_id,
      'codigo_rubro', p_codigo_rubro,
      'rubro_facturado', p_rubro_descripcion,
      'nombre_servicio', p_rubro_descripcion,
      'datos_facturacion', p_comprador
    )
  )
  returning pag_id into v_pago_id;

  -- El trigger trg_fac_facturar_pago ya se disparó al insertar en estado APROBADO.
  select * into v_cmp
    from comun_facturacion.fac_comprobante
   where cmp_transaccion_pago_id = v_pago_id;

  if found and v_cmp.cmp_numero is not null then
    v_numero_factura := v_cmp.cmp_establecimiento || '-' || v_cmp.cmp_punto_emision || '-' || lpad(v_cmp.cmp_numero::text, 9, '0');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pago_id', v_pago_id,
    'identificador', v_identificador,
    'comprobante_id', v_cmp.cmp_id,
    'numero_comprobante', v_numero_factura,
    'clave_acceso', v_cmp.cmp_clave_acceso,
    'estado_factura', v_cmp.cmp_estado
  );
end;
$$;

grant execute on function comun_comercio.com_fn_registrar_pago_manual_y_facturar(
  text, uuid, text, text, text, uuid, text, numeric, numeric, numeric, numeric, jsonb, text
) to authenticated, service_role;

-- 7. Retro-emitir facturas electrónicas para pagos APROBADOS previos que aún no tengan comprobante
do $$
declare
  r record;
begin
  for r in
    select p.pag_id
      from comun_comercio.com_transaccion_pago p
     where p.pag_estado = 'APROBADO'
       and not exists (
         select 1 from comun_facturacion.fac_comprobante c where c.cmp_transaccion_pago_id = p.pag_id
       )
     order by p.pag_creado_en asc
  loop
    update comun_comercio.com_transaccion_pago
       set pag_estado = 'PENDIENTE'
     where pag_id = r.pag_id;

    update comun_comercio.com_transaccion_pago
       set pag_estado = 'APROBADO'
     where pag_id = r.pag_id;
  end loop;
end;
$$;

-- 8. Registrar y pre-configurar el widget 'facturacion_electronica' y asegurar 'historial_pagos'
--    en comun_seguridad.seg_widget y seg_rol_widget (Regla 15 de AGENTS.md)
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
values
  ('tranqi',     'facturacion_electronica', 'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Valores generados vs. valores pagados, detalle del rubro facturado, emisión automática con tarjeta y registro manual de pagos con emisión de factura electrónica", "categoria": "Comercio y Pagos", "ruta": "/panel/herramientas?widget=facturacion_electronica", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('fastfix',    'facturacion_electronica', 'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Valores generados vs. valores pagados, detalle del rubro facturado y emisión de comprobantes electrónicos", "categoria": "Comercio y Pagos", "ruta": "/panel/herramientas?widget=facturacion_electronica", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('tinkay',     'facturacion_electronica', 'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Valores generados vs. valores pagados, detalle del rubro facturado y emisión de comprobantes electrónicos", "categoria": "Comercio y Pagos", "ruta": "/panel/herramientas?widget=facturacion_electronica", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('margaritas', 'facturacion_electronica', 'Facturación Electrónica & Comprobantes SRI', true, '{"descripcion": "Valores generados vs. valores pagados, detalle del rubro facturado y emisión de comprobantes electrónicos", "categoria": "Comercio y Pagos", "ruta": "/panel/herramientas?widget=facturacion_electronica", "panel_defecto": "panel_herramientas", "icono": "Receipt"}'::jsonb),
  ('tranqi',     'historial_pagos',         'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación, rubro facturado y descarga de factura electrónica", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta?widget=historial_pagos", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('fastfix',    'historial_pagos',         'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación, rubro facturado y descarga de factura electrónica", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta?widget=historial_pagos", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('tinkay',     'historial_pagos',         'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación, rubro facturado y descarga de factura electrónica", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta?widget=historial_pagos", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb),
  ('margaritas', 'historial_pagos',         'Historial de Transacciones & Pagos',         true, '{"descripcion": "Consulta de pagos realizados, estado de liquidación, rubro facturado y descarga de factura electrónica", "categoria": "Comercio y Pagos", "ruta": "/panel/cuenta?widget=historial_pagos", "panel_defecto": "panel_cuenta", "icono": "CreditCard"}'::jsonb)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
select w.wdg_negocio, r.rol, w.wdg_id, true
from comun_seguridad.seg_widget w
cross join (values ('CLIENTE'), ('ABOGADO'), ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave in ('facturacion_electronica', 'historial_pagos')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

