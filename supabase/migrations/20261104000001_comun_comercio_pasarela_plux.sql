-- ==============================================================================
-- Migración: 20261104000001_comun_comercio_pasarela_plux.sql
-- Módulo: Pasarela PLUX (PagoPlux) para el checkout (TRQ-ADM-004 / PLT-009).
-- ==============================================================================
--
-- PLUX es el botón de pagos (paybox) de PagoPlux: el navegador abre su modal,
-- la tarjeta nunca pasa por nuestros servidores, y PLUX avisa del resultado
-- con un webhook. Ese webhook es la única fuente de verdad: lo que diga el
-- navegador (onAuthorize) no marca nada como pagado.
--
-- Tres piezas:
--   1. Visibilidad restringida. Mientras PLUX esté en sandbox, una tarjeta de
--      prueba "paga" de verdad un plan real. Por eso una pasarela puede
--      marcarse solo para probadores (psc_detalle_pasarela.visibilidad) y
--      com_fn_obtener_pasarelas_activas la oculta al resto.
--   2. com_fn_preparar_pago_plux: el monto sale de com_variante, nunca del
--      navegador, y queda congelado en com_transaccion_pago.
--   3. com_fn_confirmar_pago_plux: la llama solo la Edge Function plux-webhook
--      (service_role). Aprueba de forma idempotente, coteja el monto y activa
--      la suscripción en la misma transacción.

-- ------------------------------------------------------------------------------
-- 1. Visibilidad de una pasarela para quien llama
-- ------------------------------------------------------------------------------
-- Una pasarela en PRUEBAS solo la ven los probadores, se haya declarado o no:
-- con un sandbox, una tarjeta de prueba activaría un plan real. En PRODUCCION
-- la ve todo el mundo salvo que se restrinja a mano.
-- psc_detalle_pasarela:
--   { "visibilidad": "TODOS" | "PROBADORES", "probadores": ["correo@...", ...] }
create or replace function comun_comercio.com_fn_pasarela_visible(p_ambiente text, p_detalle jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_ambiente = 'PRODUCCION' and coalesce(p_detalle->>'visibilidad', 'TODOS') <> 'PROBADORES')
      or comun_seguridad.seg_fn_es_superadmin()
      or exists (
           select 1
           from comun_seguridad.seg_usuario u
           cross join lateral jsonb_array_elements_text(
             case when jsonb_typeof(p_detalle->'probadores') = 'array' then p_detalle->'probadores'
                  else '[]'::jsonb end) p(correo)
           where u.usu_id = auth.uid()
             and lower(u.usu_correo) = lower(trim(p.correo))
         );
$$;

revoke execute on function comun_comercio.com_fn_pasarela_visible(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_pasarela_visible(text, jsonb) to authenticated;

-- Misma firma que la original (20260905000001): solo se añade el filtro de
-- visibilidad y el de borrado lógico.
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
    psc_pasarela,
    psc_nombre_visible,
    psc_ambiente,
    psc_credenciales_publicas,
    psc_comision_porcentaje,
    psc_orden_visual
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = p_negocio
    and psc_activo = true
    and psc_eliminado_en is null
    and psc_credenciales_publicas is not null
    and psc_credenciales_publicas <> '{}'::jsonb
    and comun_comercio.com_fn_pasarela_visible(psc_ambiente, psc_detalle_pasarela)
  order by psc_orden_visual asc;
$$;

-- ------------------------------------------------------------------------------
-- 2. Fila de configuración de PLUX para tranqi
-- ------------------------------------------------------------------------------
-- Nace INACTIVA y sin credenciales privadas: esas no van en el repositorio.
-- Se cargan y se activa con un UPDATE manual (ver
-- supabase/functions/README.md, sección plux-webhook).
-- PayboxRemail (correo del comercio en PLUX) no es secreto: lo lleva el
-- propio botón en el navegador.
insert into comun_comercio.com_pasarela_configuracion (
  psc_negocio, psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo,
  psc_credenciales_publicas, psc_orden_visual, psc_detalle_pasarela)
values (
  'tranqi', 'PLUX', 'PLUX (Tarjeta de Crédito / Débito)', 'PRUEBAS', false,
  jsonb_build_object('remail', 'admin.operaciones@tranqi24.com', 'nombre_comercio', 'Tranqi'),
  1,
  jsonb_build_object('visibilidad', 'PROBADORES', 'probadores', '[]'::jsonb))
on conflict (psc_negocio, psc_pasarela) do nothing;

-- ------------------------------------------------------------------------------
-- 3. Preparar un pago: el servidor fija el monto
-- ------------------------------------------------------------------------------
-- var_precio es base imponible sin IVA (ADR-0003). Todo el cálculo va en
-- centavos enteros para que base + IVA = total sin descuadres de redondeo.
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
  where psc_negocio = p_negocio
    and psc_pasarela = 'PLUX'
    and psc_activo = true
    and psc_eliminado_en is null;

  if not found or not comun_comercio.com_fn_pasarela_visible(v_pasarela.psc_ambiente, v_pasarela.psc_detalle_pasarela) then
    return jsonb_build_object('ok', false, 'error', 'PLUX no está disponible para esta cuenta.');
  end if;

  select v.* into v_variante
  from comun_comercio.com_variante v
  where v.var_id = p_variante_id
    and v.var_negocio = p_negocio
    and v.var_activo = true
    and v.var_eliminado_en is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El producto ya no está disponible.');
  end if;

  select pro_nombre into v_producto
  from comun_comercio.com_producto
  where pro_id = v_variante.var_producto_id
    and pro_negocio = p_negocio
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

  -- Va en PayboxExtras y vuelve en el webhook: es lo que liga el pago al
  -- registro. 12 hex = 48 bits, imposible de adivinar para forzar otro.
  v_identificador := 'TRQ-PLX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into comun_comercio.com_transaccion_pago (
    pag_negocio, pag_cliente_id, pag_pasarela, pag_identificador_cliente, pag_estado,
    pag_monto_total, pag_monto_con_iva, pag_monto_sin_iva, pag_monto_iva, pag_moneda,
    pag_titular_email, pag_titular_telefono, pag_titular_identificacion,
    pag_detalle_transaccion)
  values (
    p_negocio, v_usuario, 'PLUX', v_identificador, 'PENDIENTE',
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
    'nombre_comercio', coalesce(v_pasarela.psc_credenciales_publicas->>'nombre_comercio', p_negocio),
    'descripcion', coalesce(v_producto || ' - ', '') || v_variante.var_nombre,
    'base_centavos', v_base_c,
    'iva_centavos', v_iva_c,
    'total_centavos', v_total_c);
end;
$$;

revoke execute on function comun_comercio.com_fn_preparar_pago_plux(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_preparar_pago_plux(text, uuid, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. Confirmar un pago (solo webhook)
-- ------------------------------------------------------------------------------
-- p_notificacion es el cuerpo del webhook de PLUX tal cual:
--   { state: 'PAGADO' | ..., amount, extras, id_transaccion, token,
--     cardInfo, cardIssuer, cardType, ... }
-- PLUX reintenta: una segunda llamada sobre un pago ya resuelto no cambia nada.
-- p_negocio es el de las credenciales que autenticaron el webhook: el de un
-- negocio no puede aprobar pagos de otro.
create or replace function comun_comercio.com_fn_confirmar_pago_plux(p_negocio text, p_notificacion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago comun_comercio.com_transaccion_pago%rowtype;
  v_variante comun_comercio.com_variante%rowtype;
  v_estado text;
  v_motivo text;
  v_monto numeric;
  v_frecuencia text;
  v_suscripcion uuid;
begin
  select * into v_pago
  from comun_comercio.com_transaccion_pago
  where pag_negocio = p_negocio
    and pag_identificador_cliente = p_notificacion->>'extras'
    and pag_pasarela = 'PLUX'
    and pag_eliminado_en is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'PAGO_DESCONOCIDO');
  end if;

  if v_pago.pag_estado <> 'PENDIENTE' then
    return jsonb_build_object('ok', true, 'repetido', true, 'estado', v_pago.pag_estado);
  end if;

  -- Un monto ilegible cuenta como distinto: una excepción aquí haría que PLUX
  -- reintentara sin fin.
  v_monto := case when p_notificacion->>'amount' ~ '^[0-9]+(\.[0-9]+)?$'
                  then (p_notificacion->>'amount')::numeric end;

  if p_notificacion->>'state' is distinct from 'PAGADO' then
    v_estado := 'RECHAZADO';
    v_motivo := coalesce(p_notificacion->>'state', 'SIN_ESTADO');
  elsif v_monto is null or abs(v_monto - v_pago.pag_monto_total) >= 0.005 then
    -- Pagó otra cantidad de la que fijamos: no se activa nada y queda para
    -- revisión manual en el historial.
    v_estado := 'RECHAZADO';
    v_motivo := 'MONTO_DISTINTO';
  else
    v_estado := 'APROBADO';
  end if;

  update comun_comercio.com_transaccion_pago
     set pag_estado = v_estado,
         pag_transaccion_pasarela_id = p_notificacion->>'id_transaccion',
         pag_autorizacion_codigo = p_notificacion->>'token',
         pag_tarjeta_tipo = case lower(p_notificacion->>'cardType')
                              when 'credit' then 'CREDITO'
                              when 'debit' then 'DEBITO'
                            end,
         pag_tarjeta_marca = upper(p_notificacion->>'cardIssuer'),
         pag_tarjeta_ultimos_digitos = right(p_notificacion->>'cardInfo', 4),
         pag_confirmado_en = case when v_estado = 'APROBADO' then now() end,
         pag_detalle_transaccion = pag_detalle_transaccion
           || jsonb_build_object('webhook', p_notificacion, 'motivo', v_motivo),
         pag_actualizado_en = now()
   where pag_id = v_pago.pag_id;

  if v_estado <> 'APROBADO' then
    return jsonb_build_object('ok', true, 'estado', v_estado, 'motivo', v_motivo);
  end if;

  -- Un plan recurrente nace como suscripción ACTIVA. Sus derechos de consumo
  -- no se copian: com_fn_cobertura_usuario y com_fn_consumir_derecho los leen
  -- de la variante.
  select * into v_variante
  from comun_comercio.com_variante
  where var_id = (v_pago.pag_detalle_transaccion->>'variante_id')::uuid;

  if found and v_pago.pag_cliente_id is not null
     and (v_variante.var_tipo_oferta like 'RECURRENTE%' or v_variante.var_frecuencia_recurrencia is not null) then
    v_frecuencia := coalesce(v_variante.var_frecuencia_recurrencia,
                             case when v_variante.var_tipo_oferta = 'RECURRENTE_ANUAL' then 'ANUAL' else 'MENSUAL' end);

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

-- Ni authenticated ni anon: quien la pudiera llamar se aprobaría sus pagos.
revoke execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_confirmar_pago_plux(text, jsonb) to service_role;

-- Credenciales del webhook para la Edge Function (service_role). Devuelve el
-- par Basic esperado; nunca se expone a authenticated.
create or replace function comun_comercio.com_fn_credenciales_webhook_plux(p_negocio text)
returns table (cliente_id text, clave_secreta text)
language sql
stable
security definer
set search_path = ''
as $$
  select psc_credenciales_privadas->>'cliente_id',
         psc_credenciales_privadas->>'clave_secreta'
  from comun_comercio.com_pasarela_configuracion
  where psc_negocio = p_negocio
    and psc_pasarela = 'PLUX'
    and psc_activo = true
    and psc_eliminado_en is null;
$$;

revoke execute on function comun_comercio.com_fn_credenciales_webhook_plux(text) from public, anon, authenticated;
grant execute on function comun_comercio.com_fn_credenciales_webhook_plux(text) to service_role;
