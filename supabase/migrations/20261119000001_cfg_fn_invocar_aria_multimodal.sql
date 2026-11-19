-- ==============================================================================
-- Migración: 20261119000001_cfg_fn_invocar_aria_multimodal.sql
-- Módulo: comun_configuracion (PLT-008 / PLT-010 / TNK-002 / ADR-0002)
-- Propósito:
--   Habilitar invocación multimodal (visión con image_urls y lectura de
--   document_urls) hacia ARIA directamente desde PostgreSQL mediante pgsql-http
--   + Supabase Vault, para usuarios autenticados del equipo operativo del negocio
--   (ej. Conteo fotográfico de inventario de rosas en /panel/inventario-rosas),
--   sin requerir variables de entorno en Vercel ni despliegue manual de Edge Functions.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;

grant usage on schema comun_configuracion to authenticated, service_role;

create or replace function comun_configuracion.cfg_fn_invocar_aria_multimodal(
  p_negocio text,
  p_prompt text,
  p_image_urls text[] default null,
  p_document_urls text[] default null,
  p_conversation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
set statement_timeout = '60s'
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_prompt text := trim(coalesce(p_prompt, ''));
  v_conversacion text := nullif(trim(coalesce(p_conversation_id, '')), '');
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_autorizado boolean := false;
  v_images text[];
  v_docs text[];
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

  if not v_es_service then
    if auth.uid() is null then
      return jsonb_build_object(
        'ok', false,
        'codigo', 'NO_AUTORIZADO',
        'error', 'Debes iniciar sesión para usar funciones multimodales de ARIA'
      );
    end if;

    v_autorizado := comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio);
    if not coalesce(v_autorizado, false) then
      return jsonb_build_object(
        'ok', false,
        'codigo', 'NO_AUTORIZADO',
        'error', 'No tienes permisos operativos en este negocio para invocar ARIA Visión'
      );
    end if;
  end if;

  if v_prompt = '' then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'DATOS_INVALIDOS',
      'error', 'El mensaje está vacío'
    );
  end if;

  if pg_catalog.char_length(v_prompt) > 4000 then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'MENSAJE_LARGO',
      'error', 'El prompt supera el máximo permitido (4000 caracteres)'
    );
  end if;

  if v_conversacion is not null and v_conversacion !~ '^[A-Za-z0-9_-]{8,64}$' then
    v_conversacion := null;
  end if;

  if p_image_urls is not null then
    select array_agg(u)
    into v_images
    from (
      select trim(x) as u
      from unnest(p_image_urls) as x
      where trim(coalesce(x, '')) ~* '^https?://'
      limit 5
    ) s;
  end if;

  if p_document_urls is not null then
    select array_agg(u)
    into v_docs
    from (
      select trim(x) as u
      from unnest(p_document_urls) as x
      where trim(coalesce(x, '')) ~* '^https?://'
      limit 5
    ) s;
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
      'error', 'El negocio no tiene un agente ARIA activo en Vault (/panel/aria)'
    );
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '55');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_url := v_base_url || '/v1/agents/' || v_agente_id || '/invoke';
  v_cuerpo := jsonb_strip_nulls(
    jsonb_build_object(
      'prompt', v_prompt,
      'conversation_id', v_conversacion,
      'image_urls', case when v_images is not null and cardinality(v_images) > 0 then to_jsonb(v_images) else null end,
      'document_urls', case when v_docs is not null and cardinality(v_docs) > 0 then to_jsonb(v_docs) else null end
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

revoke all on function comun_configuracion.cfg_fn_invocar_aria_multimodal(text, text, text[], text[], text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_invocar_aria_multimodal(text, text, text[], text[], text) to authenticated, service_role;

notify pgrst, 'reload schema';
