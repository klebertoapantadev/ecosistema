-- =============================================================================
-- Migración: 20261126000008_omnicanal_simulador_aria_y_comentarios_meta.sql
-- Requerimiento: PLT-010 (Simulador de Chat ARIA con Reinicio + Auto-respuesta
--                Corta a Comentarios en Posts/Reels de Facebook e Instagram)
-- Descripción:
--   1. Tabla comun_agentes.agc_comentario_meta (prefijo cmm_, RLS + auditoría)
--      para deduplicación idempotente y bitácora de comentarios en Posts/Reels.
--   2. Valores por defecto de auto-respuesta a comentarios en cfg_aria.
--   3. RPC comun_configuracion.cfg_fn_guardar_meta_comentarios (Admin/SuperAdmin).
--   4. RPC comun_comercio.com_fn_omnicanal_simular_chat_aria (sandbox aislado
--      por sesion_id para probar y reiniciar conversaciones con ARIA en vivo
--      sin escribir en conversaciones reales ni enviar mensajes externos).
--   5. Despachador interno com_fn_interno_despachar_respuesta_comentario_meta
--      (Graph API v21.0: /{comment_id}/comments en FB, /{comment_id}/replies
--      en IG, y Private Reply DM opcional).
--   6. Procesador de entry[].changes[] (feed/comments) integrado en
--      com_fn_omnicanal_procesar_webhook_meta y consulta de bitácora
--      com_fn_omnicanal_listar_comentarios_meta.
-- =============================================================================

-- 1. Tabla comun_agentes.agc_comentario_meta (nomenclatura estándar cmm_ + RLS + auditoría)
create table if not exists comun_agentes.agc_comentario_meta (
  cmm_id uuid primary key default gen_random_uuid(),
  cmm_secuencial bigint generated always as identity,
  cmm_negocio text not null check (cmm_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cmm_canal text not null check (cmm_canal in ('facebook', 'instagram')),
  cmm_comentario_externo_id text not null,
  cmm_post_id text,
  cmm_autor_id text,
  cmm_autor_nombre text,
  cmm_texto_comentario text not null,
  cmm_regla_aplicada text,
  cmm_respuesta_publica text,
  cmm_respuesta_publica_id text,
  cmm_respuesta_dm text,
  cmm_estado text not null default 'RECIBIDO'
    check (cmm_estado in ('RECIBIDO', 'RESPONDIDO', 'IGNORADO', 'ERROR')),
  cmm_detalle_comentario jsonb not null default '{}'::jsonb,
  cmm_creado_en timestamptz not null default now(),
  cmm_actualizado_en timestamptz not null default now(),
  cmm_eliminado_en timestamptz
);

create unique index if not exists idx_agc_comentario_meta_unico
  on comun_agentes.agc_comentario_meta (cmm_negocio, cmm_comentario_externo_id)
  where cmm_eliminado_en is null;

create index if not exists idx_agc_comentario_meta_negocio_fecha
  on comun_agentes.agc_comentario_meta (cmm_negocio, cmm_creado_en desc)
  where cmm_eliminado_en is null;

alter table comun_agentes.agc_comentario_meta enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'comun_agentes'
      and tablename = 'agc_comentario_meta'
      and policyname = 'agc_comentario_meta_lectura_equipo'
  ) then
    create policy agc_comentario_meta_lectura_equipo on comun_agentes.agc_comentario_meta
      for select using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cmm_negocio));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'comun_agentes'
      and tablename = 'agc_comentario_meta'
      and policyname = 'agc_comentario_meta_gestion_equipo'
  ) then
    create policy agc_comentario_meta_gestion_equipo on comun_agentes.agc_comentario_meta
      for all using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cmm_negocio))
      with check (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cmm_negocio));
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_auditoria_agc_comentario_meta'
  ) then
    create trigger trg_auditoria_agc_comentario_meta
      after insert or update or delete on comun_agentes.agc_comentario_meta
      for each row execute function comun_auditoria.aud_fn_auditar_tabla();
  end if;
end $$;

grant select on comun_agentes.agc_comentario_meta to authenticated;

-- 2. Sembrar configuración por defecto de auto-respuesta a comentarios en cfg_aria (sin sobrescribir existentes)
update comun_configuracion.cfg_aria
   set ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
         'meta_comentarios_habilitado', coalesce((ari_detalle_aria->>'meta_comentarios_habilitado')::boolean, false),
         'meta_comentarios_modo', coalesce(nullif(btrim(ari_detalle_aria->>'meta_comentarios_modo'), ''), 'PALABRAS_CLAVE'),
         'meta_comentarios_solo_raiz', coalesce((ari_detalle_aria->>'meta_comentarios_solo_raiz')::boolean, true),
         'meta_comentarios_palabras_clave', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_palabras_clave'), ''),
           'precio, precios, info, informacion, información, catalogo, catálogo, cuanto, cuánto, valor, costo, envio, envío, disponible, rosas, arreglo, arreglos, ramo, ramos, donde, dónde, ubicacion, ubicación, horario, quiero, pedir, comprar, whatsapp, ?'
         ),
         'meta_comentarios_url_tienda', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_url_tienda'), ''),
           case ari_negocio
             when 'tinkay' then 'https://www.tinkay.net'
             when 'margaritas' then 'https://margaritas-web.vercel.app'
             when 'fastfix' then 'https://fastfix-web.vercel.app'
             when 'tranqi' then 'https://tranqi-web.vercel.app'
             else 'https://www.tinkay.net'
           end
         ),
         'meta_comentarios_respuesta_corta', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_respuesta_corta'), ''),
           '¡Hola {{nombre}}! 🌿 Mira modelos, precios actualizados y pide en línea aquí 👉 {{url_tienda}} (o escríbenos por mensaje directo).'
         ),
         'meta_comentarios_respuesta_condolencias', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_respuesta_condolencias'), ''),
           'Hola {{nombre}}, con todo respeto puedes revisar nuestros arreglos de condolencias y entregas prioritarias aquí: {{url_tienda}}/categoria/condolencias'
         ),
         'meta_comentarios_respuesta_eventos', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_respuesta_eventos'), ''),
           '¡Hola {{nombre}}! Con gusto cotizamos tu evento. Revisa opciones y arma tu proforma en línea aquí: {{url_tienda}}'
         ),
         'meta_comentarios_enviar_dm', coalesce((ari_detalle_aria->>'meta_comentarios_enviar_dm')::boolean, false),
         'meta_comentarios_plantilla_dm', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_comentarios_plantilla_dm'), ''),
           '¡Hola {{nombre}}! 🌿 Gracias por tu comentario. Aquí tienes nuestro catálogo con precios y entregas en Quito: {{url_tienda}} ¿Para qué ocasión buscas flores?'
         )
       ),
       ari_actualizado_en = now()
 where ari_eliminado_en is null;

-- 3. RPC Admin/SuperAdmin: Guardar reglas de auto-respuesta a comentarios en Posts/Reels
create or replace function comun_configuracion.cfg_fn_guardar_meta_comentarios(
  p_negocio text,
  p_habilitado boolean default false,
  p_modo text default 'PALABRAS_CLAVE',
  p_solo_raiz boolean default true,
  p_palabras_clave text default '',
  p_url_tienda text default '',
  p_respuesta_corta text default '',
  p_respuesta_condolencias text default '',
  p_respuesta_eventos text default '',
  p_enviar_dm boolean default false,
  p_plantilla_dm text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_modo text := case when upper(btrim(coalesce(p_modo, ''))) = 'TODOS' then 'TODOS' else 'PALABRAS_CLAVE' end;
  v_url text := regexp_replace(btrim(coalesce(p_url_tienda, '')), '/+$', '');
  v_resp_corta text := btrim(coalesce(p_respuesta_corta, ''));
  v_resp_cond text := btrim(coalesce(p_respuesta_condolencias, ''));
  v_resp_ev text := btrim(coalesce(p_respuesta_eventos, ''));
  v_dm text := btrim(coalesce(p_plantilla_dm, ''));
  v_fila comun_configuracion.cfg_aria;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede configurar las respuestas a comentarios.');
  end if;

  if coalesce(p_habilitado, false) and v_resp_corta = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe una respuesta corta antes de activar la auto-respuesta a comentarios.');
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio
    and ari_eliminado_en is null;

  if v_fila.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Configura primero la conexión de ARIA y Meta en esta pantalla.');
  end if;

  if coalesce(p_habilitado, false)
     and v_fila.ari_meta_page_token_secreto_id is null
     and v_fila.ari_meta_ig_token_secreto_id is null then
    return jsonb_build_object('ok', false, 'error', 'Guarda primero el Page Access Token de Meta antes de activar las respuestas automáticas a comentarios.');
  end if;

  if v_url = '' then
    v_url := case v_negocio
      when 'tinkay' then 'https://www.tinkay.net'
      when 'margaritas' then 'https://margaritas-web.vercel.app'
      when 'fastfix' then 'https://fastfix-web.vercel.app'
      when 'tranqi' then 'https://tranqi-web.vercel.app'
      else 'https://www.tinkay.net'
    end;
  end if;

  update comun_configuracion.cfg_aria
     set ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
           'meta_comentarios_habilitado', coalesce(p_habilitado, false),
           'meta_comentarios_modo', v_modo,
           'meta_comentarios_solo_raiz', coalesce(p_solo_raiz, true),
           'meta_comentarios_palabras_clave', btrim(coalesce(p_palabras_clave, '')),
           'meta_comentarios_url_tienda', v_url,
           'meta_comentarios_respuesta_corta', v_resp_corta,
           'meta_comentarios_respuesta_condolencias', v_resp_cond,
           'meta_comentarios_respuesta_eventos', v_resp_ev,
           'meta_comentarios_enviar_dm', coalesce(p_enviar_dm, false),
           'meta_comentarios_plantilla_dm', v_dm
         ),
         ari_actualizado_en = now()
   where ari_id = v_fila.ari_id;

  return jsonb_build_object(
    'ok', true,
    'habilitado', coalesce(p_habilitado, false),
    'modo', v_modo,
    'soloRaiz', coalesce(p_solo_raiz, true),
    'urlTienda', v_url,
    'enviarDm', coalesce(p_enviar_dm, false)
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_meta_comentarios(text, boolean, text, boolean, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_meta_comentarios(text, boolean, text, boolean, text, text, text, text, text, boolean, text) to authenticated, service_role;

-- 4. RPC Simulador de Chat ARIA (Sandbox multi-turno con reinicio instantáneo por p_sesion_id)
--    No persiste conversaciones falsas ni envía nada a clientes externos.
create or replace function comun_comercio.com_fn_omnicanal_simular_chat_aria(
  p_negocio text,
  p_sesion_id text,
  p_canal text default 'whatsapp',
  p_prompt text default '',
  p_usar_agente_whatsapp boolean default true,
  p_imagen_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_canal text := lower(btrim(coalesce(p_canal, 'whatsapp')));
  v_sesion text := regexp_replace(btrim(coalesce(p_sesion_id, '')), '[^A-Za-z0-9_-]', '', 'g');
  v_prompt text := btrim(coalesce(p_prompt, ''));
  v_aria comun_configuracion.cfg_aria;
  v_base_url text;
  v_agente_id text;
  v_api_key text := null;
  v_origen_agente text := 'principal';
  v_cuerpo_aria jsonb;
  v_inicio timestamptz := clock_timestamp();
  v_latencia_ms integer;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_escala boolean := false;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para usar el simulador de ARIA en este negocio.');
  end if;

  if v_prompt = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje de prueba antes de enviar.');
  end if;

  if v_canal not in ('whatsapp', 'facebook', 'instagram', 'web') then
    v_canal := 'whatsapp';
  end if;

  if v_sesion = '' then
    v_sesion := encode(extensions.gen_random_bytes(8), 'hex');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Configura primero tu agente ARIA en /panel/aria.');
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');

  if coalesce(p_usar_agente_whatsapp, true)
     and v_canal <> 'web'
     and nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), '') is not null then
    v_agente_id := btrim(v_aria.ari_detalle_aria->>'whatsapp_agente_id');
    v_origen_agente := 'whatsapp_dedicado';
    if v_aria.ari_whatsapp_agente_secreto_id is not null then
      select d.decrypted_secret into v_api_key
      from vault.decrypted_secrets d
      where d.id = v_aria.ari_whatsapp_agente_secreto_id;
    end if;
  end if;

  if v_agente_id is null or btrim(v_agente_id) = '' then
    v_agente_id := nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '');
    v_origen_agente := 'principal';
  end if;

  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Supabase Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_cuerpo_aria := jsonb_strip_nulls(jsonb_build_object(
    'prompt', left(v_prompt, 3900),
    'conversation_id', 'sim-' || v_canal || '-' || left(v_sesion, 48),
    'image_urls', case when p_imagen_url is not null and btrim(p_imagen_url) <> '' then jsonb_build_array(btrim(p_imagen_url)) else null end
  ));

  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'POST',
      v_base_url || '/v1/agents/' || v_agente_id || '/invoke',
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      'application/json',
      v_cuerpo_aria::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Error invocando ARIA (' || sqlerrm || ')');
  end;

  v_latencia_ms := greatest(1, extract(milliseconds from (clock_timestamp() - v_inicio))::integer + (extract(seconds from (clock_timestamp() - v_inicio))::integer * 1000));

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'status', v_status,
      'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  v_respuesta := btrim(coalesce(v_json->>'response', v_json->>'detail', ''));
  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió una respuesta vacía.');
  end if;

  v_escala := (v_respuesta ~* '(te comunico ahora mismo con una de nuestras asesoras|transferir con una asesora|\[ESCALAR_HUMANO\])');
  v_respuesta := btrim(regexp_replace(v_respuesta, '\[ESCALAR_HUMANO\]', '', 'gi'));

  return jsonb_build_object(
    'ok', true,
    'sesionId', v_sesion,
    'canal', v_canal,
    'respuesta', v_respuesta,
    'runId', v_json->>'run_id',
    'agenteNombre', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    'agenteOrigen', v_origen_agente,
    'latenciaMs', v_latencia_ms,
    'escaloHumano', v_escala
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_simular_chat_aria(text, text, text, text, boolean, text) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_simular_chat_aria(text, text, text, text, boolean, text) to authenticated, service_role;

-- 5. Despachador interno Meta Graph API v21.0 para responder Comentarios en Posts/Reels (+ DM Privado opcional)
create or replace function comun_comercio.com_fn_interno_despachar_respuesta_comentario_meta(
  p_negocio text,
  p_canal text,
  p_comentario_id text,
  p_respuesta_publica text,
  p_respuesta_dm text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_canal text := lower(btrim(coalesce(p_canal, 'facebook')));
  v_comm_id text := btrim(coalesce(p_comentario_id, ''));
  v_msg_pub text := left(btrim(coalesce(p_respuesta_publica, '')), 1800);
  v_msg_dm text := nullif(left(btrim(coalesce(p_respuesta_dm, '')), 950), '');
  v_page_token text := null;
  v_ig_token text := null;
  v_token text := null;
  v_page_id text := '';
  v_ig_id text := '';
  v_endpoint_pub text;
  v_endpoint_dm text;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_reply_id text := null;
  v_dm_ok boolean := false;
  v_dm_error text := null;
begin
  if v_comm_id = '' or v_msg_pub = '' then
    return jsonb_build_object('ok', false, 'error', 'Comentario o texto de respuesta vacío.');
  end if;

  select
    dp.decrypted_secret,
    di.decrypted_secret,
    coalesce(btrim(a.ari_detalle_aria->>'meta_page_id'), ''),
    coalesce(btrim(a.ari_detalle_aria->>'meta_ig_account_id'), '')
  into v_page_token, v_ig_token, v_page_id, v_ig_id
  from comun_configuracion.cfg_aria a
  left join vault.decrypted_secrets dp on dp.id = a.ari_meta_page_token_secreto_id
  left join vault.decrypted_secrets di on di.id = a.ari_meta_ig_token_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if v_canal = 'instagram' then
    v_token := coalesce(nullif(btrim(v_ig_token), ''), nullif(btrim(v_page_token), ''));
  else
    v_token := nullif(btrim(v_page_token), '');
  end if;

  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Falta Page Access Token de Meta en Vault (/panel/aria).');
  end if;

  if v_canal = 'instagram' then
    if v_token like 'IG%' then
      v_endpoint_pub := 'https://graph.instagram.com/v21.0/' || v_comm_id || '/replies';
    else
      v_endpoint_pub := 'https://graph.facebook.com/v21.0/' || v_comm_id || '/replies';
    end if;
  else
    v_endpoint_pub := 'https://graph.facebook.com/v21.0/' || v_comm_id || '/comments';
  end if;

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '20');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  -- A. Publicar respuesta corta al comentario
  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'POST',
      v_endpoint_pub,
      array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
      'application/json',
      jsonb_build_object('message', v_msg_pub)::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Error de red respondiendo comentario Meta (' || sqlerrm || ')');
  end;

  begin v_json := v_content::jsonb; exception when others then v_json := null; end;
  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'status', v_status,
      'error', coalesce(v_json->'error'->>'message', 'Meta respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  v_reply_id := coalesce(v_json->>'id', null);

  -- B. Private Reply DM opcional (Meta permite 1 DM privado por comentario dentro de 7 días)
  if v_msg_dm is not null then
    if v_token like 'IG%' then
      v_endpoint_dm := 'https://graph.instagram.com/v21.0/me/messages';
    elsif v_canal = 'instagram' and v_ig_id <> '' then
      v_endpoint_dm := 'https://graph.facebook.com/v21.0/' || v_ig_id || '/messages';
    elsif v_page_id <> '' then
      v_endpoint_dm := 'https://graph.facebook.com/v21.0/' || v_page_id || '/messages';
    else
      v_endpoint_dm := 'https://graph.facebook.com/v21.0/me/messages';
    end if;

    begin
      select h.status, h.content into v_status, v_content
      from extensions.http((
        'POST',
        v_endpoint_dm,
        array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
        'application/json',
        jsonb_build_object(
          'recipient', jsonb_build_object('comment_id', v_comm_id),
          'message', jsonb_build_object('text', v_msg_dm)
        )::text
      )::extensions.http_request) as h;

      begin v_json := v_content::jsonb; exception when others then v_json := null; end;
      if v_status >= 200 and v_status < 300 then
        v_dm_ok := true;
      else
        v_dm_error := coalesce(v_json->'error'->>'message', 'HTTP ' || coalesce(v_status::text, '?'));
      end if;
    exception when others then
      v_dm_error := sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'replyId', v_reply_id,
    'dmEnviado', v_dm_ok,
    'dmError', v_dm_error
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_respuesta_comentario_meta(text, text, text, text, text) from public, anon, authenticated;

-- 6. Procesador interno de comentarios entrantes (entry[].changes[] -> feed / comments)
create or replace function comun_comercio.com_fn_interno_procesar_comentarios_meta(
  p_aria comun_configuracion.cfg_aria,
  p_canal text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := p_aria.ari_negocio;
  v_det jsonb := coalesce(p_aria.ari_detalle_aria, '{}'::jsonb);
  v_page_id text := btrim(coalesce(v_det->>'meta_page_id', ''));
  v_ig_id text := btrim(coalesce(v_det->>'meta_ig_account_id', ''));
  v_habilitado boolean := coalesce((v_det->>'meta_comentarios_habilitado')::boolean, false);
  v_modo text := upper(coalesce(nullif(btrim(v_det->>'meta_comentarios_modo'), ''), 'PALABRAS_CLAVE'));
  v_solo_raiz boolean := coalesce((v_det->>'meta_comentarios_solo_raiz')::boolean, true);
  v_palabras text := coalesce(v_det->>'meta_comentarios_palabras_clave', '');
  v_url_tienda text := coalesce(nullif(btrim(v_det->>'meta_comentarios_url_tienda'), ''), 'https://www.tinkay.net');
  v_tpl_general text := coalesce(
    nullif(btrim(v_det->>'meta_comentarios_respuesta_corta'), ''),
    '¡Hola {{nombre}}! 🌿 Mira modelos, precios actualizados y pide en línea aquí 👉 {{url_tienda}} (o escríbenos por mensaje directo).'
  );
  v_tpl_cond text := coalesce(
    nullif(btrim(v_det->>'meta_comentarios_respuesta_condolencias'), ''),
    'Hola {{nombre}}, con todo respeto puedes revisar nuestros arreglos de condolencias y entregas prioritarias aquí: {{url_tienda}}/categoria/condolencias'
  );
  v_tpl_ev text := coalesce(
    nullif(btrim(v_det->>'meta_comentarios_respuesta_eventos'), ''),
    '¡Hola {{nombre}}! Con gusto cotizamos tu evento. Revisa opciones y arma tu proforma en línea aquí: {{url_tienda}}'
  );
  v_enviar_dm boolean := coalesce((v_det->>'meta_comentarios_enviar_dm')::boolean, false);
  v_tpl_dm text := coalesce(nullif(btrim(v_det->>'meta_comentarios_plantilla_dm'), ''), '');
  v_entry jsonb;
  v_chg jsonb;
  v_field text;
  v_val jsonb;
  v_comm_id text;
  v_post_id text;
  v_parent_id text;
  v_autor_id text;
  v_autor_nombre text;
  v_primer_nombre text;
  v_texto text;
  v_es_subcomentario boolean;
  v_coincide boolean;
  v_regla text;
  v_resp_pub text;
  v_resp_dm text;
  v_despacho jsonb;
  v_estado text;
  v_cmm comun_agentes.agc_comentario_meta;
  v_resultados jsonb := '[]'::jsonb;
begin
  for v_entry in select value from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) loop
    for v_chg in select value from jsonb_array_elements(coalesce(v_entry->'changes', '[]'::jsonb)) loop
      v_field := lower(btrim(coalesce(v_chg->>'field', '')));
      v_val := coalesce(v_chg->'value', '{}'::jsonb);

      v_comm_id := '';
      v_post_id := null;
      v_parent_id := null;
      v_autor_id := '';
      v_autor_nombre := '';
      v_texto := '';

      if p_canal = 'facebook' and v_field = 'feed' then
        if lower(coalesce(v_val->>'item', '')) <> 'comment'
           or lower(coalesce(v_val->>'verb', '')) <> 'add' then
          continue;
        end if;
        v_comm_id := btrim(coalesce(v_val->>'comment_id', ''));
        v_post_id := nullif(btrim(coalesce(v_val->>'post_id', '')), '');
        v_parent_id := nullif(btrim(coalesce(v_val->>'parent_id', '')), '');
        v_autor_id := btrim(coalesce(v_val->'from'->>'id', ''));
        v_autor_nombre := btrim(coalesce(v_val->'from'->>'name', ''));
        v_texto := btrim(coalesce(v_val->>'message', ''));
        v_es_subcomentario := (v_parent_id is not null and v_post_id is not null and v_parent_id <> v_post_id);
      elsif p_canal = 'instagram' and v_field = 'comments' then
        v_comm_id := btrim(coalesce(v_val->>'id', ''));
        v_post_id := nullif(btrim(coalesce(v_val->'media'->>'id', '')), '');
        v_parent_id := nullif(btrim(coalesce(v_val->>'parent_id', '')), '');
        v_autor_id := btrim(coalesce(v_val->'from'->>'id', ''));
        v_autor_nombre := btrim(coalesce(v_val->'from'->>'username', v_val->'from'->>'name', ''));
        v_texto := btrim(coalesce(v_val->>'text', ''));
        v_es_subcomentario := (v_parent_id is not null);
      else
        continue;
      end if;

      if v_comm_id = '' or v_texto = '' then
        continue;
      end if;

      -- Anti-bucle estricto: jamás responder comentarios propios de la Página o cuenta IG
      if (v_page_id <> '' and v_autor_id = v_page_id)
         or (v_ig_id <> '' and v_autor_id = v_ig_id) then
        continue;
      end if;

      -- Deduplicación idempotente por (negocio, comentario_externo_id)
      if exists (
        select 1 from comun_agentes.agc_comentario_meta
        where cmm_negocio = v_negocio
          and cmm_comentario_externo_id = v_comm_id
          and cmm_eliminado_en is null
      ) then
        continue;
      end if;

      v_primer_nombre := split_part(regexp_replace(coalesce(v_autor_nombre, ''), '^@', ''), ' ', 1);
      v_regla := null;
      v_resp_pub := null;
      v_resp_dm := null;
      v_estado := 'IGNORADO';

      if not v_habilitado then
        v_regla := 'DESHABILITADO';
      elsif v_solo_raiz and v_es_subcomentario then
        v_regla := 'IGNORADO_SUBCOMENTARIO';
      else
        if v_modo = 'TODOS' then
          v_coincide := (char_length(v_texto) >= 2);
        else
          v_coincide := exists (
            select 1
            from regexp_split_to_table(v_palabras, '[,;\n]+') as kw
            where btrim(kw) <> ''
              and strpos(lower(v_texto), lower(btrim(kw))) > 0
          );
        end if;

        if not v_coincide then
          v_regla := 'SIN_PALABRA_CLAVE';
        else
          if v_texto ~* '(condolencia|corona|velaci[oó]n|funeral|p[eé]same|fallec|f[uú]nebre|exequi)' then
            v_regla := 'CONDOLENCIAS';
            v_resp_pub := v_tpl_cond;
          elsif v_texto ~* '(evento|boda|matrimonio|decoraci[oó]n|proforma|corporativo|quincea[ñn])' then
            v_regla := 'EVENTOS';
            v_resp_pub := v_tpl_ev;
          else
            v_regla := case when v_modo = 'TODOS' then 'GENERAL_TODOS' else 'PALABRA_CLAVE' end;
            v_resp_pub := v_tpl_general;
          end if;

          v_resp_pub := replace(replace(v_resp_pub, '{{nombre}}', v_primer_nombre), '{{url_tienda}}', v_url_tienda);
          v_resp_pub := regexp_replace(v_resp_pub, '¡Hola\s+!', '¡Hola!', 'g');
          v_resp_pub := regexp_replace(v_resp_pub, 'Hola\s+,', 'Hola,', 'g');
          v_resp_pub := btrim(regexp_replace(v_resp_pub, '\s{2,}', ' ', 'g'));

          if v_enviar_dm and v_tpl_dm <> '' then
            v_resp_dm := replace(replace(v_tpl_dm, '{{nombre}}', v_primer_nombre), '{{url_tienda}}', v_url_tienda);
            v_resp_dm := regexp_replace(v_resp_dm, '¡Hola\s+!', '¡Hola!', 'g');
            v_resp_dm := btrim(regexp_replace(v_resp_dm, '\s{2,}', ' ', 'g'));
          end if;
        end if;
      end if;

      -- Insertar registro primero (lock único por comentario para evitar condiciones de carrera)
      insert into comun_agentes.agc_comentario_meta (
        cmm_negocio, cmm_canal, cmm_comentario_externo_id, cmm_post_id,
        cmm_autor_id, cmm_autor_nombre, cmm_texto_comentario,
        cmm_regla_aplicada, cmm_respuesta_publica, cmm_respuesta_dm,
        cmm_estado, cmm_detalle_comentario
      ) values (
        v_negocio, p_canal, v_comm_id, v_post_id,
        nullif(v_autor_id, ''), nullif(v_autor_nombre, ''), v_texto,
        v_regla, v_resp_pub, v_resp_dm,
        case when v_resp_pub is not null then 'RECIBIDO' else 'IGNORADO' end,
        jsonb_strip_nulls(jsonb_build_object(
          'parent_id', v_parent_id,
          'es_subcomentario', v_es_subcomentario,
          'field', v_field
        ))
      )
      on conflict (cmm_negocio, cmm_comentario_externo_id) where cmm_eliminado_en is null
      do nothing
      returning * into v_cmm;

      if v_cmm.cmm_id is null then
        continue;
      end if;

      if v_resp_pub is not null then
        v_despacho := comun_comercio.com_fn_interno_despachar_respuesta_comentario_meta(
          v_negocio,
          p_canal,
          v_comm_id,
          v_resp_pub,
          v_resp_dm
        );

        v_estado := case when coalesce((v_despacho->>'ok')::boolean, false) then 'RESPONDIDO' else 'ERROR' end;

        update comun_agentes.agc_comentario_meta
           set cmm_estado = v_estado,
               cmm_respuesta_publica_id = v_despacho->>'replyId',
               cmm_detalle_comentario = coalesce(cmm_detalle_comentario, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
                 'dm_enviado', v_despacho->'dmEnviado',
                 'dm_error', v_despacho->>'dmError',
                 'error_meta', case when v_estado = 'ERROR' then v_despacho->>'error' else null end
               )),
               cmm_actualizado_en = now()
         where cmm_id = v_cmm.cmm_id;
      end if;

      v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
        'comentarioId', v_cmm.cmm_id,
        'comentarioExternoId', v_comm_id,
        'canal', p_canal,
        'autorNombre', coalesce(nullif(v_autor_nombre, ''), 'Usuario'),
        'texto', v_texto,
        'regla', v_regla,
        'estado', v_estado,
        'respuestaPublica', v_resp_pub,
        'dmEnviado', coalesce((v_despacho->>'dmEnviado')::boolean, false)
      ));
    end loop;
  end loop;

  return v_resultados;
end;
$$;

revoke all on function comun_comercio.com_fn_interno_procesar_comentarios_meta(comun_configuracion.cfg_aria, text, jsonb) from public, anon, authenticated;

-- 7. Actualizar com_fn_omnicanal_procesar_webhook_meta para despachar también comentarios (entry[].changes[])
create or replace function comun_comercio.com_fn_omnicanal_procesar_webhook_meta(
  p_token text default null,
  p_firma_sha256 text default null,
  p_cuerpo_raw text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_objeto text := lower(btrim(coalesce(p_payload->>'object', '')));
  v_canal text;
  v_primer_entry_id text := btrim(coalesce(p_payload->'entry'->0->>'id', ''));
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_app_secret text := null;
  v_firma_limpia text := lower(regexp_replace(btrim(coalesce(p_firma_sha256, '')), '^sha256=', '', 'i'));
  v_hmac text;
  v_page_id text := '';
  v_ig_id text := '';
  v_canal_habilitado boolean := false;
  v_modo_manual boolean := true;
  v_token_api text := null;
  v_page_token text := null;
  v_ig_token text := null;
  v_etq_canal_id uuid := null;
  v_entry jsonb;
  v_ev jsonb;
  v_msg jsonb;
  v_postback jsonb;
  v_referral jsonb;
  v_att jsonb;
  v_att_tipo text;
  v_att_url text;
  v_sender_id text;
  v_recipient_id text;
  v_es_eco boolean;
  v_cliente_ext_id text;
  v_id_ext text;
  v_texto text;
  v_tipo_bd text;
  v_imagen_url text;
  v_audio_url text;
  v_audio_mime text;
  v_doc_url text;
  v_doc_nombre text;
  v_lat numeric;
  v_lng numeric;
  v_clave_hilo text;
  v_nombre_perfil text;
  v_cnv_existente comun_agentes.agc_conversacion;
  v_cnv comun_agentes.agc_conversacion;
  v_msg_ins comun_agentes.agc_mensaje;
  v_pide_humano boolean;
  v_es_despedida_corta boolean;
  v_conteo_despedidas integer;
  v_accion text;
  v_prof_status integer;
  v_prof_content text;
  v_prof_json jsonb;
  v_eventos jsonb := '[]'::jsonb;
  v_comentarios jsonb := '[]'::jsonb;
begin
  if v_objeto = 'instagram' then
    v_canal := 'instagram';
  elsif v_objeto = 'page' then
    v_canal := 'facebook';
  else
    return jsonb_build_object('ok', true, 'accion', 'EVENTO_IGNORADO', 'objeto', v_objeto, 'eventos', '[]'::jsonb, 'comentarios', '[]'::jsonb);
  end if;

  if v_token <> '' then
    select * into v_aria
    from comun_configuracion.cfg_aria a
    where a.ari_eliminado_en is null
      and btrim(coalesce(a.ari_detalle_aria->>'meta_webhook_token', '')) = v_token
    limit 1;
  elsif v_primer_entry_id <> '' then
    select * into v_aria
    from comun_configuracion.cfg_aria a
    where a.ari_eliminado_en is null
      and (
        btrim(coalesce(a.ari_detalle_aria->>'meta_page_id', '')) = v_primer_entry_id
        or btrim(coalesce(a.ari_detalle_aria->>'meta_ig_account_id', '')) = v_primer_entry_id
      )
    limit 1;
  end if;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Webhook Meta no reconocido para ningún negocio.');
  end if;

  v_negocio := v_aria.ari_negocio;
  v_page_id := btrim(coalesce(v_aria.ari_detalle_aria->>'meta_page_id', ''));
  v_ig_id := btrim(coalesce(v_aria.ari_detalle_aria->>'meta_ig_account_id', ''));
  v_modo_manual := coalesce((v_aria.ari_detalle_aria->>'meta_modo_manual_defecto')::boolean, true);
  v_canal_habilitado := case
    when v_canal = 'instagram' then coalesce((v_aria.ari_detalle_aria->>'meta_ig_habilitado')::boolean, false)
    else coalesce((v_aria.ari_detalle_aria->>'meta_fb_habilitado')::boolean, false)
  end;

  if v_aria.ari_meta_app_secret_secreto_id is not null then
    select d.decrypted_secret into v_app_secret
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_meta_app_secret_secreto_id;

    if v_app_secret is not null and btrim(v_app_secret) <> '' then
      if v_firma_limpia = '' or p_cuerpo_raw is null then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Cabecera X-Hub-Signature-256 requerida.');
      end if;
      v_hmac := encode(extensions.hmac(p_cuerpo_raw, btrim(v_app_secret), 'sha256'), 'hex');
      if v_hmac <> v_firma_limpia then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma X-Hub-Signature-256 inválida.');
      end if;
    end if;
  end if;

  -- A. Procesar comentarios públicos en Posts/Reels si vienen en entry[].changes[]
  v_comentarios := comun_comercio.com_fn_interno_procesar_comentarios_meta(v_aria, v_canal, p_payload);

  -- B. Procesar mensajes directos (entry[].messaging[])
  if v_aria.ari_meta_page_token_secreto_id is not null then
    select d.decrypted_secret into v_page_token
    from vault.decrypted_secrets d where d.id = v_aria.ari_meta_page_token_secreto_id;
  end if;
  if v_aria.ari_meta_ig_token_secreto_id is not null then
    select d.decrypted_secret into v_ig_token
    from vault.decrypted_secrets d where d.id = v_aria.ari_meta_ig_token_secreto_id;
  end if;
  v_token_api := case
    when v_canal = 'instagram' then coalesce(nullif(btrim(v_ig_token), ''), nullif(btrim(v_page_token), ''))
    else nullif(btrim(v_page_token), '')
  end;

  select etq_id into v_etq_canal_id
  from comun_agentes.agc_etiqueta
  where etq_negocio = v_negocio
    and etq_slug = case when v_canal = 'instagram' then 'origen-instagram' else 'origen-facebook' end
    and etq_eliminado_en is null
  limit 1;

  for v_entry in select value from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) loop
    for v_ev in select value from jsonb_array_elements(coalesce(v_entry->'messaging', '[]'::jsonb)) loop
      v_msg := v_ev->'message';
      v_postback := v_ev->'postback';
      v_referral := coalesce(v_ev->'referral', v_postback->'referral', v_msg->'referral');

      if v_msg is null and v_postback is null then
        continue;
      end if;

      if coalesce((v_msg->>'is_deleted')::boolean, false) or coalesce((v_msg->>'is_unsupported')::boolean, false) then
        continue;
      end if;

      v_sender_id := btrim(coalesce(v_ev->'sender'->>'id', ''));
      v_recipient_id := btrim(coalesce(v_ev->'recipient'->>'id', ''));
      if v_sender_id = '' then
        continue;
      end if;

      v_es_eco := (
        coalesce((v_msg->>'is_echo')::boolean, false)
        or (v_page_id <> '' and v_sender_id = v_page_id)
        or (v_ig_id <> '' and v_sender_id = v_ig_id)
      );

      v_cliente_ext_id := case when v_es_eco then v_recipient_id else v_sender_id end;
      if v_cliente_ext_id = '' then
        continue;
      end if;

      v_id_ext := nullif(btrim(coalesce(v_msg->>'mid', v_postback->>'mid', '')), '');
      if v_id_ext is not null and exists (
        select 1 from comun_agentes.agc_mensaje
        where msg_negocio = v_negocio
          and msg_id_externo = v_id_ext
          and msg_eliminado_en is null
      ) then
        continue;
      end if;

      v_texto := '';
      v_tipo_bd := 'TEXTO';
      v_imagen_url := null;
      v_audio_url := null;
      v_audio_mime := null;
      v_doc_url := null;
      v_doc_nombre := null;
      v_lat := null;
      v_lng := null;

      if v_msg is not null then
        v_texto := btrim(coalesce(v_msg->>'text', ''));
        if v_texto = '' and v_msg->'quick_reply' is not null then
          v_texto := btrim(coalesce(v_msg->'quick_reply'->>'payload', ''));
        end if;

        if jsonb_typeof(v_msg->'attachments') = 'array' and jsonb_array_length(v_msg->'attachments') > 0 then
          v_att := v_msg->'attachments'->0;
          v_att_tipo := lower(coalesce(v_att->>'type', ''));
          v_att_url := nullif(btrim(coalesce(v_att->'payload'->>'url', '')), '');

          if v_att_tipo = 'image' then
            v_tipo_bd := 'IMAGEN';
            v_imagen_url := v_att_url;
            if v_texto = '' then
              v_texto := case
                when v_imagen_url is not null then '![Foto enviada por el cliente](' || v_imagen_url || ')'
                else '📷 Imagen recibida por ' || initcap(v_canal)
              end;
            elsif v_imagen_url is not null then
              v_texto := v_texto || E'\n![Foto enviada por el cliente](' || v_imagen_url || ')';
            end if;
          elsif v_att_tipo = 'audio' then
            v_tipo_bd := 'AUDIO';
            v_audio_url := v_att_url;
            v_audio_mime := 'audio/mp4';
            if v_texto = '' then
              v_texto := '🎤 Nota de voz recibida por ' || initcap(v_canal);
            end if;
          elsif v_att_tipo = 'file' then
            v_tipo_bd := 'DOCUMENTO';
            v_doc_url := v_att_url;
            v_doc_nombre := 'archivo-meta';
            if v_texto = '' then
              v_texto := '📄 Documento recibido por ' || initcap(v_canal);
            end if;
          elsif v_att_tipo = 'location' then
            v_tipo_bd := 'UBICACION';
            begin
              v_lat := (v_att->'payload'->'coordinates'->>'lat')::numeric;
              v_lng := (v_att->'payload'->'coordinates'->>'long')::numeric;
            exception when others then
              v_lat := null; v_lng := null;
            end;
            if v_lat is not null and v_lng is not null then
              v_texto := btrim(coalesce(nullif(v_texto, '') || ' ', '') || '📍 Ubicación compartida (https://www.google.com/maps?q=' || v_lat::text || ',' || v_lng::text || ')');
            end if;
          elsif v_att_tipo in ('story_mention', 'share', 'ig_reel', 'video') then
            if v_texto = '' then
              v_texto := case v_att_tipo
                when 'story_mention' then '✨ Mención en historia de Instagram'
                when 'ig_reel' then '🎬 Reel compartido por el cliente'
                when 'video' then '🎬 Video enviado por el cliente'
                else '🔗 Publicación compartida por el cliente'
              end || case when v_att_url is not null then ': ' || v_att_url else '' end;
            end if;
          end if;
        end if;
      elsif v_postback is not null then
        v_texto := btrim(coalesce(nullif(v_postback->>'title', ''), nullif(v_postback->>'payload', ''), 'Botón seleccionado'));
      end if;

      if v_texto = '' then
        continue;
      end if;

      v_clave_hilo := case when v_canal = 'instagram' then 'ig:' else 'fb:' end || v_cliente_ext_id;

      if v_es_eco then
        insert into comun_agentes.agc_conversacion (
          cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
          cnv_estado_atencion, cnv_ultimo_mensaje_texto, cnv_ultimo_mensaje_origen,
          cnv_ultimo_mensaje_en, cnv_mensajes_humano_conteo
        ) values (
          v_negocio, v_canal, v_clave_hilo, v_cliente_ext_id,
          case when v_canal = 'instagram' then 'Instagram ' else 'Facebook ' end || right(v_cliente_ext_id, 6),
          'EN_ATENCION_ASESORA', left(v_texto, 280), 'ASESORA_HUMANA', now(), 1
        )
        on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
        do update set
          cnv_estado_atencion = 'EN_ATENCION_ASESORA',
          cnv_ultimo_mensaje_texto = left(v_texto, 280),
          cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
          cnv_ultimo_mensaje_en = now(),
          cnv_mensajes_humano_conteo = comun_agentes.agc_conversacion.cnv_mensajes_humano_conteo + 1,
          cnv_actualizado_en = now()
        returning * into v_cnv;

        insert into comun_agentes.agc_mensaje (
          msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
          msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
        ) values (
          v_negocio, v_cnv.cnv_id, 'ASESORA_HUMANA',
          case when v_canal = 'instagram' then 'Instagram App Tienda' else 'Facebook Inbox Tienda' end,
          v_texto, v_tipo_bd, v_id_ext, 'ENVIADO',
          jsonb_strip_nulls(jsonb_build_object(
            'canal', v_canal,
            'eco_meta', true,
            'imagen_url', v_imagen_url,
            'audio_url', v_audio_url,
            'audio_mime', v_audio_mime,
            'documento_url', v_doc_url,
            'documento_nombre', v_doc_nombre
          ))
        )
        on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
        do nothing
        returning * into v_msg_ins;

        if v_msg_ins.msg_id is not null then
          v_eventos := v_eventos || jsonb_build_array(jsonb_build_object(
            'accion', 'ECO_MOVIL_REGISTRADO',
            'canal', v_canal,
            'conversacionId', v_cnv.cnv_id,
            'claveHilo', v_clave_hilo,
            'mensajeId', v_msg_ins.msg_id,
            'contenido', v_texto,
            'tipoMensaje', v_tipo_bd,
            'imagenUrl', v_imagen_url,
            'audioUrl', v_audio_url,
            'audioMime', v_audio_mime,
            'documentoUrl', v_doc_url,
            'documentoNombre', v_doc_nombre,
            'remitenteNombre', v_cnv.cnv_remitente_nombre,
            'estadoAtencion', v_cnv.cnv_estado_atencion
          ));
        end if;
        continue;
      end if;

      select * into v_cnv_existente
      from comun_agentes.agc_conversacion
      where cnv_negocio = v_negocio
        and cnv_canal = v_canal
        and cnv_clave_hilo = v_clave_hilo
        and cnv_eliminado_en is null
      limit 1;

      v_nombre_perfil := case
        when v_cnv_existente.cnv_id is not null
          and v_cnv_existente.cnv_remitente_nombre not like 'Facebook %'
          and v_cnv_existente.cnv_remitente_nombre not like 'Instagram %'
        then v_cnv_existente.cnv_remitente_nombre
        else null
      end;

      if v_nombre_perfil is null and v_token_api is not null then
        begin
          perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '4');
          perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '3');
          select h.status, h.content into v_prof_status, v_prof_content
          from extensions.http((
            'GET',
            case when v_token_api like 'IG%'
              then 'https://graph.instagram.com/v21.0/' || v_cliente_ext_id || '?fields=name,username'
              else 'https://graph.facebook.com/v21.0/' || v_cliente_ext_id || '?fields=name,first_name,last_name,username'
            end,
            array[extensions.http_header('Authorization', 'Bearer ' || v_token_api)],
            null,
            null
          )::extensions.http_request) as h;

          if v_prof_status >= 200 and v_prof_status < 300 and v_prof_content is not null then
            v_prof_json := v_prof_content::jsonb;
            v_nombre_perfil := coalesce(
              nullif(btrim(coalesce(v_prof_json->>'name', '')), ''),
              nullif(btrim(coalesce(v_prof_json->>'first_name', '') || ' ' || coalesce(v_prof_json->>'last_name', '')), ''),
              case when nullif(btrim(coalesce(v_prof_json->>'username', '')), '') is not null
                then '@' || btrim(v_prof_json->>'username')
                else null
              end
            );
          end if;
        exception when others then
          v_nombre_perfil := null;
        end;
      end if;

      if v_nombre_perfil is null or btrim(v_nombre_perfil) = '' then
        v_nombre_perfil := case when v_canal = 'instagram' then 'Instagram ' else 'Facebook ' end || right(v_cliente_ext_id, 6);
      end if;

      v_pide_humano := (v_texto ~* '(hablar con (un |una )?(asesor|humano|persona|vendedor)|atenci[oó]n humana|reclamo|queja)');

      insert into comun_agentes.agc_conversacion (
        cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
        cnv_estado_atencion, cnv_motivo_escalamiento, cnv_ultimo_mensaje_texto,
        cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en, cnv_no_leidos_asesora,
        cnv_mensajes_cliente_conteo, cnv_ventana_24h_expira_en
      ) values (
        v_negocio, v_canal, v_clave_hilo, v_cliente_ext_id, v_nombre_perfil,
        case
          when v_pide_humano then 'ESCALADO_HUMANO'
          when v_modo_manual or not v_canal_habilitado then 'EN_ATENCION_ASESORA'
          else 'BOT_ACTIVO'
        end,
        case when v_pide_humano then 'Solicitud directa de atención humana en ' || initcap(v_canal) else null end,
        left(v_texto, 280), 'CLIENTE', now(), 1, 1, now() + interval '24 hours'
      )
      on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
      do update set
        cnv_remitente_nombre = case
          when comun_agentes.agc_conversacion.cnv_remitente_nombre like 'Facebook %'
            or comun_agentes.agc_conversacion.cnv_remitente_nombre like 'Instagram %'
          then excluded.cnv_remitente_nombre
          else comun_agentes.agc_conversacion.cnv_remitente_nombre
        end,
        cnv_estado_atencion = case
          when comun_agentes.agc_conversacion.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then 'EN_ATENCION_ASESORA'
          when v_pide_humano then 'ESCALADO_HUMANO'
          when comun_agentes.agc_conversacion.cnv_estado_atencion = 'CERRADO' then
            case when v_modo_manual or not v_canal_habilitado then 'EN_ATENCION_ASESORA' else 'BOT_ACTIVO' end
          else comun_agentes.agc_conversacion.cnv_estado_atencion
        end,
        cnv_motivo_escalamiento = case
          when v_pide_humano then 'Solicitud directa de atención humana en ' || initcap(v_canal)
          else comun_agentes.agc_conversacion.cnv_motivo_escalamiento
        end,
        cnv_ultimo_mensaje_texto = left(v_texto, 280),
        cnv_ultimo_mensaje_origen = 'CLIENTE',
        cnv_ultimo_mensaje_en = now(),
        cnv_no_leidos_asesora = comun_agentes.agc_conversacion.cnv_no_leidos_asesora + 1,
        cnv_mensajes_cliente_conteo = comun_agentes.agc_conversacion.cnv_mensajes_cliente_conteo + 1,
        cnv_ventana_24h_expira_en = now() + interval '24 hours',
        cnv_actualizado_en = now()
      returning * into v_cnv;

      if v_etq_canal_id is not null then
        insert into comun_agentes.agc_conversacion_etiqueta (cet_negocio, cet_conversacion_id, cet_etiqueta_id)
        values (v_negocio, v_cnv.cnv_id, v_etq_canal_id)
        on conflict (cet_conversacion_id, cet_etiqueta_id) do update set cet_eliminado_en = null;
      end if;

      insert into comun_agentes.agc_mensaje (
        msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
        msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
      ) values (
        v_negocio, v_cnv.cnv_id, 'CLIENTE', v_cnv.cnv_remitente_nombre,
        v_texto, v_tipo_bd, v_id_ext, 'ENTREGADO',
        jsonb_strip_nulls(jsonb_build_object(
          'canal', v_canal,
          'imagen_url', v_imagen_url,
          'audio_url', v_audio_url,
          'audio_mime', v_audio_mime,
          'documento_url', v_doc_url,
          'documento_nombre', v_doc_nombre,
          'latitud', v_lat,
          'longitud', v_lng,
          'referral_meta', v_referral
        ))
      )
      on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
      do nothing
      returning * into v_msg_ins;

      if v_msg_ins.msg_id is null then
        continue;
      end if;

      if not v_canal_habilitado then
        v_accion := 'CANAL_SOLO_MONITOREO';
      elsif v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
        v_accion := 'SILENCIADO_HUMANO';
      elsif v_cnv.cnv_estado_atencion = 'ESCALADO_HUMANO' then
        v_accion := 'ESCALADO_HUMANO';
      elsif v_cnv.cnv_estado_atencion <> 'BOT_ACTIVO' then
        v_accion := 'SILENCIADO_HUMANO';
      else
        v_es_despedida_corta := (
          v_tipo_bd = 'TEXTO'
          and char_length(v_texto) <= 160
          and v_texto ~* '(hasta luego|hasta pronto|que tengas un (buen|excelente) d[ií]a|quedo a la orden|buena tarde)'
          and v_texto !~* '(\?|precio|cu[aá]nto|ramo|arreglo|flores|pedido|enviar|comprar|direcci[oó]n)'
        );
        v_accion := 'INVOCAR_ARIA';
        if v_es_despedida_corta then
          select count(*) into v_conteo_despedidas
          from comun_agentes.agc_mensaje m
          where m.msg_conversacion_id = v_cnv.cnv_id
            and m.msg_origen = 'BOT_ARIA'
            and m.msg_creado_en >= now() - interval '5 minutes'
            and m.msg_contenido ~* '(hasta luego|hasta pronto|excelente d[ií]a|buena tarde)';
          if v_conteo_despedidas >= 1 then
            v_accion := 'CORTE_BUCLE_DESPEDIDA';
          end if;
        end if;
      end if;

      v_eventos := v_eventos || jsonb_build_array(jsonb_build_object(
        'accion', v_accion,
        'canal', v_canal,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'tipoMensaje', v_tipo_bd,
        'imagenUrl', v_imagen_url,
        'audioUrl', v_audio_url,
        'audioMime', v_audio_mime,
        'documentoUrl', v_doc_url,
        'documentoNombre', v_doc_nombre,
        'latitud', v_lat,
        'longitud', v_lng,
        'referralMeta', v_referral,
        'remitenteId', v_cliente_ext_id,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      ));
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'canal', v_canal,
    'tokenWebhook', coalesce(nullif(btrim(v_aria.ari_detalle_aria->>'meta_webhook_token'), ''), v_token),
    'eventos', v_eventos,
    'comentarios', v_comentarios
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_procesar_webhook_meta(text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_procesar_webhook_meta(text, text, text, jsonb) to anon, authenticated, service_role;

-- 8. RPC de lectura: bitácora reciente de comentarios atendidos en Facebook e Instagram
create or replace function comun_comercio.com_fn_omnicanal_listar_comentarios_meta(
  p_negocio text,
  p_limite integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_lim integer := greatest(1, least(coalesce(p_limite, 25), 100));
  v_items jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para consultar el historial de comentarios.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.cmm_id,
        'canal', c.cmm_canal,
        'comentarioExternoId', c.cmm_comentario_externo_id,
        'postId', c.cmm_post_id,
        'autorNombre', coalesce(c.cmm_autor_nombre, 'Usuario'),
        'textoComentario', c.cmm_texto_comentario,
        'reglaAplicada', c.cmm_regla_aplicada,
        'respuestaPublica', c.cmm_respuesta_publica,
        'respuestaDm', c.cmm_respuesta_dm,
        'estado', c.cmm_estado,
        'detalle', c.cmm_detalle_comentario,
        'creadoEn', c.cmm_creado_en
      )
      order by c.cmm_creado_en desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from comun_agentes.agc_comentario_meta
    where cmm_negocio = v_negocio
      and cmm_eliminado_en is null
    order by cmm_creado_en desc
    limit v_lim
  ) c;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_listar_comentarios_meta(text, integer) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_listar_comentarios_meta(text, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
