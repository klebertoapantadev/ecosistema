-- PLT-006: modo simulación de facturacion-sri (FACTURACION_SIMULACION).
--
-- La Edge Function puede simular, sin firma ni SRI, los comprobantes de
-- ambiente 1 cuyo emisor aún no tiene .p12: quedan AUTORIZADO con un mensaje
-- de identificador SIMULACION en cmp_mensajes_sri. Esta migración evita que una
-- factura simulada desbloquee el paso a producción:
--
--   - fac_fn_cambiar_ambiente ya exigía una factura AUTORIZADO en pruebas;
--     ahora las simuladas no cuentan.
--   - com_fn_cambiar_ambiente_sri (la vía del panel) no exigía ni MFA ni esa
--     factura, al contrario de lo que fija el ADR-0007; se igualan las
--     condiciones a las de fac_fn_cambiar_ambiente.
--
-- Solo redefine funciones (create or replace, mismas firmas): idempotente.

create or replace function comun_facturacion.fac_fn_cambiar_ambiente(p_negocio text, p_ambiente smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(p_negocio) then
    raise exception 'No autorizado';
  end if;
  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = p_negocio for update;
  if not found then
    raise exception 'El negocio no tiene emisor configurado';
  end if;

  if p_ambiente = 2 then
    if not comun_facturacion.fac_fn_aal2() then
      raise exception 'Se requiere verificacion MFA (aal2) para emitir en produccion';
    end if;
    if not v_emisor.emi_produccion_habilitada then
      raise exception 'Produccion no habilitada para este negocio: la habilita un superadmin';
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_certificado
       where cer_id = v_emisor.emi_certificado_id and cer_activo
         and cer_valido_desde <= now() and cer_valido_hasta > now()
    ) then
      raise exception 'El emisor no tiene un certificado vigente';
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_comprobante
       where cmp_negocio = p_negocio and cmp_ambiente = 1 and cmp_estado = 'AUTORIZADO'
         and not (cmp_mensajes_sri @> '[{"identificador": "SIMULACION"}]'::jsonb)
    ) then
      raise exception 'Antes de pasar a produccion hace falta una factura autorizada en pruebas';
    end if;
  elsif p_ambiente <> 1 then
    raise exception 'Ambiente invalido';
  end if;

  update comun_facturacion.fac_emisor
     set emi_ambiente = p_ambiente, emi_actualizado_en = now()
   where emi_negocio = p_negocio;
end;
$$;

create or replace function comun_comercio.com_fn_cambiar_ambiente_sri(
  p_negocio text,
  p_ambiente int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(p_negocio);
  v_emisor comun_facturacion.fac_emisor%rowtype;
begin
  if not comun_facturacion.fac_fn_es_admin(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Se requiere rol de Administrador para cambiar el ambiente SRI.');
  end if;

  select * into v_emisor from comun_facturacion.fac_emisor where emi_negocio = v_negocio for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Configura primero los datos del emisor SRI.');
  end if;

  if p_ambiente = 2 then
    if not comun_facturacion.fac_fn_aal2() then
      return jsonb_build_object('ok', false, 'error', 'Para pasar a Producción SRI debes verificar tu identidad con MFA (aal2).');
    end if;
    if not v_emisor.emi_produccion_habilitada then
      return jsonb_build_object('ok', false, 'error', 'Producción SRI aún no está habilitada para este negocio (requiere autorización SuperAdmin).');
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_certificado
      where cer_id = v_emisor.emi_certificado_id
        and cer_activo = true
        and cer_valido_desde <= now()
        and cer_valido_hasta > now()
    ) then
      return jsonb_build_object('ok', false, 'error', 'Para pasar a Producción SRI (CEL) debes cargar primero un certificado de firma electrónica (.p12) vigente en Vault.');
    end if;
    if not exists (
      select 1 from comun_facturacion.fac_comprobante
       where cmp_negocio = v_negocio and cmp_ambiente = 1 and cmp_estado = 'AUTORIZADO'
         and not (cmp_mensajes_sri @> '[{"identificador": "SIMULACION"}]'::jsonb)
    ) then
      return jsonb_build_object('ok', false, 'error', 'Antes de pasar a Producción SRI hace falta una factura autorizada por el SRI en pruebas (las simuladas no cuentan).');
    end if;
  elsif p_ambiente <> 1 then
    return jsonb_build_object('ok', false, 'error', 'Ambiente SRI inválido.');
  end if;

  update comun_facturacion.fac_emisor
     set emi_ambiente = p_ambiente::smallint,
         emi_actualizado_en = now()
   where emi_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;
