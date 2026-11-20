-- ==============================================================================
-- Migración: 20261120000001_cfg_estudio_ia_vault.sql
-- Módulo: comun_configuracion (PLT-008 / TNK-005 — Estudio IA en Vault)
-- Propósito:
--   Permitir que el Administrador o SuperAdmin configure directamente en el panel
--   (/panel/aria → Estudio IA) su proveedor (OpenRouter o Google Gemini), modelo
--   de generación de imágenes y API Key cifrada en Supabase Vault, sin depender de
--   variables de entorno manuales en Vercel y sin exponer jamás la clave fuera de
--   PostgreSQL.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;

grant usage on schema comun_configuracion to authenticated, service_role;

-- 1. Columna Vault dedicada para Estudio IA en comun_configuracion.cfg_aria
alter table comun_configuracion.cfg_aria
  add column if not exists ari_estudio_ia_secreto_id uuid;

-- 2. Guardar configuración y clave cifrada de Estudio IA (Admin o SuperAdmin)
create or replace function comun_configuracion.cfg_fn_guardar_estudio_ia(
  p_negocio text,
  p_proveedor text default 'openrouter',
  p_modelo text default 'google/gemini-2.5-flash-image',
  p_activo boolean default true,
  p_api_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_proveedor text := lower(btrim(coalesce(p_proveedor, 'openrouter')));
  v_modelo text := btrim(coalesce(p_modelo, ''));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_fila comun_configuracion.cfg_aria;
  v_sec_id uuid;
  v_nuevo_detalle jsonb;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo el Administrador o SuperAdmin puede configurar Estudio IA en este negocio.'
    );
  end if;

  if v_proveedor not in ('openrouter', 'gemini') then
    v_proveedor := 'openrouter';
  end if;

  if v_modelo = '' then
    v_modelo := case
      when v_proveedor = 'gemini' then 'gemini-2.5-flash-image'
      else 'google/gemini-2.5-flash-image'
    end;
  end if;

  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  v_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_estudio_ia_secreto_id,
    p_api_key,
    'estudio_ia_api_key_' || v_negocio,
    'API Key de Estudio IA (OpenRouter/Gemini) del negocio ' || v_negocio
  );

  if coalesce(p_activo, false) and v_sec_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Pega tu API Key de OpenRouter (o Gemini) antes de activar Estudio IA.'
    );
  end if;

  v_nuevo_detalle := coalesce(v_fila.ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
    'estudio_ia', jsonb_build_object(
      'proveedor', v_proveedor,
      'modelo', v_modelo,
      'activo', coalesce(p_activo, false)
    )
  );

  insert into comun_configuracion.cfg_aria (
    ari_negocio,
    ari_base_url,
    ari_estudio_ia_secreto_id,
    ari_detalle_aria,
    ari_actualizado_en
  ) values (
    v_negocio,
    coalesce(v_fila.ari_base_url, 'https://aria.midomo.site'),
    v_sec_id,
    v_nuevo_detalle,
    now()
  )
  on conflict (ari_negocio) do update set
    ari_estudio_ia_secreto_id = excluded.ari_estudio_ia_secreto_id,
    ari_detalle_aria = excluded.ari_detalle_aria,
    ari_actualizado_en = now();

  return jsonb_build_object(
    'ok', true,
    'tieneApiKey', (v_sec_id is not null),
    'proveedor', v_proveedor,
    'modelo', v_modelo,
    'activo', coalesce(p_activo, false)
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_estudio_ia(text, text, text, boolean, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_estudio_ia(text, text, text, boolean, text) to authenticated, service_role;

-- 3. Eliminar clave de Estudio IA en Vault (Admin o SuperAdmin)
create or replace function comun_configuracion.cfg_fn_borrar_estudio_ia_clave(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_fila comun_configuracion.cfg_aria;
  v_est jsonb;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  if v_fila.ari_estudio_ia_secreto_id is not null then
    delete from vault.secrets where id = v_fila.ari_estudio_ia_secreto_id;
  end if;

  v_est := coalesce(v_fila.ari_detalle_aria->'estudio_ia', '{}'::jsonb) || jsonb_build_object('activo', false);

  update comun_configuracion.cfg_aria
  set
    ari_estudio_ia_secreto_id = null,
    ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object('estudio_ia', v_est),
    ari_actualizado_en = now()
  where ari_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_configuracion.cfg_fn_borrar_estudio_ia_clave(text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_borrar_estudio_ia_clave(text) to authenticated, service_role;

-- 4. Verificar clave en vivo sin costo ($0): OpenRouter /auth/key o Gemini /models
create or replace function comun_configuracion.cfg_fn_probar_estudio_ia(
  p_negocio text,
  p_proveedor text default null,
  p_api_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
set statement_timeout = '25s'
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_fila comun_configuracion.cfg_aria;
  v_proveedor text;
  v_api_key text := nullif(btrim(coalesce(p_api_key, '')), '');
  v_status integer;
  v_content text;
  v_json jsonb;
  v_saldo text;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para probar Estudio IA.');
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  v_proveedor := lower(btrim(coalesce(
    nullif(btrim(coalesce(p_proveedor, '')), ''),
    v_fila.ari_detalle_aria->'estudio_ia'->>'proveedor',
    'openrouter'
  )));
  if v_proveedor not in ('openrouter', 'gemini') then
    v_proveedor := 'openrouter';
  end if;

  if v_api_key is null and v_fila.ari_estudio_ia_secreto_id is not null then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_fila.ari_estudio_ia_secreto_id;
    v_api_key := nullif(btrim(coalesce(v_api_key, '')), '');
  end if;

  if v_api_key is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'No hay ninguna API Key ingresada ni guardada en Vault para probar.'
    );
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  if v_proveedor = 'gemini' then
    begin
      select h.status, h.content
      into v_status, v_content
      from extensions.http((
        'GET',
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
        array[extensions.http_header('x-goog-api-key', v_api_key)],
        null,
        null
      )::extensions.http_request) as h;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'No se pudo conectar con Google Gemini (' || sqlerrm || ')');
    end;

    if v_status < 200 or v_status >= 300 then
      return jsonb_build_object('ok', false, 'error', 'Google Gemini rechazó la API Key (HTTP ' || v_status || ').');
    end if;

    return jsonb_build_object(
      'ok', true,
      'proveedor', 'gemini',
      'detalle', 'Conexión verificada correctamente con Google Gemini.'
    );
  end if;

  -- OpenRouter: GET /api/v1/auth/key (sin costo)
  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'GET',
      'https://openrouter.ai/api/v1/auth/key',
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      null,
      null
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'No se pudo conectar con OpenRouter (' || sqlerrm || ')');
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->'error'->>'message', 'OpenRouter rechazó la API Key (HTTP ' || v_status || ').')
    );
  end if;

  v_saldo := case
    when (v_json->'data'->>'limit_remaining') is not null
      then ' · Límite restante: $' || round((v_json->'data'->>'limit_remaining')::numeric, 2)::text
    else ''
  end;

  return jsonb_build_object(
    'ok', true,
    'proveedor', 'openrouter',
    'detalle', 'Conexión OpenRouter verificada' || coalesce(' (' || nullif(btrim(v_json->'data'->>'label'), '') || ')', '') || v_saldo || '.'
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_probar_estudio_ia(text, text, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_probar_estudio_ia(text, text, text) to authenticated, service_role;

-- 5. Invocar generación de imagen Estudio/Taller usando el secreto cifrado en Vault
--    La API Key NUNCA sale de PostgreSQL ni llega a Next.js ni al navegador.
create or replace function comun_configuracion.cfg_fn_invocar_estudio_ia(
  p_negocio text,
  p_prompt text,
  p_imagenes jsonb,
  p_referer text default 'https://tinkay-web.vercel.app'
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
set statement_timeout = '60s'
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_autorizado boolean := false;
  v_fila comun_configuracion.cfg_aria;
  v_est jsonb;
  v_activo boolean;
  v_proveedor text;
  v_modelo text;
  v_api_key text;
  v_content_arr jsonb := '[]'::jsonb;
  v_parts_arr jsonb := '[]'::jsonb;
  v_img jsonb;
  v_etiqueta text;
  v_mime text;
  v_b64 text;
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_data_url text;
  v_mime_out text;
  v_parte jsonb;
  v_finish text;
begin
  if v_negocio not in ('tranqi', 'tinkay', 'fastfix', 'margaritas') then
    return jsonb_build_object('ok', false, 'codigo', 'DATOS_INVALIDOS', 'error', 'Negocio inválido.');
  end if;

  if not v_es_service then
    if auth.uid() is null then
      return jsonb_build_object('ok', false, 'codigo', 'NO_AUTORIZADO', 'error', 'Debes iniciar sesión.');
    end if;

    v_autorizado := coalesce(comun_seguridad.seg_fn_es_superadmin(), false)
      or coalesce(comun_seguridad.seg_fn_es_admin_negocio(v_negocio), false)
      or coalesce(comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio)), false)
      or coalesce(comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio), false);

    if not v_autorizado then
      return jsonb_build_object('ok', false, 'codigo', 'NO_AUTORIZADO', 'error', 'No tienes permisos para usar Estudio IA.');
    end if;
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio
    and ari_eliminado_en is null;

  v_est := coalesce(v_fila.ari_detalle_aria->'estudio_ia', '{}'::jsonb);
  v_activo := coalesce((v_est->>'activo')::boolean, false);
  v_proveedor := lower(btrim(coalesce(v_est->>'proveedor', 'openrouter')));
  if v_proveedor not in ('openrouter', 'gemini') then
    v_proveedor := 'openrouter';
  end if;

  v_modelo := nullif(btrim(coalesce(v_est->>'modelo', '')), '');
  if v_modelo is null then
    v_modelo := case
      when v_proveedor = 'gemini' then 'gemini-2.5-flash-image'
      else 'google/gemini-2.5-flash-image'
    end;
  end if;

  if v_fila.ari_estudio_ia_secreto_id is null then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_CLAVE_VAULT',
      'error', 'Configura tu API Key de OpenRouter en Configuración → Agente ARIA (/panel/aria) → Estudio IA.'
    );
  end if;

  if not v_activo then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'INACTIVO',
      'error', 'Estudio IA está guardado en Vault pero desactivado. Actívalo en Configuración → Agente ARIA (/panel/aria).'
    );
  end if;

  select d.decrypted_secret into v_api_key
  from vault.decrypted_secrets d
  where d.id = v_fila.ari_estudio_ia_secreto_id;

  v_api_key := nullif(btrim(coalesce(v_api_key, '')), '');
  if v_api_key is null then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_CLAVE_VAULT',
      'error', 'No se pudo recuperar la clave de Estudio IA en Vault. Vuelve a guardarla en /panel/aria.'
    );
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '55');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  if v_proveedor = 'gemini' then
    v_parts_arr := jsonb_build_array(jsonb_build_object('text', coalesce(p_prompt, '')));

    for v_img in select * from jsonb_array_elements(coalesce(p_imagenes, '[]'::jsonb))
    loop
      v_etiqueta := btrim(coalesce(v_img->>'etiqueta', ''));
      v_mime := coalesce(nullif(btrim(v_img->>'mimeType'), ''), 'image/jpeg');
      v_b64 := coalesce(v_img->>'base64', '');
      if v_etiqueta <> '' then
        v_parts_arr := v_parts_arr || jsonb_build_array(jsonb_build_object('text', v_etiqueta));
      end if;
      if v_b64 <> '' then
        v_parts_arr := v_parts_arr || jsonb_build_array(
          jsonb_build_object('inlineData', jsonb_build_object('mimeType', v_mime, 'data', v_b64))
        );
      end if;
    end loop;

    v_cuerpo := jsonb_build_object(
      'contents', jsonb_build_array(jsonb_build_object('role', 'user', 'parts', v_parts_arr)),
      'generationConfig', jsonb_build_object(
        'responseModalities', jsonb_build_array('IMAGE'),
        'imageConfig', jsonb_build_object('aspectRatio', '3:4')
      )
    );

    begin
      select h.status, h.content
      into v_status, v_content
      from extensions.http((
        'POST',
        'https://generativelanguage.googleapis.com/v1beta/models/' || v_modelo || ':generateContent',
        array[extensions.http_header('x-goog-api-key', v_api_key)],
        'application/json',
        v_cuerpo::text
      )::extensions.http_request) as h;
    exception when others then
      return jsonb_build_object('ok', false, 'codigo', 'ERROR_RED', 'error', 'Error de conexión con Gemini (' || sqlerrm || ')');
    end;

    begin
      v_json := v_content::jsonb;
    exception when others then
      v_json := null;
    end;

    if v_status < 200 or v_status >= 300 then
      return jsonb_build_object(
        'ok', false,
        'codigo', case when v_status in (429, 503) or v_status >= 500 then 'TRANSITORIO' else 'ERROR_PROVEEDOR' end,
        'status', v_status,
        'error', coalesce(v_json->'error'->>'message', 'Error de Gemini (HTTP ' || v_status || ')')
      );
    end if;

    for v_parte in select * from jsonb_array_elements(coalesce(v_json->'candidates'->0->'content'->'parts', '[]'::jsonb))
    loop
      if nullif(coalesce(v_parte->'inlineData'->>'data', ''), '') is not null then
        v_mime_out := coalesce(nullif(v_parte->'inlineData'->>'mimeType', ''), 'image/jpeg');
        v_data_url := 'data:' || v_mime_out || ';base64,' || (v_parte->'inlineData'->>'data');
        exit;
      end if;
    end loop;

    if v_data_url is null then
      v_finish := v_json->'candidates'->0->>'finishReason';
      return jsonb_build_object(
        'ok', false,
        'codigo', 'SIN_IMAGEN',
        'error', coalesce('Gemini finalizó sin imagen (' || nullif(v_finish, '') || ')', 'Gemini respondió sin datos de imagen')
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'proveedor', 'gemini',
      'modelo', v_modelo,
      'dataUrl', v_data_url,
      'mimeType', v_mime_out
    );
  end if;

  -- Proveedor OpenRouter (POST /api/v1/chat/completions)
  v_content_arr := jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', coalesce(p_prompt, ''))
  );

  for v_img in select * from jsonb_array_elements(coalesce(p_imagenes, '[]'::jsonb))
  loop
    v_etiqueta := btrim(coalesce(v_img->>'etiqueta', ''));
    v_mime := coalesce(nullif(btrim(v_img->>'mimeType'), ''), 'image/jpeg');
    v_b64 := coalesce(v_img->>'base64', '');
    if v_etiqueta <> '' then
      v_content_arr := v_content_arr || jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', v_etiqueta)
      );
    end if;
    if v_b64 <> '' then
      v_content_arr := v_content_arr || jsonb_build_array(
        jsonb_build_object(
          'type', 'image_url',
          'image_url', jsonb_build_object('url', 'data:' || v_mime || ';base64,' || v_b64)
        )
      );
    end if;
  end loop;

  v_cuerpo := jsonb_build_object(
    'model', v_modelo,
    'modalities', jsonb_build_array('image', 'text'),
    'image_config', jsonb_build_object('aspect_ratio', '3:4'),
    'messages', jsonb_build_array(
      jsonb_build_object('role', 'user', 'content', v_content_arr)
    )
  );

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      'https://openrouter.ai/api/v1/chat/completions',
      array[
        extensions.http_header('Authorization', 'Bearer ' || v_api_key),
        extensions.http_header('HTTP-Referer', coalesce(nullif(btrim(p_referer), ''), 'https://tinkay-web.vercel.app')),
        extensions.http_header('X-Title', 'Tinkay Floristeria - Estudio IA')
      ],
      'application/json',
      v_cuerpo::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'codigo', 'ERROR_RED', 'error', 'Error de conexión con OpenRouter (' || sqlerrm || ')');
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'codigo', case when v_status in (429, 503) or v_status >= 500 then 'TRANSITORIO' else 'ERROR_PROVEEDOR' end,
      'status', v_status,
      'error', coalesce(v_json->'error'->>'message', 'Error de OpenRouter (HTTP ' || v_status || ')')
    );
  end if;

  -- Extraer imagen desde choices[0].message.images[]
  for v_parte in select * from jsonb_array_elements(coalesce(v_json->'choices'->0->'message'->'images', '[]'::jsonb))
  loop
    v_data_url := coalesce(
      nullif(v_parte->'image_url'->>'url', ''),
      nullif(v_parte->>'url', '')
    );
    if v_data_url is not null and v_data_url like 'data:image/%' then
      v_mime_out := coalesce(substring(v_data_url from '^data:([^;]+);base64,'), 'image/png');
      exit;
    elsif nullif(coalesce(v_parte->>'b64_json', ''), '') is not null then
      v_mime_out := 'image/png';
      v_data_url := 'data:image/png;base64,' || (v_parte->>'b64_json');
      exit;
    end if;
  end loop;

  -- Respaldo si vino como arreglo multimodal en message.content
  if v_data_url is null and jsonb_typeof(v_json->'choices'->0->'message'->'content') = 'array' then
    for v_parte in select * from jsonb_array_elements(v_json->'choices'->0->'message'->'content')
    loop
      v_data_url := nullif(v_parte->'image_url'->>'url', '');
      if v_data_url is not null and v_data_url like 'data:image/%' then
        v_mime_out := coalesce(substring(v_data_url from '^data:([^;]+);base64,'), 'image/png');
        exit;
      end if;
    end loop;
  end if;

  if v_data_url is null then
    v_finish := v_json->'choices'->0->>'finish_reason';
    return jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_IMAGEN',
      'error', coalesce('OpenRouter finalizó sin imagen (' || nullif(v_finish, '') || ')', 'OpenRouter respondió sin datos de imagen')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'proveedor', 'openrouter',
    'modelo', v_modelo,
    'dataUrl', v_data_url,
    'mimeType', coalesce(v_mime_out, 'image/png')
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_invocar_estudio_ia(text, text, jsonb, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_invocar_estudio_ia(text, text, jsonb, text) to authenticated, service_role;
