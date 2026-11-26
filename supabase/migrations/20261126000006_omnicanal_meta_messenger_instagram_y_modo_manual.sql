-- =============================================================================
-- Migración: 20261126000006_omnicanal_meta_messenger_instagram_y_modo_manual.sql
-- Requerimiento: PLT-010 (Fase 3 — Facebook Messenger & Instagram Direct Nativo
--                + Modo Manual por Defecto con Activación IA Individual por Chat)
-- Descripción:
--   1. Agrega columnas Vault en comun_configuracion.cfg_aria para Meta Graph API:
--      - ari_meta_page_token_secreto_id (Page Access Token / System User Token)
--      - ari_meta_ig_token_secreto_id (Opcional: Instagram Login Token dedicado)
--      - ari_meta_app_secret_secreto_id (Meta App Secret para X-Hub-Signature-256)
--   2. Siembra etiquetas `origen-facebook` y `origen-instagram` en los 4 negocios
--      y valores no secretos iniciales para Tinkay (modo manual = true por defecto).
--   3. Agrega `p_modo_manual_defecto` en WhatsApp YCloud y RPCs de configuración
--      `cfg_fn_guardar_meta_mensajeria` y `cfg_fn_borrar_meta_mensajeria_clave`.
--   4. Unifica validación de token de webhook (YCloud + Meta) en los helpers
--      compartidos de media, notas de voz, datos de venta y Web Push.
--   5. Crea RPCs para Meta Messenger & Instagram:
--      - com_fn_omnicanal_verificar_webhook_meta (GET hub.verify_token)
--      - com_fn_interno_despachar_meta_mensajeria (Graph API v21.0 + HUMAN_AGENT 7d)
--      - com_fn_omnicanal_procesar_webhook_meta (POST firmado HMAC-SHA256 + eco móvil)
--      - com_fn_omnicanal_responder_meta_con_aria (invoca ARIA solo si BOT_ACTIVO)
--   6. Extiende com_fn_omnicanal_enviar_mensaje_asesor y
--      com_fn_omnicanal_responder_con_aria_panel para despachar hacia FB e IG.
-- =============================================================================

-- 1. Columnas Vault para credenciales Meta Messenger & Instagram Direct
alter table comun_configuracion.cfg_aria
  add column if not exists ari_meta_page_token_secreto_id uuid,
  add column if not exists ari_meta_ig_token_secreto_id uuid,
  add column if not exists ari_meta_app_secret_secreto_id uuid;

-- 2. Sembrar etiquetas de canal Facebook e Instagram para los 4 negocios (idempotente)
do $$
declare
  v_neg text;
begin
  foreach v_neg in array array['tinkay', 'margaritas', 'fastfix', 'tranqi'] loop
    if not exists (
      select 1 from comun_agentes.agc_etiqueta
      where etq_negocio = v_neg and etq_slug = 'origen-facebook' and etq_eliminado_en is null
    ) then
      insert into comun_agentes.agc_etiqueta (
        etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden
      ) values (
        v_neg, 'origen-facebook', 'Facebook', '#1877F2', '📘', 21
      );
    end if;

    if not exists (
      select 1 from comun_agentes.agc_etiqueta
      where etq_negocio = v_neg and etq_slug = 'origen-instagram' and etq_eliminado_en is null
    ) then
      insert into comun_agentes.agc_etiqueta (
        etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden
      ) values (
        v_neg, 'origen-instagram', 'Instagram', '#E1306C', '📸', 22
      );
    end if;
  end loop;
end $$;

-- Inicializar metadatos no secretos de Meta Messenger/IG en filas cfg_aria existentes
-- (Modo Manual por defecto = true en todos los negocios; IDs verificados de Tinkay Quito)
update comun_configuracion.cfg_aria
   set ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
         'meta_fb_habilitado', coalesce((ari_detalle_aria->>'meta_fb_habilitado')::boolean, false),
         'meta_ig_habilitado', coalesce((ari_detalle_aria->>'meta_ig_habilitado')::boolean, false),
         'meta_modo_manual_defecto', coalesce((ari_detalle_aria->>'meta_modo_manual_defecto')::boolean, true),
         'meta_webhook_token', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_webhook_token'), ''),
           encode(extensions.gen_random_bytes(16), 'hex')
         ),
         'meta_webhook_verify_token', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_webhook_verify_token'), ''),
           'eco_meta_' || encode(extensions.gen_random_bytes(12), 'hex')
         ),
         'meta_page_id', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_page_id'), ''),
           case when ari_negocio = 'tinkay' then '109525757999859' else '' end
         ),
         'meta_ig_account_id', coalesce(
           nullif(btrim(ari_detalle_aria->>'meta_ig_account_id'), ''),
           case when ari_negocio = 'tinkay' then '17841448407645348' else '' end
         )
       ),
       ari_actualizado_en = now()
 where ari_eliminado_en is null;

-- 3. RPC dedicado para activar/desactivar Modo Manual por defecto en WhatsApp YCloud
--    (evita sobrecarga de firma en PostgREST sobre cfg_fn_guardar_whatsapp_ycloud)
create or replace function comun_configuracion.cfg_fn_guardar_modo_manual_ycloud(
  p_negocio text,
  p_modo_manual_defecto boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_modo_manual boolean := coalesce(p_modo_manual_defecto, false);
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede cambiar el modo inicial de WhatsApp.');
  end if;

  update comun_configuracion.cfg_aria
     set ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
           'ycloud_modo_manual_defecto', v_modo_manual
         ),
         ari_actualizado_en = now()
   where ari_negocio = v_negocio
     and ari_eliminado_en is null;

  return jsonb_build_object('ok', true, 'modoManualDefecto', v_modo_manual);
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_modo_manual_ycloud(text, boolean) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_modo_manual_ycloud(text, boolean) to authenticated, service_role;

-- 4. RPCs de configuración segura en Vault para Facebook Messenger & Instagram Direct
create or replace function comun_configuracion.cfg_fn_guardar_meta_mensajeria(
  p_negocio text,
  p_fb_habilitado boolean default false,
  p_ig_habilitado boolean default false,
  p_modo_manual_defecto boolean default true,
  p_page_id text default null,
  p_ig_account_id text default null,
  p_page_access_token text default null,
  p_ig_access_token text default null,
  p_app_secret text default null,
  p_verify_token text default null,
  p_regenerar_token_url boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_page_id text := regexp_replace(btrim(coalesce(p_page_id, '')), '\s+', '', 'g');
  v_ig_id text := regexp_replace(btrim(coalesce(p_ig_account_id, '')), '\s+', '', 'g');
  v_fila comun_configuracion.cfg_aria;
  v_page_sec_id uuid;
  v_ig_sec_id uuid;
  v_app_sec_id uuid;
  v_token_url text;
  v_verify_token text;
  v_modo_manual boolean := coalesce(p_modo_manual_defecto, true);
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
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede configurar Facebook Messenger e Instagram Direct.');
  end if;

  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  v_page_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_meta_page_token_secreto_id,
    p_page_access_token,
    'meta_page_access_token_' || v_negocio,
    'Meta Page / System User Access Token (Messenger e Instagram) para ' || v_negocio
  );

  v_ig_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_meta_ig_token_secreto_id,
    p_ig_access_token,
    'meta_ig_access_token_' || v_negocio,
    'Meta Instagram Access Token dedicado (opcional) para ' || v_negocio
  );

  v_app_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_fila.ari_meta_app_secret_secreto_id,
    p_app_secret,
    'meta_app_secret_' || v_negocio,
    'Meta App Secret para validación X-Hub-Signature-256 de ' || v_negocio
  );

  if coalesce(p_fb_habilitado, false) and v_page_sec_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Pega tu Page Access Token (o System User Token) de Meta antes de activar Facebook Messenger.'
    );
  end if;

  if coalesce(p_ig_habilitado, false) and v_page_sec_id is null and v_ig_sec_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Pega tu Page Access Token (o Token de Instagram) antes de activar Instagram Direct.'
    );
  end if;

  v_token_url := case
    when coalesce(p_regenerar_token_url, false)
      or coalesce(nullif(btrim(v_fila.ari_detalle_aria->>'meta_webhook_token'), ''), '') = ''
    then encode(extensions.gen_random_bytes(16), 'hex')
    else btrim(v_fila.ari_detalle_aria->>'meta_webhook_token')
  end;

  v_verify_token := coalesce(
    nullif(btrim(coalesce(p_verify_token, '')), ''),
    nullif(btrim(coalesce(v_fila.ari_detalle_aria->>'meta_webhook_verify_token', '')), ''),
    'eco_meta_' || encode(extensions.gen_random_bytes(12), 'hex')
  );

  v_nuevo_detalle := coalesce(v_fila.ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
    'meta_fb_habilitado', coalesce(p_fb_habilitado, false),
    'meta_ig_habilitado', coalesce(p_ig_habilitado, false),
    'meta_modo_manual_defecto', v_modo_manual,
    'meta_page_id', v_page_id,
    'meta_ig_account_id', v_ig_id,
    'meta_webhook_token', v_token_url,
    'meta_webhook_verify_token', v_verify_token
  );

  insert into comun_configuracion.cfg_aria (
    ari_negocio,
    ari_base_url,
    ari_meta_page_token_secreto_id,
    ari_meta_ig_token_secreto_id,
    ari_meta_app_secret_secreto_id,
    ari_detalle_aria,
    ari_actualizado_en
  ) values (
    v_negocio,
    coalesce(v_fila.ari_base_url, 'https://aria.midomo.site'),
    v_page_sec_id,
    v_ig_sec_id,
    v_app_sec_id,
    v_nuevo_detalle,
    now()
  )
  on conflict (ari_negocio) do update set
    ari_meta_page_token_secreto_id = excluded.ari_meta_page_token_secreto_id,
    ari_meta_ig_token_secreto_id = excluded.ari_meta_ig_token_secreto_id,
    ari_meta_app_secret_secreto_id = excluded.ari_meta_app_secret_secreto_id,
    ari_detalle_aria = excluded.ari_detalle_aria,
    ari_actualizado_en = now();

  return jsonb_build_object(
    'ok', true,
    'webhookToken', v_token_url,
    'verifyToken', v_verify_token,
    'fbHabilitado', coalesce(p_fb_habilitado, false),
    'igHabilitado', coalesce(p_ig_habilitado, false),
    'modoManualDefecto', v_modo_manual,
    'tienePageToken', (v_page_sec_id is not null),
    'tieneIgToken', (v_ig_sec_id is not null),
    'tieneAppSecret', (v_app_sec_id is not null)
  );
end;
$$;

revoke all on function comun_configuracion.cfg_fn_guardar_meta_mensajeria(text, boolean, boolean, boolean, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_meta_mensajeria(text, boolean, boolean, boolean, text, text, text, text, text, text, boolean) to authenticated, service_role;

create or replace function comun_configuracion.cfg_fn_borrar_meta_mensajeria_clave(
  p_negocio text,
  p_tipo text default 'todas'
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := lower(btrim(coalesce(p_negocio, '')));
  v_tipo text := lower(btrim(coalesce(p_tipo, 'todas')));
  v_fila comun_configuracion.cfg_aria;
  v_detalle jsonb;
begin
  if v_negocio = '' then
    return jsonb_build_object('ok', false, 'error', 'Negocio inválido.');
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para eliminar credenciales de Meta.');
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  if v_fila.ari_id is null then
    return jsonb_build_object('ok', true);
  end if;

  v_detalle := coalesce(v_fila.ari_detalle_aria, '{}'::jsonb);

  if v_tipo in ('page_token', 'todas') and v_fila.ari_meta_page_token_secreto_id is not null then
    delete from vault.secrets where id = v_fila.ari_meta_page_token_secreto_id;
    v_fila.ari_meta_page_token_secreto_id := null;
    v_detalle := v_detalle || jsonb_build_object('meta_fb_habilitado', false);
    if v_fila.ari_meta_ig_token_secreto_id is null then
      v_detalle := v_detalle || jsonb_build_object('meta_ig_habilitado', false);
    end if;
  end if;

  if v_tipo in ('ig_token', 'todas') and v_fila.ari_meta_ig_token_secreto_id is not null then
    delete from vault.secrets where id = v_fila.ari_meta_ig_token_secreto_id;
    v_fila.ari_meta_ig_token_secreto_id := null;
    if v_fila.ari_meta_page_token_secreto_id is null then
      v_detalle := v_detalle || jsonb_build_object('meta_ig_habilitado', false);
    end if;
  end if;

  if v_tipo in ('app_secret', 'todas') and v_fila.ari_meta_app_secret_secreto_id is not null then
    delete from vault.secrets where id = v_fila.ari_meta_app_secret_secreto_id;
    v_fila.ari_meta_app_secret_secreto_id := null;
  end if;

  update comun_configuracion.cfg_aria
     set ari_meta_page_token_secreto_id = v_fila.ari_meta_page_token_secreto_id,
         ari_meta_ig_token_secreto_id = v_fila.ari_meta_ig_token_secreto_id,
         ari_meta_app_secret_secreto_id = v_fila.ari_meta_app_secret_secreto_id,
         ari_detalle_aria = v_detalle,
         ari_actualizado_en = now()
   where ari_id = v_fila.ari_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_configuracion.cfg_fn_borrar_meta_mensajeria_clave(text, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_borrar_meta_mensajeria_clave(text, text) to authenticated, service_role;

-- 5. Helper interno: validar token de webhook (acepta tanto YCloud como Meta Messenger/IG)
create or replace function comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(
  p_token text
)
returns comun_configuracion.cfg_aria
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_aria comun_configuracion.cfg_aria;
begin
  if v_token = '' then
    return null;
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and (
      btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
      or btrim(coalesce(a.ari_detalle_aria->>'meta_webhook_token', '')) = v_token
    )
  limit 1;

  return v_aria;
end;
$$;

revoke all on function comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(text) from public, anon, authenticated;

-- 5.1 Actualizar helpers compartidos de media, voz, datos de venta y Web Push para aceptar tokens Meta + YCloud
create or replace function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(
  p_token text,
  p_mensaje_id uuid,
  p_imagen_publica_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aria comun_configuracion.cfg_aria;
  v_url_nueva text := btrim(coalesce(p_imagen_publica_url, ''));
  v_msg comun_agentes.agc_mensaje;
  v_url_antigua text;
begin
  if v_url_nueva = '' or p_mensaje_id is null then
    return jsonb_build_object('ok', false);
  end if;

  v_aria := comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(p_token);
  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token no autorizado');
  end if;

  select * into v_msg
  from comun_agentes.agc_mensaje
  where msg_id = p_mensaje_id
    and msg_negocio = v_aria.ari_negocio;

  if v_msg.msg_id is null then
    return jsonb_build_object('ok', false);
  end if;

  v_url_antigua := coalesce(v_msg.msg_detalle_mensaje->>'imagen_url', '');

  update comun_agentes.agc_mensaje
     set msg_contenido = case
           when v_url_antigua <> '' and strpos(msg_contenido, v_url_antigua) > 0
             then replace(msg_contenido, v_url_antigua, v_url_nueva)
           when msg_contenido !~ '!\s*\[[^\]]*\]\s*\(\s*https?://'
             then msg_contenido || E'\n![Foto enviada por el cliente](' || v_url_nueva || ')'
           else msg_contenido
         end,
         msg_tipo_contenido = 'IMAGEN',
         msg_detalle_mensaje = coalesce(msg_detalle_mensaje, '{}'::jsonb) || jsonb_build_object(
           'imagen_url', v_url_nueva,
           'imagen_original_externa', nullif(v_url_antigua, '')
         ),
         msg_actualizado_en = now()
   where msg_id = p_mensaje_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(text, uuid, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_imagen_mensaje(text, uuid, text) to anon, authenticated, service_role;

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
  v_aria comun_configuracion.cfg_aria;
begin
  v_aria := comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(p_token);
  if v_aria.ari_id is null then
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
     and msg_negocio = v_aria.ari_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_actualizar_media_mensaje(text, uuid, text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_media_mensaje(text, uuid, text, text, text) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(
  p_token text,
  p_conversacion_id uuid,
  p_parcial jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aria comun_configuracion.cfg_aria;
  v_actual jsonb;
  v_fusionado jsonb;
begin
  v_aria := comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(p_token);
  if v_aria.ari_id is null or p_conversacion_id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(cnv_detalle_conversacion->'datos_venta', '{}'::jsonb)
    into v_actual
    from comun_agentes.agc_conversacion
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_aria.ari_negocio;

  if v_actual is null then
    return jsonb_build_object('ok', false);
  end if;

  v_fusionado := v_actual || jsonb_strip_nulls(coalesce(p_parcial, '{}'::jsonb));

  update comun_agentes.agc_conversacion
     set cnv_detalle_conversacion = jsonb_set(
           coalesce(cnv_detalle_conversacion, '{}'::jsonb),
           '{datos_venta}',
           v_fusionado,
           true
         ),
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_aria.ari_negocio;

  return jsonb_build_object('ok', true, 'datosVenta', v_fusionado);
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_fusionar_datos_venta_webhook(text, uuid, jsonb) to anon, authenticated, service_role;

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
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio
    and a.ari_eliminado_en is null
  limit 1;

  if p_token_webhook is not null and btrim(p_token_webhook) <> ''
     and v_aria.ari_id is not null
     and (
       btrim(coalesce(v_aria.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(p_token_webhook)
       or btrim(coalesce(v_aria.ari_detalle_aria->>'meta_webhook_token', '')) = btrim(p_token_webhook)
     ) then
    v_autorizado := true;
  elsif comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    v_autorizado := true;
  end if;

  if not v_autorizado then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para transcribir notas de voz.');
  end if;

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
        'error', 'Configura tu clave IA de Transcripción de Voz (Gemini / OpenRouter / Groq / OpenAI) en /panel/aria para transcribir audios automáticamente.'
      );
    end if;

    if p_audio_base64 is null or btrim(p_audio_base64) = '' then
      return jsonb_build_object('ok', false, 'error', 'No se recibieron datos de audio para transcribir.');
    end if;

    v_stt_key := btrim(v_stt_key);
    perform pg_catalog.set_config('statement_timeout', '45000', true);
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '38');
    perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

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
                        when v_mime_limpio like '%mp4%' or v_mime_limpio like '%m4a%' or v_mime_limpio like '%aac%' then 'mp4'
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
        'error', 'Para transcripción directa en Vault usa una API Key de Google AI Studio (AIza...) u OpenRouter (sk-or-...).'
      );
    end if;
  end if;

  if v_transcripcion is null or v_transcripcion = '' then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->'error'->>'message', 'No se pudo extraer voz audible de la nota de audio.')
    );
  end if;

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

create or replace function comun_comercio.com_fn_push_obtener_contexto_envio_staff(
  p_negocio text,
  p_token_webhook text default null,
  p_excluir_usuario_id uuid default null,
  p_solo_ventas boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_autorizado boolean := false;
  v_uid uuid := auth.uid();
  v_aria comun_configuracion.cfg_aria;
  v_cfg comun_configuracion.cfg_negocio;
  v_pub text;
  v_priv text;
  v_miembros jsonb;
  v_suscripciones jsonb;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio and a.ari_eliminado_en is null
  limit 1;

  if p_token_webhook is not null and btrim(p_token_webhook) <> ''
     and v_aria.ari_id is not null
     and (
       btrim(coalesce(v_aria.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(p_token_webhook)
       or btrim(coalesce(v_aria.ari_detalle_aria->>'meta_webhook_token', '')) = btrim(p_token_webhook)
     ) then
    v_autorizado := true;
  elsif v_uid is not null then
    select exists (
      select 1
      from comun_seguridad.seg_usuario u
      left join comun_seguridad.seg_membresia m
        on m.mem_usuario_id = u.usu_id
       and m.mem_estado = 'ACTIVO'
       and lower(m.mem_negocio) in (v_negocio, case when v_negocio = 'tinkay' then 'tnk' else v_negocio end)
      where u.usu_id = v_uid
        and (
          u.usu_superadmin_plataforma = true
          or upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO')
        )
    ) into v_autorizado;
  end if;

  if not v_autorizado then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_pub := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'vapid_public_key', '')), '');
  if v_cfg.cfg_vapid_secreto_id is not null then
    select d.decrypted_secret into v_priv
    from vault.decrypted_secrets d
    where d.id = v_cfg.cfg_vapid_secreto_id;
  end if;

  with personal as (
    select distinct on (u.usu_id)
      u.usu_id as usuario_id,
      case
        when u.usu_superadmin_plataforma = true
          or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
          then 'SUPERADMIN'
        else upper(coalesce(m.mem_rol, 'OPERADOR'))
      end as rol
    from comun_seguridad.seg_usuario u
    left join comun_seguridad.seg_membresia m
      on m.mem_usuario_id = u.usu_id
     and m.mem_estado = 'ACTIVO'
     and lower(m.mem_negocio) in (v_negocio, case when v_negocio = 'tinkay' then 'tnk' else v_negocio end)
    where u.usu_eliminado_en is null
      and (p_excluir_usuario_id is null or u.usu_id <> p_excluir_usuario_id)
      and (
        u.usu_superadmin_plataforma = true
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or (
          not coalesce(p_solo_ventas, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO')
        )
        or (
          coalesce(p_solo_ventas, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR')
        )
      )
  )
  select
    coalesce(
      (select jsonb_agg(jsonb_build_object('usuarioId', p.usuario_id, 'rol', p.rol)) from personal p),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'usuarioId', s.psu_usuario_id,
            'rol', p.rol,
            'endpoint', s.psu_endpoint,
            'p256dh', s.psu_p256dh,
            'auth', s.psu_auth
          )
        )
        from comun_seguridad.seg_push_suscripcion s
        join personal p on p.usuario_id = s.psu_usuario_id
        where s.psu_negocio = v_negocio
          and s.psu_activo = true
          and s.psu_eliminado_en is null
      ),
      '[]'::jsonb
    )
  into v_miembros, v_suscripciones;

  return jsonb_build_object(
    'ok', true,
    'vapidPublicKey', v_pub,
    'vapidPrivateKey', v_priv,
    'miembros', v_miembros,
    'suscripciones', v_suscripciones
  );
end;
$$;

revoke all on function comun_comercio.com_fn_push_obtener_contexto_envio_staff(text, text, uuid, boolean) from public;
grant execute on function comun_comercio.com_fn_push_obtener_contexto_envio_staff(text, text, uuid, boolean) to anon, authenticated, service_role;

-- 6. Actualizar com_fn_omnicanal_procesar_webhook_ycloud para respetar ycloud_modo_manual_defecto
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
  v_modo_manual boolean := false;
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
  v_modo_manual := coalesce((v_aria.ari_detalle_aria->>'ycloud_modo_manual_defecto')::boolean, false);

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
    case
      when v_pide_humano then 'ESCALADO_HUMANO'
      when v_modo_manual then 'EN_ATENCION_ASESORA'
      else 'BOT_ACTIVO'
    end,
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
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'CERRADO' then
        case when v_modo_manual then 'EN_ATENCION_ASESORA' else 'BOT_ACTIVO' end
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

-- 7. RPC GET handshake Meta Webhook (hub.verify_token)
create or replace function comun_comercio.com_fn_omnicanal_verificar_webhook_meta(
  p_token text default null,
  p_verify_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_verify text := btrim(coalesce(p_verify_token, ''));
  v_aria comun_configuracion.cfg_aria;
begin
  if v_verify = '' then
    return jsonb_build_object('ok', false, 'error', 'hub.verify_token ausente.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'meta_webhook_verify_token', '')) = v_verify
    and (
      v_token = ''
      or btrim(coalesce(a.ari_detalle_aria->>'meta_webhook_token', '')) = v_token
    )
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token de verificación Meta inválido.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_aria.ari_negocio
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_verificar_webhook_meta(text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_verificar_webhook_meta(text, text) to anon, authenticated, service_role;

-- 8. Despachador interno Meta Graph API v21.0 (Facebook Messenger + Instagram Direct)
create or replace function comun_comercio.com_fn_interno_despachar_meta_mensajeria(
  p_negocio text,
  p_canal text,
  p_recipient_id text,
  p_texto text,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null,
  p_ventana_24h_expira_en timestamptz default null,
  p_es_humano boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_canal text := lower(btrim(coalesce(p_canal, 'facebook')));
  v_recipient text := btrim(coalesce(p_recipient_id, ''));
  v_page_token text := null;
  v_ig_token text := null;
  v_token text := null;
  v_page_id text := '';
  v_ig_id text := '';
  v_endpoint text;
  v_endpoint_fallback text := null;
  v_img_url text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_doc_url text := nullif(btrim(coalesce(p_documento_url, '')), '');
  v_doc_nombre text := coalesce(nullif(btrim(coalesce(p_documento_nombre, '')), ''), 'documento.pdf');
  v_texto_limpio text := btrim(coalesce(p_texto, ''));
  v_messaging_type text := 'RESPONSE';
  v_tag text := null;
  v_limite_chars integer := case when lower(coalesce(p_canal, '')) = 'instagram' then 950 else 1900 end;
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_ultimo_mid text := null;
  v_imagenes_enviadas integer := 0;
  v_imagenes_urls jsonb := '[]'::jsonb;
  v_pos integer := 1;
  v_len integer;
  v_trozo text;
begin
  if v_canal not in ('facebook', 'instagram') then
    return jsonb_build_object('ok', false, 'error', 'Canal Meta no soportado: ' || v_canal);
  end if;

  if v_recipient = '' then
    return jsonb_build_object('ok', false, 'error', 'ID de destinatario (PSID / IGSID) vacío.');
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
    return jsonb_build_object(
      'ok', false,
      'error', 'Falta configurar el Page Access Token de Meta en /panel/aria → Canal Facebook e Instagram.'
    );
  end if;

  -- Política de ventana de mensajería Meta (24h estándar / hasta 7 días con etiqueta HUMAN_AGENT para humanos)
  if p_ventana_24h_expira_en is not null and p_ventana_24h_expira_en < now() then
    if not coalesce(p_es_humano, false) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Ventana estándar de 24h vencida para respuesta automática IA en ' || initcap(v_canal) || '.'
      );
    elsif now() <= p_ventana_24h_expira_en + interval '6 days' then
      v_messaging_type := 'MESSAGE_TAG';
      v_tag := 'HUMAN_AGENT';
    else
      return jsonb_build_object(
        'ok', false,
        'error', 'Han pasado más de 7 días desde el último mensaje del cliente en ' || initcap(v_canal) || ' (ventana cerrada por política de Meta).'
      );
    end if;
  end if;

  -- Determinar endpoint oficial Meta Graph API v21.0
  if v_token like 'IG%' then
    v_endpoint := 'https://graph.instagram.com/v21.0/me/messages';
  elsif v_canal = 'instagram' and v_ig_id <> '' then
    v_endpoint := 'https://graph.facebook.com/v21.0/' || v_ig_id || '/messages';
    if v_page_id <> '' then
      v_endpoint_fallback := 'https://graph.facebook.com/v21.0/' || v_page_id || '/messages';
    end if;
  elsif v_page_id <> '' then
    v_endpoint := 'https://graph.facebook.com/v21.0/' || v_page_id || '/messages';
  else
    v_endpoint := 'https://graph.facebook.com/v21.0/me/messages';
  end if;

  -- Si no se pasó p_imagen_url explícito pero el texto trae sintaxis Markdown ![alt](https://...), extraerla
  if v_img_url is null and v_doc_url is null then
    v_img_url := substring(v_texto_limpio from '!\s*\[[^\]]*\]\s*\(\s*(https?://[^)\s]+)\s*\)');
  end if;

  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '!\s*\[[^\]]*\]\s*\(\s*https?://[^)]+\)', '', 'g'));
  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '📄\s*\[[^\]]+\]\(\s*https?://[^)]+\)', '', 'g'));

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  -- A. Despachar adjunto (imagen o documento) primero si existe
  if v_doc_url is not null and v_doc_url ~* '^https?://' then
    if v_canal = 'facebook' then
      v_cuerpo := jsonb_strip_nulls(jsonb_build_object(
        'recipient', jsonb_build_object('id', v_recipient),
        'messaging_type', v_messaging_type,
        'tag', v_tag,
        'message', jsonb_build_object(
          'attachment', jsonb_build_object(
            'type', 'file',
            'payload', jsonb_build_object('url', v_doc_url, 'is_reusable', true)
          )
        )
      ));

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          v_endpoint,
          array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'No se pudo conectar con Meta Graph API (' || sqlerrm || ')');
      end;

      begin v_json := v_content::jsonb; exception when others then v_json := null; end;
      if v_status < 200 or v_status >= 300 then
        return jsonb_build_object(
          'ok', false,
          'status', v_status,
          'error', coalesce(v_json->'error'->>'message', 'Meta respondió HTTP ' || coalesce(v_status::text, '?'))
        );
      end if;
      v_ultimo_mid := coalesce(v_json->>'message_id', v_ultimo_mid);
    else
      -- Instagram Direct no soporta adjuntos PDF genéricos vía Send API: adjuntar enlace directo en el texto
      v_texto_limpio := btrim(coalesce(nullif(v_texto_limpio, '') || E'\n', '') || '📄 ' || v_doc_nombre || ': ' || v_doc_url);
    end if;
  elsif v_img_url is not null and v_img_url ~* '^https?://' then
    v_cuerpo := jsonb_strip_nulls(jsonb_build_object(
      'recipient', jsonb_build_object('id', v_recipient),
      'messaging_type', v_messaging_type,
      'tag', v_tag,
      'message', jsonb_build_object(
        'attachment', jsonb_build_object(
          'type', 'image',
          'payload', jsonb_build_object('url', v_img_url, 'is_reusable', true)
        )
      )
    ));

    begin
      select h.status, h.content into v_status, v_content
      from extensions.http((
        'POST',
        v_endpoint,
        array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
        'application/json',
        v_cuerpo::text
      )::extensions.http_request) as h;

      if (v_status < 200 or v_status >= 300) and v_endpoint_fallback is not null then
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          v_endpoint_fallback,
          array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;
        if v_status >= 200 and v_status < 300 then
          v_endpoint := v_endpoint_fallback;
        end if;
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'No se pudo conectar con Meta Graph API (' || sqlerrm || ')');
    end;

    begin v_json := v_content::jsonb; exception when others then v_json := null; end;
    if v_status < 200 or v_status >= 300 then
      return jsonb_build_object(
        'ok', false,
        'status', v_status,
        'error', coalesce(v_json->'error'->>'message', 'Meta respondió HTTP ' || coalesce(v_status::text, '?'))
      );
    end if;
    v_ultimo_mid := coalesce(v_json->>'message_id', v_ultimo_mid);
    v_imagenes_enviadas := 1;
    v_imagenes_urls := jsonb_build_array(v_img_url);
  end if;

  -- B. Despachar texto limpio (troceado automáticamente para cumplir límites de IG 1000 / FB 2000)
  if v_texto_limpio = '' and v_ultimo_mid is null then
    v_texto_limpio := left(coalesce(nullif(btrim(coalesce(p_texto, '')), ''), 'Mensaje'), v_limite_chars);
  end if;

  if v_texto_limpio <> '' then
    v_len := char_length(v_texto_limpio);
    v_pos := 1;
    while v_pos <= v_len loop
      v_trozo := btrim(substring(v_texto_limpio from v_pos for v_limite_chars));
      v_pos := v_pos + v_limite_chars;
      if v_trozo = '' then
        continue;
      end if;

      v_cuerpo := jsonb_strip_nulls(jsonb_build_object(
        'recipient', jsonb_build_object('id', v_recipient),
        'messaging_type', v_messaging_type,
        'tag', v_tag,
        'message', jsonb_build_object('text', v_trozo)
      ));

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          v_endpoint,
          array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;

        if (v_status < 200 or v_status >= 300) and v_endpoint_fallback is not null and v_endpoint <> v_endpoint_fallback then
          select h.status, h.content into v_status, v_content
          from extensions.http((
            'POST',
            v_endpoint_fallback,
            array[extensions.http_header('Authorization', 'Bearer ' || v_token)],
            'application/json',
            v_cuerpo::text
          )::extensions.http_request) as h;
          if v_status >= 200 and v_status < 300 then
            v_endpoint := v_endpoint_fallback;
          end if;
        end if;
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'No se pudo conectar con Meta Graph API (' || sqlerrm || ')');
      end;

      begin v_json := v_content::jsonb; exception when others then v_json := null; end;
      if v_status < 200 or v_status >= 300 then
        return jsonb_build_object(
          'ok', false,
          'status', v_status,
          'error', coalesce(v_json->'error'->>'message', 'Meta respondió HTTP ' || coalesce(v_status::text, '?'))
        );
      end if;
      v_ultimo_mid := coalesce(v_json->>'message_id', v_ultimo_mid);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idExterno', v_ultimo_mid,
    'canal', v_canal,
    'imagenesEnviadas', v_imagenes_enviadas,
    'imagenesUrls', v_imagenes_urls
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_meta_mensajeria(text, text, text, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;

-- 9. Procesador de Webhooks Entrantes Meta (Facebook Messenger & Instagram Direct)
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
begin
  if v_objeto = 'instagram' then
    v_canal := 'instagram';
  elsif v_objeto = 'page' then
    v_canal := 'facebook';
  else
    return jsonb_build_object('ok', true, 'accion', 'EVENTO_IGNORADO', 'objeto', v_objeto, 'eventos', '[]'::jsonb);
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

  -- Validar firma X-Hub-Signature-256 si hay App Secret configurado en Vault
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

  -- Cargar token de lectura de perfil (opcional, jamás bloquea el webhook)
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

      -- Ignorar eventos de solo lectura/entrega/reacciones sin cuerpo de mensaje ni postback
      if v_msg is null and v_postback is null then
        continue;
      end if;

      -- Ignorar eventos de mensaje eliminado
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

      -- Resetear variables por evento
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

      -- CASO ECO: respuesta enviada manualmente desde Meta Business Suite / App Móvil FB/IG
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

      -- CASO CLIENTE ENTRANTE: intentar resolver nombre real si es conversación nueva o nombre genérico
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

      -- MODO MANUAL POR DEFECTO:
      --   Si meta_modo_manual_defecto = true (defecto), todo chat nuevo/reabierto inicia en EN_ATENCION_ASESORA (Manual).
      --   Si el asesor activa IA individualmente en ese chat (BOT_ACTIVO), se preserva BOT_ACTIVO en los siguientes mensajes.
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

      -- Decidir si corresponde invocar a ARIA (solo si canal está habilitado Y este chat está en BOT_ACTIVO)
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
    'eventos', v_eventos
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_procesar_webhook_meta(text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_procesar_webhook_meta(text, text, text, jsonb) to anon, authenticated, service_role;

-- 10. RPC: Invocar ARIA y responder por Meta Graph API (solo si el chat está en BOT_ACTIVO)
create or replace function comun_comercio.com_fn_omnicanal_responder_meta_con_aria(
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
  v_envio_meta jsonb;
  v_tiene_img boolean := false;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  v_aria := comun_comercio.com_fn_interno_buscar_aria_por_token_webhook(p_token);
  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token de webhook Meta inválido.');
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

  if v_cnv.cnv_estado_atencion <> 'BOT_ACTIVO' then
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
    'conversation_id', (case when v_cnv.cnv_canal = 'instagram' then 'ig-' else 'fb-' end) || regexp_replace(coalesce(v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g'),
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

  begin v_json := v_content::jsonb; exception when others then v_json := null; end;
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

  -- Doble verificación por si una asesora pausó la IA mientras ARIA generaba la respuesta
  select * into v_cnv from comun_agentes.agc_conversacion where cnv_id = p_conversacion_id;
  if v_cnv.cnv_estado_atencion <> 'BOT_ACTIVO' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_escala := (v_respuesta ~* '(te comunico ahora mismo con una de nuestras asesoras|transferir con una asesora|\[ESCALAR_HUMANO\])');
  v_respuesta := btrim(regexp_replace(v_respuesta, '\[ESCALAR_HUMANO\]', '', 'gi'));

  v_envio_meta := comun_comercio.com_fn_interno_despachar_meta_mensajeria(
    v_negocio,
    v_cnv.cnv_canal,
    v_cnv.cnv_remitente_id,
    v_respuesta,
    null,
    null,
    null,
    v_cnv.cnv_ventana_24h_expira_en,
    false
  );

  v_tiene_img := (
    coalesce((v_envio_meta->>'imagenesEnviadas')::integer, 0) > 0
    or v_respuesta ~ '!\s*\[[^\]]*\]\s*\(\s*https?://'
  );

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, v_cnv.cnv_id, 'BOT_ARIA', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta, case when v_tiene_img then 'IMAGEN' else 'TEXTO' end,
    v_envio_meta->>'idExterno',
    case when coalesce((v_envio_meta->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', v_cnv.cnv_canal,
      'run_id', v_run_id,
      'imagenes_urls', v_envio_meta->'imagenesUrls',
      'error_canal', case when not coalesce((v_envio_meta->>'ok')::boolean, false) then v_envio_meta->>'error' else null end
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
    'canal', v_cnv.cnv_canal,
    'claveHilo', v_cnv.cnv_clave_hilo,
    'mensajeId', v_msg_bot.msg_id,
    'respuestaAria', v_respuesta,
    'imagenesUrls', coalesce(v_envio_meta->'imagenesUrls', '[]'::jsonb),
    'autorNombre', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'enviadoCanal', coalesce((v_envio_meta->>'ok')::boolean, false),
    'errorCanal', v_envio_meta->>'error'
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_meta_con_aria(text, uuid, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_responder_meta_con_aria(text, uuid, text, text) to anon, authenticated, service_role;

-- 11. Extender com_fn_omnicanal_enviar_mensaje_asesor para despachar también a Facebook e Instagram
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
  v_envio_canal jsonb := null;
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

  -- Despacho externo según canal (WhatsApp YCloud o Facebook/Instagram Meta Graph API)
  if not coalesce(p_es_nota_interna, false) then
    if v_cnv_prev.cnv_canal = 'whatsapp' then
      v_envio_canal := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
        v_negocio,
        coalesce(nullif(v_cnv_prev.cnv_remitente_telefono, ''), v_cnv_prev.cnv_remitente_id),
        v_texto,
        v_img,
        v_doc,
        v_doc_nom
      );
    elsif v_cnv_prev.cnv_canal in ('facebook', 'instagram') then
      v_envio_canal := comun_comercio.com_fn_interno_despachar_meta_mensajeria(
        v_negocio,
        v_cnv_prev.cnv_canal,
        v_cnv_prev.cnv_remitente_id,
        v_texto,
        v_img,
        v_doc,
        v_doc_nom,
        v_cnv_prev.cnv_ventana_24h_expira_en,
        true
      );
    end if;

    if v_envio_canal is not null then
      if coalesce((v_envio_canal->>'ok')::boolean, false) then
        v_id_externo := v_envio_canal->>'idExterno';
        v_estado_entrega := 'ENVIADO';
      else
        v_estado_entrega := 'FALLIDO';
      end if;
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
      'error_whatsapp', case when v_cnv_prev.cnv_canal = 'whatsapp' and v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
      'error_canal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end
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
    'canal', v_cnv.cnv_canal,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo,
    'avisoWhatsApp', case
      when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false)
      then v_envio_canal->>'error'
      else null
    end,
    'avisoCanal', case
      when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false)
      then v_envio_canal->>'error'
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

-- 12. Extender com_fn_omnicanal_responder_con_aria_panel para despachar también a Facebook e Instagram
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
  v_prefijo_conv text;
  v_cuerpo_aria jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_run_id text;
  v_envio_canal jsonb := null;
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

  v_prefijo_conv := case v_cnv.cnv_canal
    when 'whatsapp' then 'wa-'
    when 'facebook' then 'fb-'
    when 'instagram' then 'ig-'
    else 'web-'
  end;

  v_cuerpo_aria := jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', v_prefijo_conv || regexp_replace(coalesce(v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g')
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
    v_envio_canal := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
      v_negocio,
      coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
      v_respuesta
    );
  elsif v_cnv.cnv_canal in ('facebook', 'instagram') then
    v_envio_canal := comun_comercio.com_fn_interno_despachar_meta_mensajeria(
      v_negocio,
      v_cnv.cnv_canal,
      v_cnv.cnv_remitente_id,
      v_respuesta,
      null,
      null,
      null,
      v_cnv.cnv_ventana_24h_expira_en,
      false
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
    case when v_envio_canal is not null then v_envio_canal->>'idExterno' else null end,
    case when v_envio_canal is null or coalesce((v_envio_canal->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', v_cnv.cnv_canal,
      'run_id', v_run_id,
      'error_canal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end
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
    'avisoCanal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
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
