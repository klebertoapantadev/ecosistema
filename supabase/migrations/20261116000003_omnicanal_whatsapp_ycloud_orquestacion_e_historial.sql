-- ==============================================================================
-- Migración: 20261116000003_omnicanal_whatsapp_ycloud_orquestacion_e_historial.sql
-- Requerimientos: PLT-010 / TNK-004 (Fase 2: Orquestación WhatsApp Business YCloud + HITL + Historial ARIA)
-- Descripción:
--   1. Columnas de punteros Vault en `comun_configuracion.cfg_aria` para almacenar cifrados
--      `YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET` y opcionalmente un `ARIA_AGENT_KEY` dedicado a WhatsApp.
--   2. RPC `cfg_fn_guardar_whatsapp_ycloud` y `cfg_fn_borrar_whatsapp_ycloud_clave` (Admin / SuperAdmin).
--   3. Despachador seguro desde PostgreSQL hacia YCloud (`POST /v2/whatsapp/messages/sendDirectly`)
--      integrado tanto con respuestas humanas de `/panel/conversaciones` como con respuestas automáticas de Mía.
--   4. Receptor transaccional e idempotente de Webhooks YCloud (`whatsapp.inbound_message.received`,
--      `whatsapp.smb.message.echoes` desde la app móvil WhatsApp Business y `whatsapp.message.updated`)
--      con validación de token/firma HMAC-SHA256, respeto estricto de `Tomar Control` (`EN_ATENCION_ASESORA`),
--      lista blanca de números de prueba y protección anti-bucle de despedidas bot-a-bot.
--   5. Sincronizador de historial pasado desde la consola de ARIA (`/v1/runs`) hacia `comun_agentes`.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 1. Ampliar comun_configuracion.cfg_aria con referencias Vault para WhatsApp YCloud (cero secretos en texto plano)
do $$
begin
  if to_regclass('comun_configuracion.cfg_aria') is not null then
    alter table comun_configuracion.cfg_aria
      add column if not exists ari_ycloud_api_secreto_id uuid,
      add column if not exists ari_ycloud_webhook_secreto_id uuid,
      add column if not exists ari_whatsapp_agente_secreto_id uuid;
  end if;
end $$;

-- Semilla idempotente de configuración no sensible y respaldo de rollback en Tinkay + etiqueta WhatsApp
do $$
declare
  v_neg text;
begin
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values ('tinkay', 'Tinkay')
  on conflict (cfg_negocio) do nothing;

  insert into comun_configuracion.cfg_aria (ari_negocio, ari_base_url, ari_agente_id, ari_nombre_agente, ari_detalle_aria)
  values (
    'tinkay',
    'https://aria.midomo.site',
    'c717f44a-028e-4e9c-a190-4eb0b774c588',
    'Mía — Tinkay Floristería',
    jsonb_build_object(
      'ycloud_habilitado', false,
      'ycloud_numero_emisor', '+593996438873',
      'ycloud_numeros_permitidos', '+593 99 972 7844',
      'ycloud_webhook_token', encode(extensions.gen_random_bytes(16), 'hex'),
      'respaldo_webhook_aria_previo', 'https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf'
    )
  )
  on conflict (ari_negocio) do update set
    ari_detalle_aria = jsonb_build_object(
      'ycloud_habilitado', coalesce((comun_configuracion.cfg_aria.ari_detalle_aria->>'ycloud_habilitado')::boolean, false),
      'ycloud_numero_emisor', coalesce(nullif(comun_configuracion.cfg_aria.ari_detalle_aria->>'ycloud_numero_emisor', ''), '+593996438873'),
      'ycloud_numeros_permitidos', coalesce(comun_configuracion.cfg_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', '+593 99 972 7844'),
      'ycloud_webhook_token', coalesce(nullif(comun_configuracion.cfg_aria.ari_detalle_aria->>'ycloud_webhook_token', ''), encode(extensions.gen_random_bytes(16), 'hex')),
      'respaldo_webhook_aria_previo', coalesce(comun_configuracion.cfg_aria.ari_detalle_aria->>'respaldo_webhook_aria_previo', 'https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf')
    ) || coalesce(comun_configuracion.cfg_aria.ari_detalle_aria, '{}'::jsonb);

  if to_regclass('comun_agentes.agc_etiqueta') is not null then
    for v_neg in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
      insert into comun_agentes.agc_etiqueta (etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden)
      values (v_neg, 'origen-whatsapp', 'WhatsApp', '#16A34A', '📱', 0)
      on conflict (etq_negocio, etq_slug) where etq_eliminado_en is null do nothing;
    end loop;
  end if;
end $$;

-- Índice único parcial para idempotencia estricta de mensajes externos (wamid / aria-run)
create unique index if not exists uq_agc_mensaje_negocio_id_externo
  on comun_agentes.agc_mensaje (msg_negocio, msg_id_externo)
  where msg_id_externo is not null and msg_eliminado_en is null;

-- 2. RPC Administrativa: Guardar configuración del canal WhatsApp Business (YCloud) en Vault
create or replace function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(
  p_negocio text,
  p_habilitado boolean,
  p_numero_emisor text,
  p_numeros_permitidos text default '',
  p_whatsapp_agente_id text default null,
  p_ycloud_api_key text default null,
  p_ycloud_webhook_secret text default null,
  p_whatsapp_agente_key text default null,
  p_regenerar_token_url boolean default false
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
    ari_detalle_aria,
    ari_actualizado_en
  ) values (
    v_negocio,
    coalesce(v_fila.ari_base_url, 'https://aria.midomo.site'),
    v_ycloud_sec_id,
    v_webhook_sec_id,
    v_wa_ag_sec_id,
    v_nuevo_detalle,
    now()
  )
  on conflict (ari_negocio) do update set
    ari_ycloud_api_secreto_id = excluded.ari_ycloud_api_secreto_id,
    ari_ycloud_webhook_secreto_id = excluded.ari_ycloud_webhook_secreto_id,
    ari_whatsapp_agente_secreto_id = excluded.ari_whatsapp_agente_secreto_id,
    ari_detalle_aria = excluded.ari_detalle_aria,
    ari_actualizado_en = now();

  return jsonb_build_object(
    'ok', true,
    'webhookToken', v_token_url,
    'tieneYcloudApiKey', (v_ycloud_sec_id is not null),
    'tieneWebhookSecret', (v_webhook_sec_id is not null),
    'tieneWhatsappAgenteKey', (v_wa_ag_sec_id is not null)
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_whatsapp_ycloud(text, boolean, text, text, text, text, text, text, boolean) to authenticated, service_role;

-- 3. Helper interno PRIVADO: Despachar mensaje saliente a WhatsApp vía YCloud API v2
create or replace function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
  p_negocio text,
  p_destino text,
  p_texto text
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

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  v_cuerpo := jsonb_build_object(
    'from', v_emisor,
    'to', v_destino_e164,
    'type', 'text',
    'text', jsonb_build_object(
      'body', left(btrim(coalesce(p_texto, '')), 4000),
      'preview_url', true
    )
  );

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

  return jsonb_build_object(
    'ok', true,
    'idExterno', coalesce(v_json->>'wamid', v_json->>'id'),
    'ycloudId', v_json->>'id',
    'estado', coalesce(v_json->>'status', 'sent')
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text) from public, anon, authenticated;

-- 4. Actualizar com_fn_omnicanal_enviar_mensaje_asesor para despachar por YCloud cuando el canal es WhatsApp
create or replace function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(
  p_negocio text,
  p_conversacion_id uuid,
  p_contenido text,
  p_es_nota_interna boolean default false,
  p_respuesta_rapida_id uuid default null
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
  v_origen text := case when coalesce(p_es_nota_interna, false) then 'NOTA_INTERNA' else 'ASESORA_HUMANA' end;
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

  if v_texto = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje antes de enviar.');
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

  -- Si la conversación es de WhatsApp y no es nota interna, despachar en vivo vía YCloud API
  if v_cnv_prev.cnv_canal = 'whatsapp' and not coalesce(p_es_nota_interna, false) then
    v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
      v_negocio,
      coalesce(nullif(v_cnv_prev.cnv_remitente_telefono, ''), v_cnv_prev.cnv_remitente_id),
      v_texto
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
    'TEXTO',
    v_id_externo,
    v_estado_entrega,
    jsonb_strip_nulls(jsonb_build_object(
      'intervencion_humana', (not coalesce(p_es_nota_interna, false)),
      'respuesta_rapida_id', p_respuesta_rapida_id,
      'canal', v_cnv_prev.cnv_canal,
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

  if coalesce(p_es_nota_interna, false) then
    update comun_agentes.agc_conversacion
       set cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  else
    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_asesora_asignada_id = coalesce(cnv_asesora_asignada_id, v_uid),
           cnv_atribuido_por = case when cnv_asesora_asignada_id is null then 'MANUAL' else cnv_atribuido_por end,
           cnv_ultimo_mensaje_texto = left(v_texto, 280),
           cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = 0,
           cnv_no_leidos_cliente = cnv_no_leidos_cliente + 1,
           cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  end if;

  return jsonb_build_object(
    'ok', true,
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
    ),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo,
    'avisoWhatsApp', case when v_envio_wa is not null and not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) to authenticated, service_role;

-- 5. RPC Webhook YCloud: Registrar evento entrante / eco móvil / actualización de entrega
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
  v_in jsonb;
  v_msg_obj jsonb;
  v_id_ext text;
  v_from_digitos text;
  v_to_digitos text;
  v_emisor_digitos text;
  v_nombre_perfil text;
  v_msg_tipo text;
  v_texto text := '';
  v_tipo_bd text := 'TEXTO';
  v_imagen_url text := null;
  v_lat numeric := null;
  v_lng numeric := null;
  v_clave_hilo text;
  v_usu_id uuid := null;
  v_cli_id uuid := null;
  v_etq_wa_id uuid := null;
  v_cnv comun_agentes.agc_conversacion;
  v_msg_ins comun_agentes.agc_mensaje;
  v_pide_humano boolean := false;
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

  -- Si el negocio configuró Endpoint Signing Secret en Vault, validar cabecera YCloud-Signature (t=...,s=...)
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

  -- CASO A: Actualización de estado de entrega/lectura de mensaje saliente
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

  -- CASO B: Eco de mensaje enviado desde la App Móvil de WhatsApp Business (Coexistencia SMB)
  if v_tipo_evento = 'whatsapp.smb.message.echoes' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''), nullif(p_payload->>'id', ''));
    v_to_digitos := regexp_replace(coalesce(v_msg_obj->>'to', ''), '\D', '', 'g');
    v_texto := btrim(coalesce(
      v_msg_obj->'text'->>'body',
      v_msg_obj->'image'->>'caption',
      case when (v_msg_obj->>'type') = 'image' then '📷 Imagen enviada desde WhatsApp Móvil' else '' end
    ));

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
      msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega
    ) values (
      v_negocio, v_cnv.cnv_id, 'ASESORA_HUMANA', 'WhatsApp Móvil Tienda',
      v_texto, 'TEXTO', v_id_ext, 'ENVIADO'
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

  -- Idempotencia ante reintentos de YCloud
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
  elsif v_msg_tipo = 'audio' then
    v_tipo_bd := 'AUDIO';
    v_texto := '🎤 Nota de voz recibida por WhatsApp';
  elsif v_msg_tipo = 'document' then
    v_tipo_bd := 'DOCUMENTO';
    v_texto := '📄 Documento recibido: ' || coalesce(v_in->'document'->>'filename', 'archivo');
  else
    v_texto := btrim(coalesce(v_in->'text'->>'body', 'Mensaje (' || v_msg_tipo || ')'));
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
  end if;

  v_clave_hilo := 'wa:' || v_from_digitos;

  -- Vincular con seg_usuario o com_cliente si coincide el teléfono
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
    cnv_negocio,
    cnv_canal,
    cnv_clave_hilo,
    cnv_remitente_id,
    cnv_remitente_nombre,
    cnv_remitente_telefono,
    cnv_usuario_id,
    cnv_cliente_id,
    cnv_estado_atencion,
    cnv_motivo_escalamiento,
    cnv_ultimo_mensaje_texto,
    cnv_ultimo_mensaje_origen,
    cnv_ultimo_mensaje_en,
    cnv_no_leidos_asesora,
    cnv_mensajes_cliente_conteo,
    cnv_ventana_24h_expira_en
  ) values (
    v_negocio,
    'whatsapp',
    v_clave_hilo,
    '+' || v_from_digitos,
    v_nombre_perfil,
    '+' || v_from_digitos,
    v_usu_id,
    v_cli_id,
    case when v_pide_humano then 'ESCALADO_HUMANO' else 'BOT_ACTIVO' end,
    case when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp' else null end,
    left(v_texto, 280),
    'CLIENTE',
    now(),
    1,
    1,
    now() + interval '24 hours'
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

  -- Asignar etiqueta 📱 WhatsApp automáticamente
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
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv.cnv_id,
    'CLIENTE',
    v_cnv.cnv_remitente_nombre,
    v_texto,
    v_tipo_bd,
    v_id_ext,
    'ENTREGADO',
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'imagen_url', v_imagen_url,
      'latitud', v_lat,
      'longitud', v_lng
    ))
  )
  returning * into v_msg_ins;

  -- Evaluar si ARIA debe responder automáticamente o guardar silencio
  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object(
      'ok', true,
      'accion', 'SILENCIADO_HUMANO',
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
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion
    );
  end if;

  -- Lista blanca opcional ("Responder solo a estos números", ej. +593 99 972 7844)
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
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion
      );
    end if;
  end if;

  -- Protección anti-bucle bot-a-bot en despedidas repetidas ("¡Hasta luego! Que tengas un buen día")
  v_es_despedida_corta := (
    char_length(v_texto) <= 160
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

-- 6. RPC Webhook YCloud: Invocar a Mía (ARIA) y despachar su respuesta a WhatsApp + registrar en Supabase
create or replace function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(
  p_token text,
  p_conversacion_id uuid,
  p_prompt text,
  p_imagen_url text default null
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
  v_escala boolean := false;
  v_envio_wa jsonb;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token de webhook inválido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');
  v_agente_id := coalesce(
    nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), ''),
    nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '')
  );

  if v_aria.ari_whatsapp_agente_secreto_id is not null then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_whatsapp_agente_secreto_id;
  end if;

  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_cuerpo_aria := jsonb_strip_nulls(jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', 'wa-' || regexp_replace(coalesce(v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g'),
    'image_urls', case when p_imagen_url is not null and btrim(p_imagen_url) <> '' then jsonb_build_array(btrim(p_imagen_url)) else null end
  ));

  begin
    select h.status, h.content
    into v_status, v_content
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

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  v_respuesta := btrim(coalesce(v_json->>'response', v_json->>'detail', ''));
  v_run_id := v_json->>'run_id';

  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió respuesta vacía.');
  end if;

  -- Re-verificar que una asesora no haya pulsado "Tomar Control" mientras ARIA razonaba
  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id;

  if v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_escala := (v_respuesta ~* '(te comunico ahora mismo con una de nuestras asesoras|transferir con una asesora|\[ESCALAR_HUMANO\])');
  v_respuesta := btrim(regexp_replace(v_respuesta, '\[ESCALAR_HUMANO\]', '', 'gi'));

  -- Enviar respuesta de Mía al WhatsApp del cliente vía YCloud
  v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
    v_negocio,
    coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
    v_respuesta
  );

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_id_externo,
    msg_estado_entrega,
    msg_detalle_mensaje
  ) values (
    v_negocio,
    v_cnv.cnv_id,
    'BOT_ARIA',
    coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta,
    'TEXTO',
    v_envio_wa->>'idExterno',
    case when coalesce((v_envio_wa->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'run_id', v_run_id,
      'error_whatsapp', case when not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg_bot;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = case when v_escala then 'ESCALADO_HUMANO' else cnv_estado_atencion end,
         cnv_motivo_escalamiento = case when v_escala then 'Mía solicitó transferencia a asesora humana' else cnv_motivo_escalamiento end,
         cnv_ultimo_mensaje_texto = left(v_respuesta, 280),
         cnv_ultimo_mensaje_origen = 'BOT_ARIA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv.cnv_id
   returning * into v_cnv;

  return jsonb_build_object(
    'ok', true,
    'conversacionId', v_cnv.cnv_id,
    'claveHilo', v_cnv.cnv_clave_hilo,
    'mensajeId', v_msg_bot.msg_id,
    'respuestaAria', v_respuesta,
    'autorNombre', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'enviadoWhatsApp', coalesce((v_envio_wa->>'ok')::boolean, false),
    'errorWhatsApp', v_envio_wa->>'error'
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) to anon, authenticated, service_role;

-- 7. Importador de Historial Pasado desde ARIA (/v1/runs y /v1/runs/{id}/messages)
create or replace function comun_comercio.com_fn_omnicanal_sincronizar_historial_aria(
  p_negocio text default 'tinkay',
  p_limite integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_aria comun_configuracion.cfg_aria;
  v_base_url text;
  v_tenant_key text;
  v_gate_key text;
  v_headers extensions.http_header[];
  v_status integer;
  v_content text;
  v_runs_json jsonb;
  v_items jsonb;
  v_run jsonb;
  v_run_id text;
  v_prompt_raw text;
  v_resp_raw text;
  v_msgs_status integer;
  v_msgs_content text;
  v_msgs_json jsonb;
  v_chat_id text;
  v_tel_digitos text;
  v_nombre_corto text;
  v_canal text;
  v_prompt_limpio text;
  v_creado_ts timestamptz;
  v_clave_hilo text;
  v_cnv_id uuid;
  v_etq_wa_id uuid;
  v_importados int := 0;
  v_conversaciones_tocadas int := 0;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para sincronizar el historial de ARIA.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio and ari_eliminado_en is null
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Primero configura ARIA en /panel/aria.');
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');

  if v_aria.ari_tenant_secreto_id is not null then
    select d.decrypted_secret into v_tenant_key from vault.decrypted_secrets d where d.id = v_aria.ari_tenant_secreto_id;
  end if;
  if v_aria.ari_gate_secreto_id is not null then
    select d.decrypted_secret into v_gate_key from vault.decrypted_secrets d where d.id = v_aria.ari_gate_secreto_id;
  end if;

  if v_tenant_key is null or btrim(v_tenant_key) = '' then
    return jsonb_build_object(
      'ok', false,
      'requiereTenantKey', true,
      'error', 'Para importar el historial anterior guardado dentro de la consola de ARIA, ingresa la Tenant Key (y Gate Key si aplica) en /panel/aria → Claves avanzadas de consola ARIA. Los chats nuevos de WhatsApp ya se guardan solos automáticamente.'
    );
  end if;

  v_headers := array[extensions.http_header('Authorization', 'Bearer ' || v_tenant_key)];
  if v_gate_key is not null and btrim(v_gate_key) <> '' then
    v_headers := array_append(v_headers, extensions.http_header('X-Aria-Key', v_gate_key));
  else
    v_headers := array_append(v_headers, extensions.http_header('X-Aria-Key', v_tenant_key));
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '40');

  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'GET',
      v_base_url || '/v1/runs?limit=' || greatest(5, least(coalesce(p_limite, 60), 150))::text,
      v_headers,
      null,
      null
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'No se pudo consultar /v1/runs en ARIA (' || sqlerrm || ')');
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object('ok', false, 'error', 'ARIA /v1/runs respondió HTTP ' || coalesce(v_status::text, '?') || '. Verifica Tenant Key y Gate Key en /panel/aria.');
  end if;

  begin
    v_runs_json := v_content::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Respuesta no JSON desde /v1/runs.');
  end;

  v_items := case
    when jsonb_typeof(v_runs_json) = 'array' then v_runs_json
    when jsonb_typeof(v_runs_json->'items') = 'array' then v_runs_json->'items'
    when jsonb_typeof(v_runs_json->'runs') = 'array' then v_runs_json->'runs'
    else '[]'::jsonb
  end;

  select etq_id into v_etq_wa_id
  from comun_agentes.agc_etiqueta
  where etq_negocio = v_negocio and etq_slug = 'origen-whatsapp' and etq_eliminado_en is null
  limit 1;

  -- Recorrer de más antiguo a más reciente para respetar cronología
  for v_run in
    select elem
    from jsonb_array_elements(v_items) with ordinality as t(elem, ord)
    order by ord desc
  loop
    v_run_id := coalesce(v_run->>'id', v_run->>'run_id', '');
    if v_run_id = '' then
      continue;
    end if;

    -- Saltar si este run ya fue importado
    if exists (
      select 1 from comun_agentes.agc_mensaje
      where msg_negocio = v_negocio
        and msg_id_externo = 'aria-run-in:' || v_run_id
        and msg_eliminado_en is null
    ) then
      continue;
    end if;

    v_prompt_raw := coalesce(v_run->>'prompt', v_run->>'input', v_run->>'user_prompt', '');
    v_resp_raw := coalesce(v_run->>'response', v_run->>'output', v_run->>'assistant_response', '');

    -- Si /v1/runs solo trae resumen sin response completo, consultar /v1/runs/{id}
    if v_resp_raw = '' or v_prompt_raw = '' then
      begin
        select h.status, h.content into v_msgs_status, v_msgs_content
        from extensions.http((
          'GET',
          v_base_url || '/v1/runs/' || v_run_id,
          v_headers,
          null,
          null
        )::extensions.http_request) as h;

        if v_msgs_status >= 200 and v_msgs_status < 300 then
          v_msgs_json := v_msgs_content::jsonb;
          v_prompt_raw := coalesce(nullif(v_prompt_raw, ''), v_msgs_json->>'prompt', v_msgs_json->>'input', '');
          v_resp_raw := coalesce(nullif(v_resp_raw, ''), v_msgs_json->>'response', v_msgs_json->>'output', '');
        end if;
      exception when others then
        null;
      end;
    end if;

    -- Omitir ejecuciones internas de visión/inventario
    if v_prompt_raw ~* 'TAREA OPERATIVA DE INVENTARIO DE TALLER FLORAL' then
      continue;
    end if;

    v_chat_id := substring(v_prompt_raw from 'chat_id=([^\s|\]]+)');
    v_nombre_corto := btrim(coalesce(substring(v_prompt_raw from 'nombre_corto=([^|\]]+)'), ''));
    v_canal := case
      when v_prompt_raw ~* 'canal=whatsapp' or v_chat_id is not null then 'whatsapp'
      else 'web'
    end;

    -- Solo importar aquí los de WhatsApp (o todos los que tengan chat_id)
    if v_canal <> 'whatsapp' then
      continue;
    end if;

    v_tel_digitos := regexp_replace(coalesce(v_chat_id, ''), '\D', '', 'g');
    if v_tel_digitos = '' then
      v_tel_digitos := substring(md5(coalesce(v_run->>'conversation_id', v_run_id)) from 1 for 10);
    end if;

    -- Limpiar cabeceras técnicas [USUARIO ACTUAL: ...] y [ENLACES DIRECTOS...]
    v_prompt_limpio := btrim(regexp_replace(v_prompt_raw, '^\[USUARIO ACTUAL:[^\]]*\]\s*', '', 'i'));
    v_prompt_limpio := btrim(regexp_replace(v_prompt_limpio, '\[ENLACES DIRECTOS E-COMMERCE TINKAY:[\s\S]*$', '', 'i'));

    if v_prompt_limpio = '' then
      continue;
    end if;

    begin
      v_creado_ts := coalesce((v_run->>'created_at')::timestamptz, (v_run->>'started_at')::timestamptz, now());
    exception when others then
      v_creado_ts := now();
    end;

    v_clave_hilo := 'wa:' || v_tel_digitos;

    insert into comun_agentes.agc_conversacion (
      cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
      cnv_remitente_telefono, cnv_estado_atencion, cnv_ultimo_mensaje_texto,
      cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en, cnv_no_leidos_asesora,
      cnv_mensajes_cliente_conteo, cnv_mensajes_ia_conteo, cnv_creado_en
    ) values (
      v_negocio,
      'whatsapp',
      v_clave_hilo,
      '+' || v_tel_digitos,
      coalesce(nullif(v_nombre_corto, ''), 'WhatsApp +' || v_tel_digitos),
      '+' || v_tel_digitos,
      'BOT_ACTIVO',
      left(coalesce(nullif(v_resp_raw, ''), v_prompt_limpio), 280),
      case when v_resp_raw <> '' then 'BOT_ARIA' else 'CLIENTE' end,
      v_creado_ts,
      0,
      1,
      case when v_resp_raw <> '' then 1 else 0 end,
      v_creado_ts
    )
    on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
    do update set
      cnv_ultimo_mensaje_texto = case
        when v_creado_ts >= comun_agentes.agc_conversacion.cnv_ultimo_mensaje_en
        then left(coalesce(nullif(v_resp_raw, ''), v_prompt_limpio), 280)
        else comun_agentes.agc_conversacion.cnv_ultimo_mensaje_texto
      end,
      cnv_ultimo_mensaje_en = greatest(comun_agentes.agc_conversacion.cnv_ultimo_mensaje_en, v_creado_ts),
      cnv_mensajes_cliente_conteo = comun_agentes.agc_conversacion.cnv_mensajes_cliente_conteo + 1,
      cnv_mensajes_ia_conteo = comun_agentes.agc_conversacion.cnv_mensajes_ia_conteo + (case when v_resp_raw <> '' then 1 else 0 end),
      cnv_actualizado_en = now()
    returning cnv_id into v_cnv_id;

    if v_etq_wa_id is not null then
      insert into comun_agentes.agc_conversacion_etiqueta (cet_negocio, cet_conversacion_id, cet_etiqueta_id)
      values (v_negocio, v_cnv_id, v_etq_wa_id)
      on conflict (cet_conversacion_id, cet_etiqueta_id) do nothing;
    end if;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
      msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_creado_en
    ) values (
      v_negocio, v_cnv_id, 'CLIENTE',
      coalesce(nullif(v_nombre_corto, ''), 'WhatsApp +' || v_tel_digitos),
      v_prompt_limpio, 'TEXTO', 'aria-run-in:' || v_run_id, 'ENTREGADO', v_creado_ts
    )
    on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
    do nothing;

    if btrim(v_resp_raw) <> '' then
      insert into comun_agentes.agc_mensaje (
        msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
        msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_creado_en
      ) values (
        v_negocio, v_cnv_id, 'BOT_ARIA',
        coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
        btrim(v_resp_raw), 'TEXTO', 'aria-run-out:' || v_run_id, 'ENTREGADO', v_creado_ts + interval '1 second'
      )
      on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
      do nothing;
    end if;

    v_importados := v_importados + 1;
  end loop;

  select count(*) into v_conversaciones_tocadas
  from comun_agentes.agc_conversacion
  where cnv_negocio = v_negocio and cnv_canal = 'whatsapp' and cnv_eliminado_en is null;

  return jsonb_build_object(
    'ok', true,
    'interaccionesImportadas', v_importados,
    'totalConversacionesWhatsApp', v_conversaciones_tocadas
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_sincronizar_historial_aria(text, integer) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_sincronizar_historial_aria(text, integer) to authenticated, service_role;

notify pgrst, 'reload schema';
