-- ==============================================================================
-- Migración: 20261125000005_rpc_guardar_configuracion_pasarela.sql
-- Requerimientos: PLT-006 / PLT-009 / TRQ-ADM-004 / TNK-002
-- Descripción:
--   Crea la RPC transaccional `comun_comercio.com_fn_guardar_configuracion_pasarela`
--   (SECURITY DEFINER) para que operadores/administradores/superadmins puedan guardar
--   o actualizar las credenciales públicas y privadas de PLUX / Payphone sin requerir
--   SELECT sobre `psc_credenciales_privadas` desde PostgREST (que se revocó en
--   20261105000001 por seguridad y causaba `permission denied for table com_pasarela_configuracion`
--   al hacer UPSERT directo desde Next.js como `authenticated`).
-- ==============================================================================

create or replace function comun_comercio.com_fn_guardar_configuracion_pasarela(
  p_negocio text,
  p_pasarela text,
  p_payload jsonb
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
  v_nombre_visible text;
  v_ambiente text;
  v_activo boolean;
  v_orden int;
  v_cred_pub jsonb;
  v_cred_priv_nueva jsonb;
  v_detalle jsonb;
  v_priv_actual jsonb;
  v_priv_final jsonb;
  v_nombre_comercio text;
  v_alguna_activa boolean := false;
  v_det_cfg jsonb;
  v_tienda_checkout jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para actualizar la pasarela de pagos.');
  end if;

  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para administrar pasarelas de pago en este negocio.');
  end if;

  if v_pasarela not in ('PLUX', 'PAYPHONE') then
    return jsonb_build_object('ok', false, 'error', 'Pasarela no soportada. Usa PLUX o PAYPHONE.');
  end if;
  v_otra := case when v_pasarela = 'PLUX' then 'PAYPHONE' else 'PLUX' end;

  v_nombre_visible := coalesce(
    nullif(btrim(p_payload->>'nombre_visible'), ''),
    case when v_pasarela = 'PLUX'
      then 'PLUX (Tarjeta de Crédito / Débito)'
      else 'Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)'
    end
  );
  v_ambiente := case
    when upper(btrim(coalesce(p_payload->>'ambiente', 'PRUEBAS'))) = 'PRODUCCION' then 'PRODUCCION'
    else 'PRUEBAS'
  end;
  v_activo := coalesce((p_payload->>'activo')::boolean, false);
  v_orden := coalesce(
    nullif(p_payload->>'orden_visual', '')::int,
    case when v_pasarela = 'PLUX' then 1 else 2 end
  );
  v_cred_pub := case
    when jsonb_typeof(p_payload->'credenciales_publicas') = 'object' then p_payload->'credenciales_publicas'
    else '{}'::jsonb
  end;
  v_cred_priv_nueva := case
    when jsonb_typeof(p_payload->'credenciales_privadas') = 'object' then p_payload->'credenciales_privadas'
    else null
  end;
  v_detalle := case
    when jsonb_typeof(p_payload->'detalle_pasarela') = 'object' then p_payload->'detalle_pasarela'
    else '{}'::jsonb
  end;

  select coalesce(psc_credenciales_privadas, '{}'::jsonb)
    into v_priv_actual
    from comun_comercio.com_pasarela_configuracion
   where psc_negocio = v_negocio
     and psc_pasarela = v_pasarela
   limit 1;

  v_priv_actual := coalesce(v_priv_actual, '{}'::jsonb);
  if v_cred_priv_nueva is not null and v_cred_priv_nueva <> '{}'::jsonb then
    v_priv_final := v_priv_actual || v_cred_priv_nueva;
  else
    v_priv_final := v_priv_actual;
  end if;

  insert into comun_comercio.com_pasarela_configuracion (
    psc_negocio,
    psc_pasarela,
    psc_nombre_visible,
    psc_ambiente,
    psc_activo,
    psc_orden_visual,
    psc_credenciales_publicas,
    psc_credenciales_privadas,
    psc_detalle_pasarela,
    psc_actualizado_en,
    psc_eliminado_en
  ) values (
    v_negocio,
    v_pasarela,
    v_nombre_visible,
    v_ambiente,
    v_activo,
    v_orden,
    v_cred_pub,
    v_priv_final,
    v_detalle,
    v_ahora,
    null
  )
  on conflict (psc_negocio, psc_pasarela) do update
    set psc_nombre_visible = excluded.psc_nombre_visible,
        psc_ambiente = excluded.psc_ambiente,
        psc_activo = excluded.psc_activo,
        psc_orden_visual = excluded.psc_orden_visual,
        psc_credenciales_publicas = excluded.psc_credenciales_publicas,
        psc_credenciales_privadas = case
          when v_cred_priv_nueva is not null and v_cred_priv_nueva <> '{}'::jsonb
            then coalesce(comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas, '{}'::jsonb) || v_cred_priv_nueva
          else comun_comercio.com_pasarela_configuracion.psc_credenciales_privadas
        end,
        psc_detalle_pasarela = excluded.psc_detalle_pasarela,
        psc_actualizado_en = v_ahora,
        psc_eliminado_en = null;

  -- Si se activó este procesador, desactivar el alterno para evitar ambigüedad
  if v_activo then
    update comun_comercio.com_pasarela_configuracion
       set psc_activo = false,
           psc_actualizado_en = v_ahora
     where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
       and upper(psc_pasarela) = v_otra
       and psc_eliminado_en is null;
  end if;

  -- Determinar si quedó alguna pasarela de tarjeta activa en el negocio
  select exists (
    select 1
      from comun_comercio.com_pasarela_configuracion
     where comun_seguridad.seg_fn_normalizar_negocio(psc_negocio) = v_negocio
       and upper(psc_pasarela) in ('PLUX', 'PAYPHONE')
       and psc_activo = true
       and psc_eliminado_en is null
  )
    into v_alguna_activa;

  v_nombre_comercio := case v_negocio
    when 'tinkay' then 'Tinkay Floristería'
    when 'margaritas' then 'Margaritas Floristería'
    when 'fastfix' then 'FastFix Home'
    else 'Tranqi'
  end;

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
    'tarjetaCreditoHabilitada', v_alguna_activa
  );

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = v_det_cfg || jsonb_build_object('tienda_checkout', v_tienda_checkout),
         cfg_actualizado_en = v_ahora
   where cfg_negocio = v_negocio;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'pasarela', v_pasarela,
    'activo', v_activo,
    'tarjeta_habilitada', v_alguna_activa
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_configuracion_pasarela(text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_guardar_configuracion_pasarela(text, text, jsonb) to authenticated, service_role;
