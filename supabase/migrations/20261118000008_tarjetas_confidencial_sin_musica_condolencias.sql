-- ==============================================================================
-- Migración: 20261118000008_tarjetas_confidencial_sin_musica_condolencias.sql
-- Requerimientos: PLT-009 / TNK-005
-- Descripción:
--   1. Actualiza com_fn_obtener_tarjeta_publica(token) para exponer únicamente vista de lectura,
--      incluir indicador confidencial_solo_qr y asegurar que la música/lyrics solo aplique a
--      tarjetas de Dedicatoria (nunca a Condolencias).
--   2. Revoca ejecución directa anónima sobre com_fn_editar_tarjeta_cliente para que la edición
--      exija siempre el enlace independiente firmado (/tarjeta-editar/[tokenEdicion]) o sesión Staff.
-- ==============================================================================

create or replace function comun_comercio.com_fn_obtener_tarjeta_publica(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
  v_orden comun_comercio.com_orden_taller;
  v_vistas int;
  v_meta jsonb;
  v_es_condol boolean;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Token de tarjeta no proporcionado.');
  end if;

  if to_regclass('comun_comercio.com_orden_taller') is null then
    return jsonb_build_object('ok', false, 'error', 'Tabla com_orden_taller aún no inicializada.');
  end if;

  select * into v_orden
    from comun_comercio.com_orden_taller
   where ota_tarjeta_token = v_token
     and ota_eliminado_en is null
   limit 1;

  if v_orden.ota_id is null then
    return jsonb_build_object('ok', false, 'error', 'La tarjeta solicitada no existe o ya no está disponible.');
  end if;

  v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
  v_vistas := coalesce((v_meta->>'vistas_cliente')::int, 0) + 1;
  v_meta := jsonb_set(v_meta, '{vistas_cliente}', to_jsonb(v_vistas), true);
  v_meta := jsonb_set(v_meta, '{ultima_vista_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);

  update comun_comercio.com_orden_taller
     set ota_tarjeta_metadata = v_meta
   where ota_id = v_orden.ota_id;

  v_es_condol := coalesce(v_orden.ota_tarjeta_tipo, 'DIPTICO') = 'CONDOLENCIAS_PLANA';

  return jsonb_build_object(
    'ok', true,
    'ordenId', v_orden.ota_id,
    'codigo', v_orden.ota_codigo,
    'negocio', v_orden.ota_negocio,
    'destinatario', coalesce(nullif(v_orden.ota_destinatario_fallecido, ''), 'Para ti'),
    'remitente', coalesce(nullif(v_orden.ota_cliente_solicita, ''), ''),
    'dedicatoria', coalesce(v_orden.ota_dedicatoria, ''),
    'tipo', coalesce(v_orden.ota_tarjeta_tipo, 'DIPTICO'),
    'confidencial', coalesce((v_meta->>'confidencial_solo_qr')::boolean, false),
    'musicaUrl', case when v_es_condol then null else v_orden.ota_tarjeta_musica_url end,
    'musicaTitulo', case when v_es_condol then null else v_orden.ota_tarjeta_musica_titulo end,
    'lyrics', case when v_es_condol then '[]'::jsonb else coalesce(v_orden.ota_tarjeta_lyrics, '[]'::jsonb) end,
    'fechaEntrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
    'estadoTaller', v_orden.ota_estado_taller,
    'bloqueadoEdicion', (v_orden.ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')),
    'vistas', v_vistas
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tarjeta_publica(text) to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'comun_comercio'
      and p.proname = 'com_fn_editar_tarjeta_cliente'
  ) then
    revoke execute on function comun_comercio.com_fn_editar_tarjeta_cliente(text, text, text, text, jsonb) from anon, public;
    grant execute on function comun_comercio.com_fn_editar_tarjeta_cliente(text, text, text, text, jsonb) to authenticated, service_role;
  end if;
end $$;
