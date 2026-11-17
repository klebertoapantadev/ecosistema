-- ==============================================================================
-- Migración: 20261116000004_whatsapp_ycloud_imagenes_multimedia.sql
-- Requerimientos: PLT-010 / TNK-004 (Envío nativo de imágenes adjuntas en WhatsApp vía YCloud)
-- Descripción:
--   Actualiza `comun_comercio.com_fn_interno_despachar_whatsapp_ycloud` para extraer
--   automáticamente imágenes en formato Markdown `![Título](https://...)` (incluyendo URLs
--   con paréntesis como `abanico_(2).jpg`) o enlaces directos a imágenes `.jpg/.jpeg/.png/.webp`,
--   despachándolas como mensajes multimedia reales `type: "image"` en la API v2 de YCloud
--   junto con su pie de foto (caption) y bloques de texto limpios en orden conversacional,
--   con respaldo automático a texto si alguna imagen externa no pudiera descargarse.
-- ==============================================================================

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
  v_restante text;
  v_match text[];
  v_full_tag text;
  v_pos integer;
  v_antes text;
  v_alt text;
  v_img_url text;
  v_intro text;
  v_caption text;
  v_parrafos text[];
  v_num_parrafos integer;
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_ultimo_id text := null;
  v_enviados integer := 0;
  v_imagenes_enviadas integer := 0;
  v_ultimo_error text := null;
  v_iter integer := 0;
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

  perform pg_catalog.set_config('statement_timeout', '50000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  -- 1. Normalizar formato Markdown para WhatsApp:
  --    - Convertir enlaces directos a archivos de imagen [Alt](https://...jpg) a ![Alt](https://...jpg)
  --    - Convertir enlaces normales [Texto](https://url) a "Texto: https://url"
  --    - Convertir negritas Markdown **texto** al formato nativo de WhatsApp *texto*
  v_restante := btrim(coalesce(p_texto, ''));
  v_restante := regexp_replace(
    v_restante,
    '(?<!!)\[([^\]]*)\]\((https?://(?:[^()\s]|\([^()\s]*\))+\.(?:jpg|jpeg|png|webp)(?:\?[^()\s]*)?)\)',
    '![\1](\2)',
    'gi'
  );
  v_restante := regexp_replace(
    v_restante,
    '(?<!!)\[([^\]]+)\]\((https?://(?:[^()\s]|\([^()\s]*\))+)\)',
    '\1: \2',
    'gi'
  );
  v_restante := regexp_replace(v_restante, '\*\*([^*]+)\*\*', '*\1*', 'g');

  -- 2. Recorrer secuencialmente cada imagen ![alt](https://...) respetando el orden del mensaje
  loop
    v_iter := v_iter + 1;
    exit when v_iter > 8; -- Límite sano por turno

    v_match := regexp_match(v_restante, '!\[([^\]]*)\]\((https?://(?:[^()\s]|\([^()\s]*\))+)\)');
    exit when v_match is null;

    v_alt := btrim(coalesce(v_match[1], ''));
    v_img_url := btrim(coalesce(v_match[2], ''));
    v_full_tag := '![' || coalesce(v_match[1], '') || '](' || coalesce(v_match[2], '') || ')';
    v_pos := strpos(v_restante, v_full_tag);
    exit when v_pos <= 0;

    v_antes := btrim(left(v_restante, v_pos - 1));
    v_restante := substr(v_restante, v_pos + char_length(v_full_tag));

    v_intro := '';
    v_caption := '';

    -- Separar párrafo introductorio general vs título/precio específico justo encima de la foto
    if v_antes <> '' then
      v_parrafos := regexp_split_to_array(v_antes, E'\\n\\s*\\n');
      v_num_parrafos := coalesce(array_length(v_parrafos, 1), 0);

      if v_num_parrafos >= 2 then
        v_intro := btrim(array_to_string(v_parrafos[1 : v_num_parrafos - 1], E'\n\n'));
        v_caption := btrim(v_parrafos[v_num_parrafos]);
      elsif char_length(v_antes) <= 900 then
        v_caption := v_antes;
      else
        v_intro := v_antes;
      end if;
    end if;

    if v_caption = '' then
      v_caption := v_alt;
    end if;

    -- 2.A Si había texto introductorio previo, enviarlo primero como mensaje de texto
    if v_intro <> '' then
      v_cuerpo := jsonb_build_object(
        'from', v_emisor,
        'to', v_destino_e164,
        'type', 'text',
        'text', jsonb_build_object('body', left(v_intro, 4000), 'preview_url', true)
      );

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
          array[extensions.http_header('X-API-Key', v_api_key)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;

        if v_status >= 200 and v_status < 300 then
          v_enviados := v_enviados + 1;
          begin
            v_json := v_content::jsonb;
            v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
          exception when others then null;
          end;
        end if;
      exception when others then
        v_ultimo_error := sqlerrm;
      end;
    end if;

    -- 2.B Enviar la fotografía real adjunta (type = "image") con su pie de foto (caption)
    if v_img_url <> '' then
      v_cuerpo := jsonb_build_object(
        'from', v_emisor,
        'to', v_destino_e164,
        'type', 'image',
        'image', jsonb_strip_nulls(jsonb_build_object(
          'link', v_img_url,
          'caption', case when v_caption <> '' then left(v_caption, 1020) else null end
        ))
      );

      begin
        select h.status, h.content into v_status, v_content
        from extensions.http((
          'POST',
          'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
          array[extensions.http_header('X-API-Key', v_api_key)],
          'application/json',
          v_cuerpo::text
        )::extensions.http_request) as h;

        if v_status >= 200 and v_status < 300 then
          v_enviados := v_enviados + 1;
          v_imagenes_enviadas := v_imagenes_enviadas + 1;
          begin
            v_json := v_content::jsonb;
            v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
          exception when others then null;
          end;
        else
          -- Respaldo seguro: si Meta/YCloud rechaza descargar esa URL de imagen puntual, enviar el caption + link como texto
          v_cuerpo := jsonb_build_object(
            'from', v_emisor,
            'to', v_destino_e164,
            'type', 'text',
            'text', jsonb_build_object(
              'body', left(coalesce(nullif(v_caption, '') || E'\n', '') || v_img_url, 4000),
              'preview_url', true
            )
          );
          select h.status, h.content into v_status, v_content
          from extensions.http((
            'POST',
            'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
            array[extensions.http_header('X-API-Key', v_api_key)],
            'application/json',
            v_cuerpo::text
          )::extensions.http_request) as h;
          if v_status >= 200 and v_status < 300 then
            v_enviados := v_enviados + 1;
          else
            begin
              v_json := v_content::jsonb;
              v_ultimo_error := coalesce(v_json->'error'->>'message', v_json->>'message', 'HTTP ' || coalesce(v_status::text, '?'));
            exception when others then
              v_ultimo_error := 'HTTP ' || coalesce(v_status::text, '?');
            end;
          end if;
        end if;
      exception when others then
        v_ultimo_error := sqlerrm;
      end;
    end if;
  end loop;

  -- 3. Enviar el texto final restante (o el mensaje único si no tenía imágenes)
  v_restante := btrim(regexp_replace(v_restante, E'\\n{3,}', E'\n\n', 'g'));

  if v_restante <> '' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'text',
      'text', jsonb_build_object(
        'body', left(v_restante, 4000),
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

      begin
        v_json := v_content::jsonb;
      exception when others then
        v_json := null;
      end;

      if v_status >= 200 and v_status < 300 then
        v_enviados := v_enviados + 1;
        v_ultimo_id := coalesce(v_json->>'wamid', v_json->>'id', v_ultimo_id);
      else
        v_ultimo_error := coalesce(
          v_json->'error'->>'message',
          v_json->'error'->'whatsappApiError'->>'message',
          v_json->>'message',
          'YCloud respondió HTTP ' || coalesce(v_status::text, '?')
        );
      end if;
    exception when others then
      v_ultimo_error := 'No se pudo conectar con YCloud API (' || sqlerrm || ')';
    end;
  end if;

  if v_enviados = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_ultimo_error, 'No se pudo enviar el mensaje a WhatsApp.')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'idExterno', v_ultimo_id,
    'mensajesEnviados', v_enviados,
    'imagenesEnviadas', v_imagenes_enviadas,
    'estado', 'sent'
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
