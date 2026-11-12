-- ==============================================================================
-- Migración: 20261112000001_cfg_fn_invocar_aria_rpc.sql
-- Módulo: comun_configuracion (PLT-008 / PLT-004 / ADR-0002)
-- Propósito:
--   Habilitar puente sincrónico directo desde PostgreSQL hacia ARIA mediante la
--   extensión oficial `http` (`pgsql-http`) descifrando `ARIA_AGENT_KEY` dentro
--   de `vault.decrypted_secrets` en una función `SECURITY DEFINER`, sin exponer
--   jamás la clave secreta al cliente ni depender obligatoriamente del despliegue
--   manual por CLI de la Edge Function `invocar-aria`.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;

grant usage on schema comun_configuracion to anon, authenticated, service_role;

create or replace function comun_configuracion.cfg_fn_invocar_aria(
  p_negocio text,
  p_prompt text,
  p_conversation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_prompt text := trim(coalesce(p_prompt, ''));
  v_conversacion text := nullif(trim(coalesce(p_conversation_id, '')), '');
  v_base_url text;
  v_agente_id text;
  v_api_key text;
  v_url text;
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
begin
  if v_negocio not in ('tranqi', 'tinkay', 'fastfix', 'margaritas') then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'DATOS_INVALIDOS',
      'error', 'Negocio inválido'
    );
  end if;

  if v_prompt = '' then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'DATOS_INVALIDOS',
      'error', 'El mensaje está vacío'
    );
  end if;

  if pg_catalog.char_length(v_prompt) > 1000 then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'MENSAJE_LARGO',
      'error', 'El mensaje supera el máximo permitido (1000 caracteres)'
    );
  end if;

  if v_conversacion is not null and v_conversacion !~ '^[A-Za-z0-9_-]{8,64}$' then
    v_conversacion := null;
  end if;

  select
    regexp_replace(trim(a.ari_base_url), '/+$', ''),
    trim(a.ari_agente_id),
    d.decrypted_secret
  into v_base_url, v_agente_id, v_api_key
  from comun_configuracion.cfg_aria a
  join vault.decrypted_secrets d on d.id = a.ari_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_activo = true
    and a.ari_eliminado_en is null
    and a.ari_base_url is not null
    and a.ari_agente_id is not null
  limit 1;

  if v_api_key is null or v_base_url is null or v_agente_id is null then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_CONFIGURACION_VAULT',
      'error', 'El negocio no tiene un agente ARIA activo en Vault'
    );
  end if;

  -- Ampliar timeout de sesión y libcurl para respuestas del modelo (hasta 45s)
  perform pg_catalog.set_config('statement_timeout', '50000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '45');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_url := v_base_url || '/v1/agents/' || v_agente_id || '/invoke';
  v_cuerpo := jsonb_strip_nulls(
    jsonb_build_object(
      'prompt', v_prompt,
      'conversation_id', v_conversacion
    )
  );

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      v_url,
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      'application/json',
      v_cuerpo::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'ERROR_ARIA',
      'error', 'No fue posible conectar con el servidor de ARIA (' || sqlerrm || ')'
    );
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'ERROR_ARIA',
      'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'response', coalesce(v_json->>'response', v_json->>'detail', '…'),
    'usage', v_json->'usage',
    'runId', v_json->>'run_id'
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_invocar_aria(text, text, text) from public;
grant execute on function comun_configuracion.cfg_fn_invocar_aria(text, text, text) to anon, authenticated, service_role;

