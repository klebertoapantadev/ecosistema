-- =============================================================================
-- Migración: 20261127000001_omnicanal_comentarios_meta_tematicos_y_suscripcion_page.sql
-- Requerimiento: PLT-010 (Comentarios Automáticos Meta — Reglas Temáticas Directas
--                + Sincronización en 1 clic de `subscribed_apps` con `feed` en Meta)
-- Descripción:
--   1. Actualiza `comun_comercio.com_fn_interno_procesar_comentarios_meta` para que
--      los comentarios temáticos de CONDOLENCIAS (corona, velorio, pésame, fúnebre)
--      y EVENTOS (boda, matrimonio, decoración, proforma) disparen su respuesta
--      corta correspondiente incluso si el usuario no escribió "?" ni "precio".
--   2. Enriquece las palabras clave sembradas de Tinkay con términos de intención
--      frecuentes (necesito, corona, condolencias, velorio, boda, evento, cotización).
--   3. Crea RPC `comun_comercio.com_fn_omnicanal_sincronizar_meta_page` (Admin/SuperAdmin)
--      que usa el token cifrado en Vault para verificar la Página + cuenta IG vinculada
--      y suscribir `feed,messages,message_echoes,messaging_postbacks,messaging_referrals`
--      en `POST /v21.0/{page_id}/subscribed_apps` (cero secretos expuestos al cliente).
-- =============================================================================

-- 1. Ampliar palabras clave por defecto si conservan la lista semilla inicial
update comun_configuracion.cfg_aria
   set ari_detalle_aria = jsonb_set(
         coalesce(ari_detalle_aria, '{}'::jsonb),
         '{meta_comentarios_palabras_clave}',
         to_jsonb(
           btrim(coalesce(ari_detalle_aria->>'meta_comentarios_palabras_clave', ''))
           || ', necesito, corona, coronas, condolencias, velorio, boda, evento, eventos, cotizacion, cotización, direccion, dirección'
         ),
         true
       ),
       ari_actualizado_en = now()
 where ari_eliminado_en is null
   and coalesce(ari_detalle_aria->>'meta_comentarios_palabras_clave', '') <> ''
   and strpos(lower(coalesce(ari_detalle_aria->>'meta_comentarios_palabras_clave', '')), 'condolencias') = 0;

-- 2. Actualizar procesador interno de comentarios Meta para priorizar reglas temáticas
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
  v_habilitado boolean := coalesce((v_det->>'meta_comentarios_habilitado')::boolean, false);
  v_modo text := upper(coalesce(nullif(btrim(v_det->>'meta_comentarios_modo'), ''), 'PALABRAS_CLAVE'));
  v_solo_raiz boolean := coalesce((v_det->>'meta_comentarios_solo_raiz')::boolean, true);
  v_palabras text := coalesce(nullif(btrim(v_det->>'meta_comentarios_palabras_clave'), ''), 'precio, info, catalogo, cuanto, necesito, corona, condolencias, boda, evento, ?');
  v_url_tienda text := regexp_replace(coalesce(nullif(btrim(v_det->>'meta_comentarios_url_tienda'), ''), 'https://www.tinkay.net'), '/+$', '');
  v_tpl_general text := coalesce(nullif(btrim(v_det->>'meta_comentarios_respuesta_corta'), ''), '¡Hola {{nombre}}! 🌿 Mira modelos, precios actualizados y pide en línea aquí 👉 {{url_tienda}}');
  v_tpl_cond text := coalesce(nullif(btrim(v_det->>'meta_comentarios_respuesta_condolencias'), ''), v_tpl_general);
  v_tpl_ev text := coalesce(nullif(btrim(v_det->>'meta_comentarios_respuesta_eventos'), ''), v_tpl_general);
  v_enviar_dm boolean := coalesce((v_det->>'meta_comentarios_enviar_dm')::boolean, false);
  v_tpl_dm text := coalesce(nullif(btrim(v_det->>'meta_comentarios_plantilla_dm'), ''), '');
  v_page_id text := btrim(coalesce(v_det->>'meta_page_id', ''));
  v_ig_id text := btrim(coalesce(v_det->>'meta_ig_account_id', ''));
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
  v_es_condolencias boolean;
  v_es_eventos boolean;
  v_coincide boolean;
  v_regla text;
  v_resp_pub text;
  v_resp_dm text;
  v_estado text;
  v_despacho jsonb;
  v_cmm comun_agentes.agc_comentario_meta;
  v_resultados jsonb := '[]'::jsonb;
begin
  for v_entry in select value from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) loop
    for v_chg in select value from jsonb_array_elements(coalesce(v_entry->'changes', '[]'::jsonb)) loop
      v_field := lower(coalesce(v_chg->>'field', ''));
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
        v_es_condolencias := (v_texto ~* '(condolencia|corona|velaci[oó]n|velorio|funeral|p[eé]same|fallec|f[uú]nebre|exequi)');
        v_es_eventos := (v_texto ~* '(evento|boda|matrimonio|decoraci[oó]n|proforma|corporativo|quincea[ñn])');

        if v_es_condolencias or v_es_eventos then
          v_coincide := true;
        elsif v_modo = 'TODOS' then
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
          if v_es_condolencias then
            v_regla := 'CONDOLENCIAS';
            v_resp_pub := v_tpl_cond;
          elsif v_es_eventos then
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

-- 3. RPC Admin: Verificar Página/IG + Suscribir `feed` y mensajería a nivel de Página en Meta Graph API v21.0
create or replace function comun_comercio.com_fn_omnicanal_sincronizar_meta_page(
  p_negocio text,
  p_suscribir_feed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_page_sec_id uuid := null;
  v_page_token text := null;
  v_derived_page_token text := null;
  v_token_intercambiado boolean := false;
  v_page_id text := '';
  v_ig_id text := '';
  v_status integer;
  v_content text;
  v_json jsonb;
  v_pagina_nombre text := null;
  v_ig_username text := null;
  v_ig_detectado text := null;
  v_suscripcion_ok boolean := false;
  v_error_suscripcion text := null;
  v_campos_page jsonb := '[]'::jsonb;
  v_feed_suscrito boolean := false;
  v_permisos jsonb := '[]'::jsonb;
  v_campos_deseados text := 'feed,messages,message_echoes,messaging_postbacks,messaging_referrals';
begin
  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Solo administradores pueden sincronizar webhooks de Meta.');
  end if;

  select
    a.ari_meta_page_token_secreto_id,
    dp.decrypted_secret,
    coalesce(btrim(a.ari_detalle_aria->>'meta_page_id'), ''),
    coalesce(btrim(a.ari_detalle_aria->>'meta_ig_account_id'), '')
  into v_page_sec_id, v_page_token, v_page_id, v_ig_id
  from comun_configuracion.cfg_aria a
  left join vault.decrypted_secrets dp on dp.id = a.ari_meta_page_token_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if v_page_token is null or btrim(v_page_token) = '' then
    return jsonb_build_object('ok', false, 'error', 'Primero guarda tu Page Access Token o System User Token en Vault.');
  end if;

  if v_page_id = '' then
    return jsonb_build_object('ok', false, 'error', 'Primero configura el ID de tu Página de Facebook en la tarjeta de Meta.');
  end if;

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '20');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  -- A. Consultar permisos concedidos ANTES de derivar Page Token (System User Token expone /me/permissions)
  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'GET',
      'https://graph.facebook.com/v21.0/me/permissions',
      array[extensions.http_header('Authorization', 'Bearer ' || btrim(v_page_token))],
      null,
      null
    )::extensions.http_request) as h;

    begin v_json := v_content::jsonb; exception when others then v_json := null; end;
    if v_status >= 200 and v_status < 300 and jsonb_typeof(v_json->'data') = 'array' then
      select coalesce(jsonb_agg(p->>'permission' order by p->>'permission'), '[]'::jsonb)
        into v_permisos
      from jsonb_array_elements(v_json->'data') as p
      where lower(coalesce(p->>'status', '')) = 'granted';
    end if;
  exception when others then
    null;
  end;

  -- B. Consultar datos de Página + IG vinculado y derivar Page Access Token permanente si se ingresó System User Token
  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'GET',
      'https://graph.facebook.com/v21.0/' || v_page_id || '?fields=id,name,access_token,instagram_business_account%7Bid,username%7D',
      array[extensions.http_header('Authorization', 'Bearer ' || btrim(v_page_token))],
      null,
      null
    )::extensions.http_request) as h;

    begin v_json := v_content::jsonb; exception when others then v_json := null; end;
    if v_status >= 200 and v_status < 300 and v_json is not null then
      v_pagina_nombre := v_json->>'name';
      v_ig_detectado := v_json->'instagram_business_account'->>'id';
      v_ig_username := v_json->'instagram_business_account'->>'username';
      v_derived_page_token := nullif(btrim(coalesce(v_json->>'access_token', '')), '');

      if v_derived_page_token is not null and v_derived_page_token <> btrim(v_page_token) then
        v_page_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
          v_page_sec_id,
          v_derived_page_token,
          'meta_page_token_' || v_negocio,
          'Page Access Token permanente derivado de System User Token para ' || v_negocio
        );
        update comun_configuracion.cfg_aria
           set ari_meta_page_token_secreto_id = v_page_sec_id,
               ari_detalle_aria = case
                 when v_ig_detectado is not null and coalesce(ari_detalle_aria->>'meta_ig_account_id', '') = ''
                 then jsonb_set(coalesce(ari_detalle_aria, '{}'::jsonb), '{meta_ig_account_id}', to_jsonb(v_ig_detectado), true)
                 else ari_detalle_aria
               end,
               ari_actualizado_en = now()
         where ari_negocio = v_negocio
           and ari_eliminado_en is null;
        v_page_token := v_derived_page_token;
        v_token_intercambiado := true;
      end if;
    else
      return jsonb_build_object(
        'ok', false,
        'error', coalesce(v_json->'error'->>'message', 'Meta rechazó la consulta de la Página (HTTP ' || coalesce(v_status::text, '?') || '). Revisa que el token sea válido.')
      );
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'No se pudo consultar Meta Graph API (' || sqlerrm || ').');
  end;

  -- C. Suscribir `feed` + mensajería en `/{page_id}/subscribed_apps` usando el Page Access Token
  if coalesce(p_suscribir_feed, true) then
    begin
      select h.status, h.content into v_status, v_content
      from extensions.http((
        'POST',
        'https://graph.facebook.com/v21.0/' || v_page_id || '/subscribed_apps',
        array[extensions.http_header('Authorization', 'Bearer ' || btrim(v_page_token))],
        'application/json',
        jsonb_build_object('subscribed_fields', v_campos_deseados)::text
      )::extensions.http_request) as h;

      begin v_json := v_content::jsonb; exception when others then v_json := null; end;
      if v_status >= 200 and v_status < 300 and coalesce((v_json->>'success')::boolean, false) then
        v_suscripcion_ok := true;
      else
        v_error_suscripcion := coalesce(
          v_json->'error'->>'message',
          'Meta respondió HTTP ' || coalesce(v_status::text, '?') || ' al suscribir feed en la Página.'
        );
      end if;
    exception when others then
      v_error_suscripcion := sqlerrm;
    end;
  end if;

  -- D. Leer de vuelta los campos efectivamente suscritos en `/{page_id}/subscribed_apps`
  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'GET',
      'https://graph.facebook.com/v21.0/' || v_page_id || '/subscribed_apps',
      array[extensions.http_header('Authorization', 'Bearer ' || btrim(v_page_token))],
      null,
      null
    )::extensions.http_request) as h;

    begin v_json := v_content::jsonb; exception when others then v_json := null; end;
    if v_status >= 200 and v_status < 300 and jsonb_typeof(v_json->'data') = 'array' then
      select coalesce(jsonb_agg(distinct f), '[]'::jsonb)
        into v_campos_page
      from jsonb_array_elements(v_json->'data') as app_row,
           jsonb_array_elements_text(coalesce(app_row->'subscribed_fields', '[]'::jsonb)) as f;

      v_feed_suscrito := exists (
        select 1 from jsonb_array_elements_text(v_campos_page) as f where lower(f) = 'feed'
      );
    end if;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'paginaId', v_page_id,
    'paginaNombre', v_pagina_nombre,
    'igId', coalesce(v_ig_detectado, nullif(v_ig_id, '')),
    'igUsername', v_ig_username,
    'tokenIntercambiadoAPagina', v_token_intercambiado,
    'suscripcionActualizada', v_suscripcion_ok,
    'errorSuscripcion', v_error_suscripcion,
    'camposSuscritosPage', v_campos_page,
    'feedSuscrito', v_feed_suscrito,
    'permisosConcedidos', v_permisos
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_sincronizar_meta_page(text, boolean) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_sincronizar_meta_page(text, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
