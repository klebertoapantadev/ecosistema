-- ==============================================================================
-- Migración: 20261107000001_comun_comercio_confirmar_pago_plux_directo.sql
-- Módulo: Confirmación inmediata de pago PLUX tras onAuthorize y normalización
--         de estados en webhook (TRQ-ADM-004).
-- ==============================================================================

create or replace function comun_comercio.com_fn_confirmar_pago_plux(p_negocio text, p_notificacion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_pago comun_comercio.com_transaccion_pago%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_estado_raw text;
  v_estado text;
  v_motivo text;
  v_monto numeric;
  v_frecuencia text;
  v_suscripcion uuid;
begin
  v_payload := case
    when jsonb_typeof(p_notificacion->'detail') = 'object' then p_notificacion || (p_notificacion->'detail')
    else coalesce(p_notificacion, '{}'::jsonb)
  end;

  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = p_negocio
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

  update comun_comercio.com_transaccion_pago
     set pag_estado = v_estado,
         pag_transaccion_pasarela_id = coalesce(v_payload->>'id_transaccion', v_payload->>'idTransaction', v_payload->>'token'),
         pag_autorizacion_codigo = coalesce(v_payload->>'token', v_payload->>'id_transaccion'),
         pag_tarjeta_tipo = case lower(coalesce(v_payload->>'cardType', ''))
                              when 'debit' then 'DEBITO'
                              else 'CREDITO'
                            end,
         pag_tarjeta_marca = upper(coalesce(v_payload->>'cardIssuer', 'TARJETA')),
         pag_tarjeta_ultimos_digitos = right(regexp_replace(coalesce(v_payload->>'cardInfo', ''), '\s+', '', 'g'), 4),
         pag_confirmado_en = case when v_estado = 'APROBADO' then now() end,
         pag_detalle_transaccion = pag_detalle_transaccion
           || jsonb_build_object('webhook', v_payload, 'motivo', v_motivo),
         pag_actualizado_en = now()
   where pag_id = v_pago.pag_id;

  if v_estado <> 'APROBADO' then
    return jsonb_build_object('ok', true, 'estado', v_estado, 'motivo', v_motivo);
  end if;

  select * into v_variante
  from comun_comercio.com_variante
  where var_id = (v_pago.pag_detalle_transaccion->>'variante_id')::uuid;

  if found and v_pago.pag_cliente_id is not null
     and (v_variante.var_tipo_oferta like 'RECURRENTE%' or v_variante.var_frecuencia_recurrencia is not null) then
    v_frecuencia := coalesce(v_variante.var_frecuencia_recurrencia,
                             case when v_variante.var_tipo_oferta = 'RECURRENTE_ANUAL' then 'ANUAL' else 'MENSUAL' end);

    -- Inactivar suscripciones previas (ej. plan gratuito inicial) para que prevalezca el nuevo plan pagado
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

  return jsonb_build_object('ok', true, 'estado', v_estado, 'suscripcion_id', v_suscripcion);
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) to service_role;

-- Permite que el cliente autenticado titular del pago confirme inmediatamente
-- la transacción autorizada por el paybox de PLUX (onAuthorize).
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
  v_cliente_pago uuid;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión requerida.');
  end if;

  select pag_cliente_id into v_cliente_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = p_negocio
    and pag_identificador_cliente = p_identificador
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null;

  if not found or v_cliente_pago is distinct from v_usuario then
    return jsonb_build_object('ok', false, 'error', 'Pago no encontrado para este usuario.');
  end if;

  return comun_comercio.com_fn_confirmar_pago_plux(
    p_negocio,
    coalesce(p_notificacion, '{}'::jsonb) || jsonb_build_object('extras', p_identificador)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux_cliente(text, text, jsonb) to authenticated, service_role;
