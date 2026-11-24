-- =============================================================================
-- Migración: 20261124000001_estados_pedido_personalizables_taller_y_envoltorio_colecciones.sql
-- Descripción:
--   1) Helper SQL `com_fn_estado_pedido_visible_en_taller` que evalúa la
--      configuración editable `estados_pedidos` en `cfg_negocio` (propiedad
--      `visibleEnTaller`) para definir si un estado es visible en Taller.
--   2) Actualiza `com_fn_registrar_pedido_tienda` para aceptar los estados
--      iniciales `NUEVO_POR_CONFIRMAR` (Transferencia) y `NUEVO_CONFIRMADO`.
--   3) Actualiza `com_fn_confirmar_pago_plux` para pasar pedidos directos de
--      tienda pagados con tarjeta a `NUEVO_CONFIRMADO` y sincronizar Taller.
--   4) Actualiza `com_fn_actualizar_estado_pedido_tienda` para aceptar estados
--      personalizados creados por el Administrador y sincronizar la visibilidad
--      en `com_orden_taller` según `visibleEnTaller`.
--   5) Actualiza `com_fn_sincronizar_ventas_a_ordenes_taller` y
--      `com_fn_obtener_consola_taller_y_despacho` para respetar `visibleEnTaller`.
--   6) Backfill idempotente del tipo de envoltorio y colores por colección en
--      Tinkay (`Para Florero` y `Estilo Coreano` -> Papel Claros/Oscuros/Tonos Pastel;
--      `BOX` -> Base Blanco/Negro/Rosado; resto de colecciones -> No aplica).
-- =============================================================================

-- 1. Helper: Determinar si un estado de pedido debe mostrarse en Taller según cfg_negocio
create or replace function comun_comercio.com_fn_estado_pedido_visible_en_taller(
  p_negocio text,
  p_estado text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_estado text := upper(btrim(coalesce(p_estado, '')));
  v_estados jsonb;
  v_item jsonb;
begin
  if v_estado = '' or v_estado in ('VALIDADO', 'CONVENIO_IESS', 'PAGADO', 'ABONADO') then
    return true;
  end if;

  select cfg_detalle_configuracion->'estados_pedidos'
    into v_estados
    from comun_configuracion.cfg_negocio
   where comun_seguridad.seg_fn_normalizar_negocio(cfg_negocio) = v_negocio
   limit 1;

  if jsonb_typeof(v_estados) = 'array' then
    for v_item in select * from jsonb_array_elements(v_estados) loop
      if upper(btrim(coalesce(v_item->>'valor', ''))) = v_estado then
        if jsonb_typeof(v_item->'visibleEnTaller') = 'boolean' then
          return (v_item->>'visibleEnTaller')::boolean;
        elsif jsonb_typeof(v_item->'visible_en_taller') = 'boolean' then
          return (v_item->>'visible_en_taller')::boolean;
        end if;
      end if;
    end loop;
  end if;

  -- Valores por defecto coherentes con ESTADOS_PEDIDO_DEFECTO
  if v_estado in ('NUEVO_POR_CONFIRMAR', 'ENVIADA', 'PENDIENTE_PAGO', 'NO_ACEPTADA', 'CANCELADO') then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function comun_comercio.com_fn_estado_pedido_visible_en_taller(text, text) to authenticated, service_role;

-- 2. Actualizar com_fn_registrar_pedido_tienda para aceptar NUEVO_POR_CONFIRMAR y NUEVO_CONFIRMADO
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
  v_prefijo text := case
    when v_negocio like '%tinkay%' then 'TNK'
    when v_negocio like '%margarita%' then 'MRG'
    when v_negocio like '%fastfix%' then 'FFH'
    else 'TRQ'
  end;
  v_usuario uuid := auth.uid();
  v_comprador jsonb := coalesce(p_payload->'comprador', '{}'::jsonb);
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_logistica jsonb := coalesce(p_payload->'logistica_entrega', '{}'::jsonb);
  v_estado_inicial text := upper(coalesce(nullif(trim(p_payload->>'estado'), ''), 'NUEVO_POR_CONFIRMAR'));
  v_subtotal numeric(12,2) := greatest(0, coalesce((p_payload->>'subtotal_base_imponible')::numeric(12,2), 0));
  v_iva numeric(12,2) := greatest(0, coalesce((p_payload->>'total_iva')::numeric(12,2), 0));
  v_total numeric(12,2) := greatest(0, coalesce((p_payload->>'total_pagar')::numeric(12,2), 0));
  v_tipo_comprador text := case when v_usuario is not null then 'USUARIO_REGISTRADO' else 'USUARIO_NO_AUTORIZADO' end;
  v_cli_id uuid;
  v_prf_id uuid;
  v_secuencial bigint;
  v_token text;
  v_codigo text;
  v_item jsonb;
  v_payload_final jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El pedido debe incluir al menos un producto.');
  end if;

  if v_estado_inicial not in ('NUEVO_POR_CONFIRMAR', 'NUEVO_CONFIRMADO', 'PENDIENTE_PAGO', 'APROBADA') then
    v_estado_inicial := 'NUEVO_POR_CONFIRMAR';
  end if;

  v_cli_id := comun_comercio.com_fn_capturar_cliente_compra(
    v_negocio,
    v_usuario,
    v_comprador,
    null,
    (p_payload ? 'regalo_primera_compra')
  );

  v_payload_final := p_payload || jsonb_build_object(
    'estado', v_estado_inicial,
    'tipo_comprador', v_tipo_comprador,
    'usuario_autorizado', (v_usuario is not null),
    'cliente_capturado_id', v_cli_id
  );

  insert into comun_comercio.com_proforma (
    prf_negocio, prf_cliente_id, prf_cliente_nombre, prf_cliente_contacto, prf_estado,
    prf_subtotal, prf_descuento, prf_iva, prf_total, prf_observaciones, prf_detalle_proforma
  )
  values (
    v_negocio, v_usuario,
    coalesce(nullif(trim(v_comprador->>'nombreCompleto'), ''), 'Cliente'),
    v_comprador || jsonb_build_object('tipo_comprador', v_tipo_comprador),
    v_estado_inicial, v_subtotal, 0, v_iva, v_total,
    coalesce(p_payload->>'observaciones', ''),
    v_payload_final
  )
  returning prf_id, prf_secuencial, prf_token_aprobacion
  into v_prf_id, v_secuencial, v_token;

  v_codigo := v_prefijo || '-ORD-' || lpad(coalesce(v_secuencial, 1)::text, 4, '0');

  update comun_comercio.com_proforma
     set prf_detalle_proforma = prf_detalle_proforma || jsonb_build_object('codigo_orden', v_codigo)
   where prf_id = v_prf_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    insert into comun_comercio.com_proforma_item (
      pfi_negocio, pfi_proforma_id, pfi_variante_id, pfi_es_item_libre,
      pfi_descripcion, pfi_cantidad, pfi_precio_unitario, pfi_descuento,
      pfi_impuesto, pfi_total_linea, pfi_detalle_item
    )
    values (
      v_negocio, v_prf_id, null, true,
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
    dsp_negocio, dsp_orden_id, dsp_modalidad, dsp_tracking_url, dsp_costo_envio,
    dsp_estado, dsp_observaciones_coordinacion, dsp_detalle_despacho
  )
  values (
    v_negocio, v_prf_id,
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
    'token_aprobacion', v_token,
    'tipo_comprador', v_tipo_comprador,
    'estado', v_estado_inicial
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_registrar_pedido_tienda(text, jsonb) to anon, authenticated, service_role;

-- 3. Actualizar com_fn_actualizar_estado_pedido_tienda para aceptar estados personalizables y sincronizar Taller
create or replace function comun_comercio.com_fn_actualizar_estado_pedido_tienda(
  p_negocio text,
  p_pedido_id uuid,
  p_nuevo_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_rol_actor text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_estado text := upper(btrim(coalesce(p_nuevo_estado, '')));
  v_actor_nombre text;
  v_prf record;
  v_det jsonb;
  v_prefijo text;
  v_codigo text;
  v_estado_anterior text;
  v_visible_taller boolean := true;
  v_estado_taller_sync text := null;
  v_repartidor_id uuid := null;
  v_ahora timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión.');
  end if;

  if v_rol_actor not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para actualizar el estado de pedidos.');
  end if;

  if v_estado !~ '^[A-Z0-9_]{2,48}$' then
    return jsonb_build_object('ok', false, 'error', 'Código de estado de pedido no válido: ' || v_estado);
  end if;

  select *
    into v_prf
    from comun_comercio.com_proforma p
   where p.prf_id = p_pedido_id
     and comun_seguridad.seg_fn_normalizar_negocio(p.prf_negocio) = v_negocio
     and p.prf_eliminado_en is null
   for update;

  if v_prf.prf_id is null then
    return jsonb_build_object('ok', false, 'error', 'Pedido no encontrado en este negocio.');
  end if;

  select coalesce(
    nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
    split_part(coalesce(u.usu_correo, ''), '@', 1),
    'Equipo'
  )
    into v_actor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_det := coalesce(v_prf.prf_detalle_proforma, '{}'::jsonb);
  v_estado_anterior := upper(coalesce(v_prf.prf_estado, v_det->>'estado', 'PENDIENTE_PAGO'));

  v_prefijo := case v_negocio
    when 'tinkay' then 'TNK'
    when 'margaritas' then 'MRG'
    when 'fastfix' then 'FFH'
    else 'TRQ'
  end;

  v_codigo := coalesce(
    nullif(btrim(coalesce(v_det->>'codigo_proforma', '')), ''),
    nullif(btrim(coalesce(v_det->>'codigo_orden', '')), ''),
    v_prefijo || '-' || case when coalesce(v_det->>'tipo_origen', '') = 'PROFORMA_EVENTO' then 'PRF' else 'ORD' end || '-' || lpad(coalesce(v_prf.prf_secuencial, 1)::text, 4, '0')
  );

  v_visible_taller := comun_comercio.com_fn_estado_pedido_visible_en_taller(v_negocio, v_estado);

  if v_estado = 'EN_PREPARACION' then
    v_estado_taller_sync := 'EN_PREPARACION';
  elsif v_estado = 'EN_RUTA' then
    v_estado_taller_sync := 'LISTO_ENTREGA';
  elsif v_estado = 'ENTREGADO' then
    v_estado_taller_sync := 'ENTREGADO';
  elsif v_estado in ('CANCELADO', 'NO_ACEPTADA') then
    v_estado_taller_sync := 'ANULADO';
  elsif not v_visible_taller then
    v_estado_taller_sync := 'PENDIENTE_ENVIO';
  else
    v_estado_taller_sync := 'ENVIADO_TALLER';
  end if;

  v_det := v_det || jsonb_build_object('estado_taller', v_estado_taller_sync);

  update comun_comercio.com_proforma
     set prf_estado = v_estado,
         prf_detalle_proforma = v_det || jsonb_build_object('estado', v_estado),
         prf_actualizado_en = v_ahora
   where prf_id = v_prf.prf_id;

  -- Sincronizar orden de taller asociada si existe
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    update comun_comercio.com_orden_taller
       set ota_estado_pago = v_estado,
           ota_estado_taller = case
             when v_estado_taller_sync = 'ENVIADO_TALLER' and ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO') then ota_estado_taller
             else v_estado_taller_sync
           end,
           ota_enviado_taller_en = case when v_visible_taller then coalesce(ota_enviado_taller_en, v_ahora) else ota_enviado_taller_en end,
           ota_entregado_en = case when v_estado = 'ENTREGADO' then coalesce(ota_entregado_en, v_ahora) else ota_entregado_en end,
           ota_actualizado_en = v_ahora
     where ota_proforma_id = v_prf.prf_id
       and ota_eliminado_en is null
     returning ota_repartidor_id into v_repartidor_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pedidoId', v_prf.prf_id,
    'codigoOrden', v_codigo,
    'estadoAnterior', v_estado_anterior,
    'nuevoEstado', v_estado,
    'visibleEnTaller', v_visible_taller,
    'compradorNombre', coalesce(v_prf.prf_cliente_nombre, v_det #>> '{comprador,nombreCompleto}', 'Cliente'),
    'totalUsd', coalesce(v_prf.prf_total, 0),
    'clienteUsuarioId', v_prf.prf_cliente_id,
    'repartidorAsignadoId', v_repartidor_id,
    'actorNombre', coalesce(v_actor_nombre, 'Equipo')
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_actualizar_estado_pedido_tienda(text, uuid, text) from public, anon;
grant execute on function comun_comercio.com_fn_actualizar_estado_pedido_tienda(text, uuid, text) to authenticated, service_role;

-- 4. Actualizar com_fn_confirmar_pago_plux para pasar pedidos directos de tienda a NUEVO_CONFIRMADO
create or replace function comun_comercio.com_fn_confirmar_pago_plux(p_negocio text, p_notificacion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tranqi'));
  v_payload jsonb;
  v_pago comun_comercio.com_transaccion_pago%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_prf comun_comercio.com_proforma%rowtype;
  v_prf_id uuid;
  v_modalidad text;
  v_nuevo_abonado numeric(12,2);
  v_saldo numeric(12,2);
  v_nuevo_estado_prf text;
  v_visible_taller boolean := true;
  v_estado_raw text;
  v_estado text;
  v_motivo text;
  v_monto numeric;
  v_frecuencia text;
  v_suscripcion uuid;
  v_autorizacion text;
  v_marca text;
  v_ultimos4 text;
  v_factura_snap jsonb;
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
    return jsonb_build_object(
      'ok', true,
      'repetido', true,
      'estado', v_pago.pag_estado,
      'factura_electronica', v_pago.pag_detalle_transaccion->'factura_electronica'
    );
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

  -- A) Si corresponde a variante de suscripción
  if (v_pago.pag_detalle_transaccion ? 'variante_id') and (v_pago.pag_detalle_transaccion->>'variante_id') ~* '^[0-9a-f-]{36}$' then
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
        sub_monto_periodo, sub_proximo_cobro_en, sub_ultimo_cobro_en, sub_detalle_suscripcion
      )
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
        jsonb_build_object('pago_id', v_pago.pag_id, 'pasarela', 'PLUX')
      )
      returning sub_id into v_suscripcion;

      update comun_comercio.com_transaccion_pago
         set pag_referencia_id = v_suscripcion
       where pag_id = v_pago.pag_id;
    end if;
  end if;

  -- B) Si corresponde a Pedido de Tienda o Proforma de Evento
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
    where prf_id = v_prf_id and prf_negocio = v_pago.pag_negocio
    for update;

    if found then
      v_modalidad := upper(coalesce(v_pago.pag_detalle_transaccion->>'modalidad_cobro', 'TOTAL_100'));
      v_nuevo_abonado := round((coalesce((v_prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) + v_pago.pag_monto_total)::numeric, 2);
      v_saldo := greatest(0, round((v_prf.prf_total - v_nuevo_abonado)::numeric, 2));
      v_nuevo_estado_prf := case
        when v_saldo > 0.02 and v_modalidad = 'RESERVA_70' then 'RESERVADA_70'
        when coalesce(v_prf.prf_detalle_proforma->>'tipo_origen', '') = 'PROFORMA_EVENTO' then 'APROBADA'
        else 'NUEVO_CONFIRMADO'
      end;
      v_visible_taller := comun_comercio.com_fn_estado_pedido_visible_en_taller(v_prf.prf_negocio, v_nuevo_estado_prf);

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

      if to_regclass('comun_comercio.com_orden_taller') is not null then
        update comun_comercio.com_orden_taller
           set ota_estado_pago = v_nuevo_estado_prf,
               ota_estado_taller = case
                 when v_visible_taller and ota_estado_taller = 'PENDIENTE_ENVIO' then 'ENVIADO_TALLER'
                 else ota_estado_taller
               end,
               ota_enviado_taller_en = case
                 when v_visible_taller then coalesce(ota_enviado_taller_en, now())
                 else ota_enviado_taller_en
               end,
               ota_actualizado_en = now()
         where ota_proforma_id = v_prf.prf_id
           and ota_eliminado_en is null;
      end if;

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

  select pag_detalle_transaccion->'factura_electronica'
  into v_factura_snap
  from comun_comercio.com_transaccion_pago
  where pag_id = v_pago.pag_id;

  return jsonb_build_object(
    'ok', true,
    'estado', v_estado,
    'suscripcion_id', v_suscripcion,
    'proforma_id', v_prf_id,
    'factura_electronica', v_factura_snap
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) to service_role;

-- 5. Actualizar sincronizador de ventas y consola Taller para respetar visibleEnTaller
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
        or upper(coalesce(p.prf_estado, '')) in ('NUEVO_CONFIRMADO', 'ORDEN_CONFIRMADA', 'RESERVADA_70', 'APROBADA', 'EN_PREPARACION', 'EN_PRODUCCION', 'EN_RUTA', 'ENTREGADO')
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
      when comun_comercio.com_fn_estado_pedido_visible_en_taller(v_negocio, r.prf_estado) then 'ENVIADO_TALLER'
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
      string_agg(nullif(btrim(coalesce(it->'personalizacion_floral'->>'resumenTexto', it->>'colores', it->>'color', it->'personalizacion'->>'colores', '')), ''), ' · '),
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
      coalesce(r.prf_estado, 'NUEVO_POR_CONFIRMAR'),
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
      ota_negocio, ota_codigo, ota_origen_tipo, ota_clasificacion_pedido, ota_entrega_id,
      ota_estado_taller, ota_estado_pago, ota_metodo_pago, ota_fecha_pedido, ota_fecha_entrega,
      ota_fecha_elaboracion, ota_hora_especifica, ota_producto_resumen, ota_items,
      ota_cliente_solicita, ota_destinatario_fallecido, ota_sala_servicio, ota_ubicacion_entrega,
      ota_tarjeta_token, ota_tarjeta_tipo, ota_observaciones, ota_enviado_taller_en,
      ota_entregado_en, ota_entregado_por_nombre, ota_evidencia_foto_url, ota_evidencia_mapa_url,
      ota_evidencia_latitud, ota_evidencia_longitud, ota_evidencia_direccion_gps
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
      and (
        not v_es_solo_taller
        or (
          o.ota_estado_taller <> 'ANULADO'
          and comun_comercio.com_fn_estado_pedido_visible_en_taller(
            v_negocio,
            coalesce(p.prf_estado, o.ota_estado_pago)
          )
        )
      )
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

-- 6. Backfill idempotente de Envoltorio y Colores por Colección en Tinkay:
--    - "Para Florero" y "Estilo Coreano" -> Papel (Colores Claros / Oscuros / Tonos Pastel)
--    - "BOX" -> Base (Blanco / Negro / Rosado)
--    - Resto de colecciones -> No aplica (cliente no selecciona envoltorio ni base)
do $$
declare
  v_prod record;
  v_cat_texto text;
  v_tipo_env text;
  v_mostrar_base boolean;
  v_colores_base jsonb;
  v_pers_actual jsonb;
  v_pers_nueva jsonb;
begin
  for v_prod in
    select
      p.pro_id,
      p.pro_detalle_producto,
      coalesce(c.ctg_nombre, '') as ctg_nombre,
      coalesce(c.ctg_slug, '') as ctg_slug
    from comun_comercio.com_producto p
    left join comun_comercio.com_categoria c
      on c.ctg_id = p.pro_categoria_principal_id
    where lower(coalesce(p.pro_negocio, '')) in ('tinkay', 'tnk')
      and p.pro_eliminado_en is null
  loop
    v_cat_texto := lower(
      translate(
        coalesce(v_prod.ctg_nombre, '') || ' ' || coalesce(v_prod.ctg_slug, ''),
        'áéíóúÁÉÍÓÚñÑ',
        'aeiouaeiounn'
      )
    );

    if v_cat_texto ~ '(para[[:space:]]+florero|cat-floreros|\yfloreros?\y|estilo[[:space:]]+coreano|cat-coreanos|\ycoreanos?\y)' then
      v_tipo_env := 'papel_envoltorio';
      v_mostrar_base := true;
      v_colores_base := '["claros", "oscuros", "rosa"]'::jsonb;
    elsif v_cat_texto ~ '(box-florales|\ybox(es)?\y)' then
      v_tipo_env := 'base';
      v_mostrar_base := true;
      v_colores_base := '["blanco", "negro", "rosado"]'::jsonb;
    else
      v_tipo_env := 'no_aplica';
      v_mostrar_base := false;
      v_colores_base := '[]'::jsonb;
    end if;

    v_pers_actual := case
      when jsonb_typeof(v_prod.pro_detalle_producto->'personalizacion_floral') = 'object'
      then v_prod.pro_detalle_producto->'personalizacion_floral'
      else '{}'::jsonb
    end;

    v_pers_nueva := v_pers_actual || jsonb_build_object(
      'tipoEnvoltorio', v_tipo_env,
      'mostrarColorBase', v_mostrar_base,
      'coloresBaseDisponibles', v_colores_base
    );

    update comun_comercio.com_producto
       set pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb)
             || jsonb_build_object('personalizacion_floral', v_pers_nueva),
           pro_actualizado_en = now()
     where pro_id = v_prod.pro_id;
  end loop;
end $$;
