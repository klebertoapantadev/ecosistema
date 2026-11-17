-- =============================================================================
-- Migración: Notas de Voz (Audio + Transcripción como Nota Interna + Respuesta ARIA),
--            Despacho Nativo de Imágenes/Documentos en YCloud WhatsApp y Catálogo en Chat
-- Fecha: 2026-11-17
-- =============================================================================

-- 1. Columna Vault para clave IA de transcripción de notas de voz (Gemini / OpenRouter / OpenAI)
alter table comun_configuracion.cfg_aria
  add column if not exists ari_stt_secreto_id uuid;

-- 2. Actualizar cfg_fn_guardar_whatsapp_ycloud con soporte opcional p_stt_api_key
drop function if exists comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean);
drop function if exists comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean, text);

create or replace function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(
  p_negocio text,
  p_habilitado boolean,
  p_numero_emisor text,
  p_numeros_permitidos text default '',
  p_whatsapp_agente_id text default null,
  p_ycloud_api_key text default null,
  p_ycloud_webhook_secret text default null,
  p_whatsapp_agente_key text default null,
  p_regenerar_token_url boolean default false,
  p_stt_api_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_emisor text := regexp_replace(btrim(coalesce(p_numero_emisor, '')), '\s+', '', 'g');
  v_permitidos text := btrim(coalesce(p_numeros_permitidos, ''));
  v_wa_agente_id text := nullif(btrim(coalesce(p_whatsapp_agente_id, '')), '');
  v_fila comun_configuracion.cfg_aria;
  v_ycloud_sec_id uuid;
  v_webhook_sec_id uuid;
  v_wa_ag_sec_id uuid;
  v_stt_sec_id uuid;
  v_token_url text;
  v_nuevo_detalle jsonb;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede configurar el canal WhatsApp YCloud.');
  end if;

  if v_emisor <> '' and left(v_emisor, 1) <> '+' then
    v_emisor := '+' || regexp_replace(v_emisor, '\D', '', 'g');
  end if;

  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  v_ycloud_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_ycloud_api_secreto_id,
    p_ycloud_api_key,
    'ycloud_api_key_' || v_negocio,
    'YCloud API Key del negocio ' || v_negocio
  );

  v_webhook_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_ycloud_webhook_secreto_id,
    p_ycloud_webhook_secret,
    'ycloud_webhook_secret_' || v_negocio,
    'YCloud Webhook Signing Secret del negocio ' || v_negocio
  );

  v_wa_ag_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_whatsapp_agente_secreto_id,
    p_whatsapp_agente_key,
    'aria_whatsapp_agent_key_' || v_negocio,
    'Token de Agente ARIA dedicado a WhatsApp para ' || v_negocio
  );

  v_stt_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_stt_secreto_id,
    p_stt_api_key,
    'aria_stt_voice_key_' || v_negocio,
    'Clave IA de transcripción de notas de voz para ' || v_negocio
  );

  if coalesce(p_habilitado, false) then
    if v_ycloud_sec_id is null then
      return jsonb_build_object('ok', false, 'error', 'Pega tu API Key de YCloud antes de habilitar el canal WhatsApp.');
    end if;
    if v_emisor = '' then
      return jsonb_build_object('ok', false, 'error', 'Indica el Número emisor de WhatsApp en formato E.164 (ej. +593996438873).');
    end if;
  end if;

  v_token_url := case
    when coalesce(p_regenerar_token_url, false)
      or coalesce(nullif(btrim(v_fila.ari_detalle_aria->>'ycloud_webhook_token'), ''), '') = ''
    then encode(extensions.gen_random_bytes(16), 'hex')
    else btrim(v_fila.ari_detalle_aria->>'ycloud_webhook_token')
  end;

  v_nuevo_detalle := coalesce(v_fila.ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
    'ycloud_habilitado', coalesce(p_habilitado, false),
    'ycloud_numero_emisor', v_emisor,
    'ycloud_numeros_permitidos', v_permitidos,
    'whatsapp_agente_id', v_wa_agente_id,
    'ycloud_webhook_token', v_token_url,
    'respaldo_webhook_aria_previo', coalesce(
      v_fila.ari_detalle_aria->>'respaldo_webhook_aria_previo',
      'https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf'
    )
  );

  insert into comun_configuracion.cfg_aria (
    ari_negocio,
    ari_base_url,
    ari_ycloud_api_secreto_id,
    ari_ycloud_webhook_secreto_id,
    ari_whatsapp_agente_secreto_id,
    ari_stt_secreto_id,
    ari_detalle_aria,
    ari_actualizado_en
  ) values (
    v_negocio,
    coalesce(v_fila.ari_base_url, 'https://aria.midomo.site'),
    v_ycloud_sec_id,
    v_webhook_sec_id,
    v_wa_ag_sec_id,
    v_stt_sec_id,
    v_nuevo_detalle,
    now()
  )
  on conflict (ari_negocio) do update set
    ari_ycloud_api_secreto_id = excluded.ari_ycloud_api_secreto_id,
    ari_ycloud_webhook_secreto_id = excluded.ari_ycloud_webhook_secreto_id,
    ari_whatsapp_agente_secreto_id = excluded.ari_whatsapp_agente_secreto_id,
    ari_stt_secreto_id = excluded.ari_stt_secreto_id,
    ari_detalle_aria = excluded.ari_detalle_aria,
    ari_actualizado_en = now();

  return jsonb_build_object(
    'ok', true,
    'webhookToken', v_token_url,
    'tieneYcloudApiKey', (v_ycloud_sec_id is not null),
    'tieneWebhookSecret', (v_webhook_sec_id is not null),
    'tieneWhatsappAgenteKey', (v_wa_ag_sec_id is not null),
    'tieneSttApiKey', (v_stt_sec_id is not null)
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean, text) to authenticated, service_role;

-- 3. Despachador interno YCloud WhatsApp v2 con soporte nativo de IMAGEN, DOCUMENTO y TEXTO
drop function if exists comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text);
drop function if exists comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text, text, text, text);

create or replace function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
  p_negocio text,
  p_destino text,
  p_texto text,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_api_key text;
  v_emisor text;
  v_destino_digitos text := regexp_replace(coalesce(p_destino, ''), '\D', '', 'g');
  v_destino_e164 text;
  v_img_url text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_doc_url text := nullif(btrim(coalesce(p_documento_url, '')), '');
  v_doc_nombre text := coalesce(nullif(btrim(coalesce(p_documento_nombre, '')), ''), 'documento.pdf');
  v_texto_limpio text := btrim(coalesce(p_texto, ''));
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
begin
  if v_destino_digitos = '' then
    return jsonb_build_object('ok', false, 'error', 'Número de WhatsApp destino vacío.');
  end if;

  if v_destino_digitos ~ '^09\d{8}$' then
    v_destino_digitos := '593' || substring(v_destino_digitos from 2);
  end if;
  v_destino_e164 := '+' || v_destino_digitos;

  select
    d.decrypted_secret,
    coalesce(nullif(btrim(a.ari_detalle_aria->>'ycloud_numero_emisor'), ''), '+593996438873')
  into v_api_key, v_emisor
  from comun_configuracion.cfg_aria a
  left join vault.decrypted_secrets d on d.id = a.ari_ycloud_api_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Falta configurar la API Key de YCloud en /panel/aria para despachar mensajes a WhatsApp.'
    );
  end if;

  v_emisor := '+' || regexp_replace(v_emisor, '\D', '', 'g');

  -- Si no se pasó p_imagen_url explícito pero el texto trae sintaxis Markdown ![alt](https://...), extraerla
  if v_img_url is null and v_doc_url is null then
    v_img_url := substring(v_texto_limpio from '!\s*\[[^\]]*\]\s*\(\s*(https?://[^)\s]+)\s*\)');
  end if;

  -- Limpiar sintaxis Markdown cruda de imágenes/documentos del texto que verá el cliente en su teléfono WhatsApp
  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '!\s*\[[^\]]*\]\s*\(\s*https?://[^)]+\)', '', 'g'));
  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '📄\s*\[[^\]]+\]\(\s*https?://[^)]+\)', '', 'g'));

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  if v_doc_url is not null and v_doc_url ~* '^https?://' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'document',
      'document', jsonb_strip_nulls(jsonb_build_object(
        'link', v_doc_url,
        'filename', left(v_doc_nombre, 120),
        'caption', case when v_texto_limpio <> '' then left(v_texto_limpio, 1020) else null end
      ))
    );
  elsif v_img_url is not null and v_img_url ~* '^https?://' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'image',
      'image', jsonb_strip_nulls(jsonb_build_object(
        'link', v_img_url,
        'caption', case when v_texto_limpio <> '' then left(v_texto_limpio, 1020) else null end
      ))
    );
  else
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'text',
      'text', jsonb_build_object(
        'body', left(coalesce(nullif(v_texto_limpio, ''), p_texto, 'Mensaje'), 4000),
        'preview_url', true
      )
    );
  end if;

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
      array[extensions.http_header('X-API-Key', v_api_key)],
      'application/json',
      v_cuerpo::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'No se pudo conectar con YCloud API (' || sqlerrm || ')'
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
      'status', v_status,
      'error', coalesce(
        v_json->'error'->>'message',
        v_json->'error'->'whatsappApiError'->>'message',
        v_json->>'message',
        'YCloud respondió HTTP ' || coalesce(v_status::text, '?')
      )
    );
  end if;

  -- Si se envió imagen/documento y el texto superaba los 1020 caracteres de caption de WhatsApp, enviar el resto como texto
  if (v_img_url is not null or v_doc_url is not null) and char_length(v_texto_limpio) > 1020 then
    begin
      perform extensions.http((
        'POST',
        'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
        array[extensions.http_header('X-API-Key', v_api_key)],
        'application/json',
        jsonb_build_object(
          'from', v_emisor,
          'to', v_destino_e164,
          'type', 'text',
          'text', jsonb_build_object(
            'body', substring(v_texto_limpio from 1021 for 3000),
            'preview_url', true
          )
        )::text
      )::extensions.http_request);
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idExterno', coalesce(v_json->>'wamid', v_json->>'id'),
    'ycloudId', v_json->>'id',
    'estado', coalesce(v_json->>'status', 'sent')
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text, text, text, text) from public, anon, authenticated;

-- 4. Actualizar com_fn_omnicanal_enviar_mensaje_asesor con soporte de imagen, documento y producto de catálogo
drop function if exists comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid);
drop function if exists comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid, text, text, text);

create or replace function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(
  p_negocio text,
  p_conversacion_id uuid,
  p_contenido text,
  p_es_nota_interna boolean default false,
  p_respuesta_rapida_id uuid default null,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_autor_nombre text;
  v_texto text := btrim(coalesce(p_contenido, ''));
  v_img text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_doc text := nullif(btrim(coalesce(p_documento_url, '')), '');
  v_doc_nom text := nullif(btrim(coalesce(p_documento_nombre, '')), '');
  v_origen text := case when coalesce(p_es_nota_interna, false) then 'NOTA_INTERNA' else 'ASESORA_HUMANA' end;
  v_tipo_contenido text;
  v_cnv_prev comun_agentes.agc_conversacion;
  v_envio_wa jsonb := null;
  v_estado_entrega text := 'ENVIADO';
  v_id_externo text := null;
  v_msg comun_agentes.agc_mensaje;
  v_cnv comun_agentes.agc_conversacion;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para responder en este negocio.');
  end if;

  if v_texto = '' and v_img is null and v_doc is null then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje o selecciona un adjunto antes de enviar.');
  end if;

  select * into v_cnv_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv_prev.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Asesor')
    into v_autor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_tipo_contenido := case
    when v_doc is not null then 'DOCUMENTO'
    when v_img is not null or v_texto ~* '!\s*\[[^\]]*\]\s*\(\s*https?://' then 'IMAGEN'
    else 'TEXTO'
  end;

  if v_texto = '' then
    if v_doc is not null then
      v_texto := '📄 Documento enviado: ' || coalesce(v_doc_nom, 'archivo');
    elsif v_img is not null then
      v_texto := '![Fotografía adjunta](' || v_img || ')';
    end if;
  end if;

  -- Si la conversación es de WhatsApp y no es nota interna, despachar vía YCloud API (imagen, documento o texto)
  if v_cnv_prev.cnv_canal = 'whatsapp' and not coalesce(p_es_nota_interna, false) then
    v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
      v_negocio,
      coalesce(nullif(v_cnv_prev.cnv_remitente_telefono, ''), v_cnv_prev.cnv_remitente_id),
      v_texto,
      v_img,
      v_doc,
      v_doc_nom
    );
    if coalesce((v_envio_wa->>'ok')::boolean, false) then
      v_id_externo := v_envio_wa->>'idExterno';
      v_estado_entrega := 'ENVIADO';
    else
      v_estado_entrega := 'FALLIDO';
    end if;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_usuario_id,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  )
  values (
    v_negocio,
    p_conversacion_id,
    v_origen,
    v_uid,
    v_autor_nombre,
    v_texto,
    v_tipo_contenido,
    v_id_externo,
    v_estado_entrega,
    jsonb_strip_nulls(jsonb_build_object(
      'intervencion_humana', (not coalesce(p_es_nota_interna, false)),
      'respuesta_rapida_id', p_respuesta_rapida_id,
      'canal', v_cnv_prev.cnv_canal,
      'imagen_url', v_img,
      'documento_url', v_doc,
      'documento_nombre', v_doc_nom,
      'error_whatsapp', case when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg;

  if p_respuesta_rapida_id is not null then
    update comun_agentes.agc_respuesta_rapida
       set rrp_uso_conteo = rrp_uso_conteo + 1,
           rrp_actualizado_en = now()
     where rrp_id = p_respuesta_rapida_id
       and rrp_negocio = v_negocio;
  end if;

  if not coalesce(p_es_nota_interna, false) then
    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_asesora_asignada_id = coalesce(cnv_asesora_asignada_id, v_uid),
           cnv_atribuido_por = case when cnv_asesora_asignada_id is null then 'MANUAL' else cnv_atribuido_por end,
           cnv_ultimo_mensaje_texto = left(v_texto, 280),
           cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = 0,
           cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
     returning * into v_cnv;
  else
    select * into v_cnv from comun_agentes.agc_conversacion where cnv_id = p_conversacion_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo,
    'avisoWhatsApp', case
      when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false)
      then v_envio_wa->>'error'
      else null
    end,
    'mensaje', jsonb_build_object(
      'id', v_msg.msg_id,
      'origen', v_msg.msg_origen,
      'autorUsuarioId', v_msg.msg_autor_usuario_id,
      'autorNombre', v_msg.msg_autor_nombre,
      'contenido', v_msg.msg_contenido,
      'tipoContenido', v_msg.msg_tipo_contenido,
      'estadoEntrega', v_msg.msg_estado_entrega,
      'detalle', v_msg.msg_detalle_mensaje,
      'creadoEn', v_msg.msg_creado_en
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid, text, text, text) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid, text, text, text) to authenticated, service_role;

-- 5. Actualizar com_fn_omnicanal_procesar_webhook_ycloud para capturar audio_url, voice y documento_url
create or replace function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(
  p_token text,
  p_firma text default null,
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
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_webhook_secret text;
  v_t text;
  v_s text;
  v_hmac text;
  v_tipo_evento text := coalesce(p_payload->>'type', '');
  v_msg_obj jsonb;
  v_in jsonb;
  v_id_ext text;
  v_from_digitos text;
  v_to_digitos text;
  v_emisor_digitos text;
  v_nombre_perfil text;
  v_msg_tipo text;
  v_texto text := '';
  v_tipo_bd text := 'TEXTO';
  v_imagen_url text := null;
  v_audio_url text := null;
  v_audio_mime text := null;
  v_doc_url text := null;
  v_doc_nombre text := null;
  v_lat numeric := null;
  v_lng numeric := null;
  v_clave_hilo text;
  v_usu_id uuid := null;
  v_cli_id uuid := null;
  v_pide_humano boolean := false;
  v_cnv comun_agentes.agc_conversacion;
  v_msg_ins comun_agentes.agc_mensaje;
  v_etq_wa_id uuid;
  v_habilitado boolean := false;
  v_lista_blanca text := '';
  v_autorizado_ia boolean := true;
  v_conteo_despedidas int := 0;
  v_es_despedida_corta boolean := false;
  v_estado_upd text;
begin
  if v_token = '' then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook ausente.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook no reconocido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  if v_aria.ari_ycloud_webhook_secreto_id is not null then
    select d.decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_ycloud_webhook_secreto_id;

    if v_webhook_secret is not null and btrim(v_webhook_secret) <> '' then
      v_t := substring(coalesce(p_firma, '') from 't=([0-9]+)');
      v_s := lower(substring(coalesce(p_firma, '') from 's=([0-9a-fA-F]+)'));
      if v_t is null or v_s is null or p_cuerpo_raw is null then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature requerida.');
      end if;
      v_hmac := encode(extensions.hmac(v_t || '.' || p_cuerpo_raw, v_webhook_secret, 'sha256'), 'hex');
      if v_hmac <> v_s then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature inválida.');
      end if;
    end if;
  end if;

  -- CASO A: Actualización de estado de entrega/lectura
  if v_tipo_evento = 'whatsapp.message.updated' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''));
    v_estado_upd := case lower(coalesce(v_msg_obj->>'status', ''))
      when 'delivered' then 'ENTREGADO'
      when 'read' then 'LEIDO'
      when 'failed' then 'FALLIDO'
      else 'ENVIADO'
    end;

    if v_id_ext is not null then
      update comun_agentes.agc_mensaje
         set msg_estado_entrega = v_estado_upd,
             msg_actualizado_en = now()
       where msg_negocio = v_negocio
         and msg_id_externo = v_id_ext;
    end if;

    return jsonb_build_object('ok', true, 'accion', 'ESTADO_ACTUALIZADO');
  end if;

  -- CASO B: Eco desde la App Móvil de WhatsApp Business (Coexistencia SMB)
  if v_tipo_evento = 'whatsapp.smb.message.echoes' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''), nullif(p_payload->>'id', ''));
    v_to_digitos := regexp_replace(coalesce(v_msg_obj->>'to', ''), '\D', '', 'g');
    v_msg_tipo := lower(coalesce(v_msg_obj->>'type', 'text'));

    if v_msg_tipo = 'image' then
      v_tipo_bd := 'IMAGEN';
      v_imagen_url := nullif(btrim(coalesce(v_msg_obj->'image'->>'link', '')), '');
      v_texto := btrim(coalesce(
        nullif(v_msg_obj->'image'->>'caption', ''),
        case when v_imagen_url is not null then '![Foto enviada desde WhatsApp Móvil](' || v_imagen_url || ')' else '📷 Imagen enviada desde WhatsApp Móvil' end
      ));
    elsif v_msg_tipo in ('audio', 'voice') then
      v_tipo_bd := 'AUDIO';
      v_audio_url := nullif(btrim(coalesce(v_msg_obj->'audio'->>'link', v_msg_obj->'voice'->>'link', '')), '');
      v_audio_mime := nullif(btrim(coalesce(v_msg_obj->'audio'->>'mime_type', v_msg_obj->'voice'->>'mime_type', '')), '');
      v_texto := '🎤 Nota de voz enviada desde WhatsApp Móvil';
    elsif v_msg_tipo = 'document' then
      v_tipo_bd := 'DOCUMENTO';
      v_doc_url := nullif(btrim(coalesce(v_msg_obj->'document'->>'link', '')), '');
      v_doc_nombre := coalesce(nullif(btrim(v_msg_obj->'document'->>'filename'), ''), 'documento');
      v_texto := '📄 Documento enviado: ' || v_doc_nombre;
    else
      v_texto := btrim(coalesce(v_msg_obj->'text'->>'body', ''));
    end if;

    if v_to_digitos = '' or v_texto = '' then
      return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
    end if;

    if v_id_ext is not null and exists (
      select 1 from comun_agentes.agc_mensaje
      where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
    ) then
      return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
    end if;

    v_clave_hilo := 'wa:' || v_to_digitos;

    insert into comun_agentes.agc_conversacion (
      cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
      cnv_remitente_telefono, cnv_estado_atencion, cnv_ultimo_mensaje_texto,
      cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en, cnv_mensajes_humano_conteo
    ) values (
      v_negocio, 'whatsapp', v_clave_hilo, '+' || v_to_digitos, 'WhatsApp +' || v_to_digitos,
      '+' || v_to_digitos, 'EN_ATENCION_ASESORA', left(v_texto, 280),
      'ASESORA_HUMANA', now(), 1
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
      v_negocio, v_cnv.cnv_id, 'ASESORA_HUMANA', 'WhatsApp Móvil Tienda',
      v_texto, v_tipo_bd, v_id_ext, 'ENVIADO',
      jsonb_strip_nulls(jsonb_build_object(
        'canal', 'whatsapp',
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

    return jsonb_build_object(
      'ok', true,
      'accion', 'ECO_MOVIL_REGISTRADO',
      'negocio', v_negocio,
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
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  -- CASO C: Mensaje Entrante del Cliente (whatsapp.inbound_message.received)
  if v_tipo_evento <> 'whatsapp.inbound_message.received' and not (p_payload ? 'whatsappInboundMessage') then
    return jsonb_build_object('ok', true, 'accion', 'EVENTO_IGNORADO', 'tipo', v_tipo_evento);
  end if;

  v_in := coalesce(p_payload->'whatsappInboundMessage', '{}'::jsonb);
  v_id_ext := coalesce(nullif(v_in->>'wamid', ''), nullif(v_in->>'id', ''), nullif(p_payload->>'id', ''));
  v_from_digitos := regexp_replace(coalesce(v_in->>'from', ''), '\D', '', 'g');
  v_emisor_digitos := regexp_replace(coalesce(v_aria.ari_detalle_aria->>'ycloud_numero_emisor', ''), '\D', '', 'g');

  if v_from_digitos = '' or (v_emisor_digitos <> '' and v_from_digitos = v_emisor_digitos) then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_EMISOR_PROPIO');
  end if;

  if v_id_ext is not null and exists (
    select 1 from comun_agentes.agc_mensaje
    where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
  ) then
    return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
  end if;

  v_nombre_perfil := coalesce(
    nullif(btrim(coalesce(v_in->'customerProfile'->>'name', '')), ''),
    'WhatsApp +' || v_from_digitos
  );
  v_msg_tipo := lower(coalesce(v_in->>'type', 'text'));

  if v_msg_tipo = 'text' then
    v_texto := btrim(coalesce(v_in->'text'->>'body', ''));
  elsif v_msg_tipo = 'interactive' then
    v_texto := btrim(coalesce(
      v_in->'interactive'->'button_reply'->>'title',
      v_in->'interactive'->'list_reply'->>'title',
      v_in->'interactive'->>'body',
      'Selección interactiva'
    ));
  elsif v_msg_tipo = 'button' then
    v_texto := btrim(coalesce(v_in->'button'->>'text', v_in->'button'->>'payload', 'Botón'));
  elsif v_msg_tipo = 'location' then
    v_tipo_bd := 'UBICACION';
    begin
      v_lat := (v_in->'location'->>'latitude')::numeric;
      v_lng := (v_in->'location'->>'longitude')::numeric;
    exception when others then
      v_lat := null; v_lng := null;
    end;
    v_texto := btrim(
      '📍 Ubicación compartida: ' ||
      coalesce(nullif(v_in->'location'->>'name', '') || ' - ', '') ||
      coalesce(nullif(v_in->'location'->>'address', '') || ' ', '') ||
      case when v_lat is not null and v_lng is not null
        then '(https://www.google.com/maps?q=' || v_lat::text || ',' || v_lng::text || ')'
        else ''
      end
    );
  elsif v_msg_tipo = 'image' then
    v_tipo_bd := 'IMAGEN';
    v_imagen_url := nullif(btrim(coalesce(v_in->'image'->>'link', '')), '');
    v_texto := btrim(coalesce(
      nullif(v_in->'image'->>'caption', ''),
      '📷 Imagen adjunta por el cliente' || case when v_imagen_url is not null then ': ' || v_imagen_url else '' end
    ));
  elsif v_msg_tipo in ('audio', 'voice') then
    v_tipo_bd := 'AUDIO';
    v_audio_url := nullif(btrim(coalesce(v_in->'audio'->>'link', v_in->'voice'->>'link', '')), '');
    v_audio_mime := coalesce(
      nullif(btrim(coalesce(v_in->'audio'->>'mime_type', v_in->'voice'->>'mime_type', '')), ''),
      'audio/ogg'
    );
    v_texto := '🎤 Nota de voz recibida por WhatsApp';
  elsif v_msg_tipo = 'document' then
    v_tipo_bd := 'DOCUMENTO';
    v_doc_url := nullif(btrim(coalesce(v_in->'document'->>'link', '')), '');
    v_doc_nombre := coalesce(nullif(btrim(v_in->'document'->>'filename'), ''), 'archivo');
    v_texto := btrim(coalesce(
      nullif(v_in->'document'->>'caption', ''),
      '📄 Documento recibido: ' || v_doc_nombre
    ));
  else
    v_texto := btrim(coalesce(v_in->'text'->>'body', 'Mensaje (' || v_msg_tipo || ')'));
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
  end if;

  v_clave_hilo := 'wa:' || v_from_digitos;

  select u.usu_id into v_usu_id
  from comun_seguridad.seg_usuario u
  where regexp_replace(coalesce(u.usu_whatsapp, ''), '\D', '', 'g') like '%' || right(v_from_digitos, 9)
  limit 1;

  select c.cli_id into v_cli_id
  from comun_comercio.com_cliente c
  where c.cli_negocio = v_negocio
    and c.cli_eliminado_en is null
    and regexp_replace(coalesce(c.cli_telefono, ''), '\D', '', 'g') like '%' || right(v_from_digitos, 9)
  order by c.cli_actualizado_en desc
  limit 1;

  v_pide_humano := (v_texto ~* '(hablar con (un |una )?(asesor|humano|persona|vendedor)|atenci[oó]n humana|reclamo|queja)');

  insert into comun_agentes.agc_conversacion (
    cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
    cnv_remitente_telefono, cnv_usuario_id, cnv_cliente_id, cnv_estado_atencion,
    cnv_motivo_escalamiento, cnv_ultimo_mensaje_texto, cnv_ultimo_mensaje_origen,
    cnv_ultimo_mensaje_en, cnv_no_leidos_asesora, cnv_mensajes_cliente_conteo, cnv_ventana_24h_expira_en
  ) values (
    v_negocio, 'whatsapp', v_clave_hilo, '+' || v_from_digitos, v_nombre_perfil,
    '+' || v_from_digitos, v_usu_id, v_cli_id,
    case when v_pide_humano then 'ESCALADO_HUMANO' else 'BOT_ACTIVO' end,
    case when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp' else null end,
    left(v_texto, 280), 'CLIENTE', now(), 1, 1, now() + interval '24 hours'
  )
  on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
  do update set
    cnv_remitente_nombre = case
      when comun_agentes.agc_conversacion.cnv_remitente_nombre like 'WhatsApp +%' then excluded.cnv_remitente_nombre
      else comun_agentes.agc_conversacion.cnv_remitente_nombre
    end,
    cnv_usuario_id = coalesce(comun_agentes.agc_conversacion.cnv_usuario_id, excluded.cnv_usuario_id),
    cnv_cliente_id = coalesce(comun_agentes.agc_conversacion.cnv_cliente_id, excluded.cnv_cliente_id),
    cnv_estado_atencion = case
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then 'EN_ATENCION_ASESORA'
      when v_pide_humano then 'ESCALADO_HUMANO'
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'CERRADO' then 'BOT_ACTIVO'
      else comun_agentes.agc_conversacion.cnv_estado_atencion
    end,
    cnv_motivo_escalamiento = case
      when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp'
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

  select etq_id into v_etq_wa_id
  from comun_agentes.agc_etiqueta
  where etq_negocio = v_negocio and etq_slug = 'origen-whatsapp' and etq_eliminado_en is null
  limit 1;

  if v_etq_wa_id is not null then
    insert into comun_agentes.agc_conversacion_etiqueta (cet_negocio, cet_conversacion_id, cet_etiqueta_id)
    values (v_negocio, v_cnv.cnv_id, v_etq_wa_id)
    on conflict (cet_conversacion_id, cet_etiqueta_id) do update set cet_eliminado_en = null;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, v_cnv.cnv_id, 'CLIENTE', v_cnv.cnv_remitente_nombre,
    v_texto, v_tipo_bd, v_id_ext, 'ENTREGADO',
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'imagen_url', v_imagen_url,
      'audio_url', v_audio_url,
      'audio_mime', v_audio_mime,
      'documento_url', v_doc_url,
      'documento_nombre', v_doc_nombre,
      'latitud', v_lat,
      'longitud', v_lng
    ))
  )
  returning * into v_msg_ins;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object(
      'ok', true,
      'accion', 'SILENCIADO_HUMANO',
      'negocio', v_negocio,
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
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  v_habilitado := coalesce((v_aria.ari_detalle_aria->>'ycloud_habilitado')::boolean, false);
  if not v_habilitado then
    return jsonb_build_object(
      'ok', true,
      'accion', 'CANAL_SOLO_MONITOREO',
      'negocio', v_negocio,
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
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  v_lista_blanca := regexp_replace(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[^0-9,;|\n]+', '', 'g');
  if btrim(regexp_replace(v_lista_blanca, '[,;|\n]', '', 'g')) <> '' then
    v_autorizado_ia := exists (
      select 1
      from regexp_split_to_table(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[,;|\n]+') as item_num
      where length(regexp_replace(item_num, '\D', '', 'g')) >= 8
        and right(v_from_digitos, 9) = right(regexp_replace(item_num, '\D', '', 'g'), 9)
    );
    if not v_autorizado_ia then
      return jsonb_build_object(
        'ok', true,
        'accion', 'FUERA_LISTA_BLANCA',
        'negocio', v_negocio,
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
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      );
    end if;
  end if;

  v_es_despedida_corta := (
    v_tipo_bd = 'TEXTO'
    and char_length(v_texto) <= 160
    and v_texto ~* '(hasta luego|hasta pronto|que tengas un (buen|excelente) d[ií]a|quedo a la orden|buena tarde)'
    and v_texto !~* '(\?|precio|cu[aá]nto|ramo|arreglo|flores|pedido|enviar|comprar|direcci[oó]n)'
  );

  if v_es_despedida_corta then
    select count(*) into v_conteo_despedidas
    from comun_agentes.agc_mensaje m
    where m.msg_conversacion_id = v_cnv.cnv_id
      and m.msg_origen = 'BOT_ARIA'
      and m.msg_creado_en >= now() - interval '5 minutes'
      and m.msg_contenido ~* '(hasta luego|hasta pronto|excelente d[ií]a|buena tarde)';

    if v_conteo_despedidas >= 1 then
      return jsonb_build_object(
        'ok', true,
        'accion', 'CORTE_BUCLE_DESPEDIDA',
        'negocio', v_negocio,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'accion', 'INVOCAR_ARIA',
    'negocio', v_negocio,
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
    'remitenteNombre', v_cnv.cnv_remitente_nombre,
    'remitenteTelefono', v_cnv.cnv_remitente_telefono,
    'estadoAtencion', v_cnv.cnv_estado_atencion
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) to anon, authenticated, service_role;

-- 6. RPC para actualizar la URL pública permanente en Storage de un audio/documento/imagen recibido
create or replace function comun_comercio.com_fn_omnicanal_actualizar_media_mensaje(
  p_token text,
  p_mensaje_id uuid,
  p_audio_url text default null,
  p_documento_url text default null,
  p_imagen_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text;
begin
  select a.ari_negocio into v_negocio
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(coalesce(p_token, ''))
  limit 1;

  if v_negocio is null then
    return jsonb_build_object('ok', false, 'error', 'Token inválido');
  end if;

  update comun_agentes.agc_mensaje
     set msg_detalle_mensaje = coalesce(msg_detalle_mensaje, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'audio_url', nullif(btrim(coalesce(p_audio_url, '')), ''),
           'documento_url', nullif(btrim(coalesce(p_documento_url, '')), ''),
           'imagen_url', nullif(btrim(coalesce(p_imagen_url, '')), '')
         )),
         msg_actualizado_en = now()
   where msg_id = p_mensaje_id
     and msg_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_actualizar_media_mensaje(text, uuid, text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_media_mensaje(text, uuid, text, text, text) to anon, authenticated, service_role;

-- 7. RPC Transaccional: Transcribir nota de voz con clave IA de Vault (sin exponer secreto)
--    y guardarla como "NOTA_INTERNA" en el hilo de la conversación
create or replace function comun_comercio.com_fn_omnicanal_transcribir_y_guardar_nota_voz(
  p_negocio text,
  p_conversacion_id uuid,
  p_mensaje_audio_id uuid default null,
  p_audio_base64 text default null,
  p_mime_type text default 'audio/ogg',
  p_transcripcion_precalculada text default null,
  p_token_webhook text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_autorizado boolean := false;
  v_aria comun_configuracion.cfg_aria;
  v_stt_key text := null;
  v_transcripcion text := nullif(btrim(coalesce(p_transcripcion_precalculada, '')), '');
  v_mime_limpio text := split_part(lower(btrim(coalesce(p_mime_type, 'audio/ogg'))), ';', 1);
  v_prompt_stt text := 'Transcribe exactamente en español lo que dice el cliente en esta nota de voz para nuestra tienda. Devuelve ÚNICAMENTE el texto transcrito literal sin comillas ni explicaciones adicionales.';
  v_status integer;
  v_content text;
  v_json jsonb;
  v_msg_nota comun_agentes.agc_mensaje;
  v_existente comun_agentes.agc_mensaje;
begin
  -- Autorización: token válido de webhook YCloud O miembro autenticado del equipo de ventas
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if p_token_webhook is not null and btrim(p_token_webhook) <> ''
     and v_aria.ari_id is not null
     and btrim(coalesce(v_aria.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(p_token_webhook) then
    v_autorizado := true;
  elsif comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    v_autorizado := true;
  end if;

  if not v_autorizado then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para transcribir notas de voz.');
  end if;

  -- Idempotencia: si este mensaje de audio ya tiene su Nota Interna de transcripción creada, devolverla
  if p_mensaje_audio_id is not null then
    select * into v_existente
    from comun_agentes.agc_mensaje m
    where m.msg_conversacion_id = p_conversacion_id
      and m.msg_origen = 'NOTA_INTERNA'
      and m.msg_eliminado_en is null
      and m.msg_detalle_mensaje->>'audio_mensaje_id' = p_mensaje_audio_id::text
    order by m.msg_creado_en desc
    limit 1;

    if v_existente.msg_id is not null then
      return jsonb_build_object(
        'ok', true,
        'yaExistia', true,
        'transcripcion', coalesce(v_existente.msg_detalle_mensaje->>'transcripcion_limpia', v_existente.msg_contenido),
        'notaInterna', jsonb_build_object(
          'id', v_existente.msg_id,
          'origen', v_existente.msg_origen,
          'autorNombre', v_existente.msg_autor_nombre,
          'contenido', v_existente.msg_contenido,
          'tipoContenido', v_existente.msg_tipo_contenido,
          'estadoEntrega', v_existente.msg_estado_entrega,
          'detalle', v_existente.msg_detalle_mensaje,
          'creadoEn', v_existente.msg_creado_en
        )
      );
    end if;
  end if;

  -- Si aún no viene transcrita desde servidor, usar la clave IA de Vault (Gemini / OpenRouter / OpenAI)
  if v_transcripcion is null then
    if v_aria.ari_stt_secreto_id is not null then
      select d.decrypted_secret into v_stt_key
      from vault.decrypted_secrets d
      where d.id = v_aria.ari_stt_secreto_id;
    end if;

    if v_stt_key is null or btrim(v_stt_key) = '' then
      return jsonb_build_object(
        'ok', false,
        'requiereClaveStt', true,
        'error', 'Configura tu clave IA de Transcripción de Voz (Gemini / OpenRouter / Groq / OpenAI) en /panel/aria → Canal WhatsApp Business para transcribir audios automáticamente.'
      );
    end if;

    if p_audio_base64 is null or btrim(p_audio_base64) = '' then
      return jsonb_build_object('ok', false, 'error', 'No se recibieron datos de audio para transcribir.');
    end if;

    v_stt_key := btrim(v_stt_key);
    perform pg_catalog.set_config('statement_timeout', '45000', true);
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '38');
    perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

    -- Proveedor A: Google Gemini Multimodal Audio (AIza...)
    if v_stt_key like 'AIza%' then
      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' || v_stt_key,
          array[extensions.http_header('Content-Type', 'application/json')],
          'application/json',
          jsonb_build_object(
            'contents', jsonb_build_array(
              jsonb_build_object(
                'parts', jsonb_build_array(
                  jsonb_build_object('text', v_prompt_stt),
                  jsonb_build_object(
                    'inline_data', jsonb_build_object(
                      'mime_type', case when v_mime_limpio = '' then 'audio/ogg' else v_mime_limpio end,
                      'data', p_audio_base64
                    )
                  )
                )
              )
            )
          )::text
        )::extensions.http_request) as h;

        if v_status < 200 or v_status >= 300 then
          -- Respaldo a gemini-2.0-flash si el modelo 2.5 no estuviera habilitado en esa cuenta
          select h.status, h.content into v_status, v_content
          from extensions.http((
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' || v_stt_key,
            array[extensions.http_header('Content-Type', 'application/json')],
            'application/json',
            jsonb_build_object(
              'contents', jsonb_build_array(
                jsonb_build_object(
                  'parts', jsonb_build_array(
                    jsonb_build_object('text', v_prompt_stt),
                    jsonb_build_object(
                      'inline_data', jsonb_build_object(
                        'mime_type', case when v_mime_limpio = '' then 'audio/ogg' else v_mime_limpio end,
                        'data', p_audio_base64
                      )
                    )
                  )
                )
              )
            )::text
          )::extensions.http_request) as h;
        end if;

        v_json := v_content::jsonb;
        v_transcripcion := nullif(btrim(coalesce(v_json->'candidates'->0->'content'->'parts'->0->>'text', '')), '');
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'Error transcribiendo con Gemini (' || sqlerrm || ')');
      end;

    -- Proveedor B: OpenRouter Multimodal Audio (sk-or-...)
    elsif v_stt_key like 'sk-or-%' then
      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://openrouter.ai/api/v1/chat/completions',
          array[
            extensions.http_header('Authorization', 'Bearer ' || v_stt_key),
            extensions.http_header('Content-Type', 'application/json')
          ],
          'application/json',
          jsonb_build_object(
            'model', 'google/gemini-2.5-flash',
            'messages', jsonb_build_array(
              jsonb_build_object(
                'role', 'user',
                'content', jsonb_build_array(
                  jsonb_build_object('type', 'text', 'text', v_prompt_stt),
                  jsonb_build_object(
                    'type', 'input_audio',
                    'input_audio', jsonb_build_object(
                      'data', p_audio_base64,
                      'format', case
                        when v_mime_limpio like '%mp3%' or v_mime_limpio like '%mpeg%' then 'mp3'
                        when v_mime_limpio like '%wav%' then 'wav'
                        else 'ogg'
                      end
                    )
                  )
                )
              )
            )
          )::text
        )::extensions.http_request) as h;

        v_json := v_content::jsonb;
        v_transcripcion := nullif(btrim(coalesce(v_json->'choices'->0->'message'->>'content', '')), '');
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'Error transcribiendo con OpenRouter (' || sqlerrm || ')');
      end;

    else
      return jsonb_build_object(
        'ok', false,
        'requiereMultipartNode', true,
        'error', 'Para transcripción directa en Vault usa una API Key de Google AI Studio (AIza...) u OpenRouter (sk-or-...), o configura GROQ_API_KEY / OPENAI_API_KEY en el servidor.'
      );
    end if;
  end if;

  if v_transcripcion is null or v_transcripcion = '' then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->'error'->>'message', 'No se pudo extraer voz audible de la nota de audio.')
    );
  end if;

  -- Guardar la transcripción como NOTA INTERNA en la conversación
  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    p_conversacion_id,
    'NOTA_INTERNA',
    'ARIA · Transcripción de Voz',
    '🎙️ Transcripción de nota de voz: «' || v_transcripcion || '»',
    'TEXTO',
    'ENTREGADO',
    jsonb_strip_nulls(jsonb_build_object(
      'es_transcripcion_voz', true,
      'audio_mensaje_id', p_mensaje_audio_id,
      'transcripcion_limpia', v_transcripcion
    ))
  )
  returning * into v_msg_nota;

  if p_mensaje_audio_id is not null then
    update comun_agentes.agc_mensaje
       set msg_detalle_mensaje = coalesce(msg_detalle_mensaje, '{}'::jsonb) || jsonb_build_object(
             'transcripcion', v_transcripcion,
             'nota_transcripcion_id', v_msg_nota.msg_id
           ),
           msg_actualizado_en = now()
     where msg_id = p_mensaje_audio_id
       and msg_conversacion_id = p_conversacion_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'transcripcion', v_transcripcion,
    'notaInterna', jsonb_build_object(
      'id', v_msg_nota.msg_id,
      'origen', v_msg_nota.msg_origen,
      'autorNombre', v_msg_nota.msg_autor_nombre,
      'contenido', v_msg_nota.msg_contenido,
      'tipoContenido', v_msg_nota.msg_tipo_contenido,
      'estadoEntrega', v_msg_nota.msg_estado_entrega,
      'detalle', v_msg_nota.msg_detalle_mensaje,
      'creadoEn', v_msg_nota.msg_creado_en
    )
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_transcribir_y_guardar_nota_voz(text, uuid, uuid, text, text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_transcribir_y_guardar_nota_voz(text, uuid, uuid, text, text, text, text) to anon, authenticated, service_role;

-- 8. RPC para que un operador en el Panel pueda pedirle a ARIA responder a una nota de voz / consulta
--    (incluso si el chat estaba en atención humana o llegó antes de activar STT)
create or replace function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(
  p_negocio text,
  p_conversacion_id uuid,
  p_prompt text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_aria comun_configuracion.cfg_aria;
  v_cnv comun_agentes.agc_conversacion;
  v_base_url text;
  v_agente_id text;
  v_api_key text;
  v_cuerpo_aria jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_run_id text;
  v_envio_wa jsonb := null;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para invocar ARIA en este chat.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio and a.ari_eliminado_en is null
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Configura ARIA primero en /panel/aria.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');
  v_agente_id := coalesce(
    nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), ''),
    nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '')
  );

  if v_aria.ari_whatsapp_agente_secreto_id is not null then
    select d.decrypted_secret into v_api_key from vault.decrypted_secrets d where d.id = v_aria.ari_whatsapp_agente_secreto_id;
  end if;
  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key from vault.decrypted_secrets d where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_cuerpo_aria := jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', 'wa-' || regexp_replace(coalesce(v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g')
  );

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

  v_json := v_content::jsonb;
  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object('ok', false, 'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?')));
  end if;

  v_respuesta := btrim(regexp_replace(coalesce(v_json->>'response', v_json->>'detail', ''), '\[ESCALAR_HUMANO\]', '', 'gi'));
  v_run_id := v_json->>'run_id';

  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió una respuesta vacía.');
  end if;

  if v_cnv.cnv_canal = 'whatsapp' then
    v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
      v_negocio,
      coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
      v_respuesta
    );
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv.cnv_id,
    'BOT_ARIA',
    coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta,
    case when v_respuesta ~* '!\s*\[[^\]]*\]\s*\(\s*https?://' then 'IMAGEN' else 'TEXTO' end,
    case when v_envio_wa is not null then v_envio_wa->>'idExterno' else null end,
    case when v_cnv.cnv_canal <> 'whatsapp' or coalesce((v_envio_wa->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', v_cnv.cnv_canal,
      'run_id', v_run_id,
      'error_whatsapp', case when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg_bot;

  update comun_agentes.agc_conversacion
     set cnv_ultimo_mensaje_texto = left(v_respuesta, 280),
         cnv_ultimo_mensaje_origen = 'BOT_ARIA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv.cnv_id;

  return jsonb_build_object(
    'ok', true,
    'respuestaAria', v_respuesta,
    'mensaje', jsonb_build_object(
      'id', v_msg_bot.msg_id,
      'origen', v_msg_bot.msg_origen,
      'autorNombre', v_msg_bot.msg_autor_nombre,
      'contenido', v_msg_bot.msg_contenido,
      'tipoContenido', v_msg_bot.msg_tipo_contenido,
      'estadoEntrega', v_msg_bot.msg_estado_entrega,
      'detalle', v_msg_bot.msg_detalle_mensaje,
      'creadoEn', v_msg_bot.msg_creado_en
    )
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(text, uuid, text) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
