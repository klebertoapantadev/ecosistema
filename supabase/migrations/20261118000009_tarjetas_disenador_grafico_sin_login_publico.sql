-- ==============================================================================
-- Migración: 20261118000009_tarjetas_disenador_grafico_sin_login_publico.sql
-- Requerimientos: PLT-009 / TNK-005
-- Descripción:
--   1. Habilita lectura y edición pública sin login (anon) para /dedicatoria/[token] y
--      /tarjeta-editar/[tokenEdicion] cubriendo com_orden_taller, com_proforma y com_entrega_evidencia.
--   2. Soporta persistencia del diseñador gráfico de tarjeta (diseno JSONB: posición X/Y de texto,
--      alineación/justificación, fuente, tamaño e imagen incrustada con coordenadas y tamaño en mm).
--   3. Garantiza que en Condolencias no aplique QR, música ni lyrics, y que en Dedicatoria sea
--      mutuamente excluyente imprimir el mensaje o imprimir solo el QR.
--   4. Habilita subida acotada de imágenes y audios de tarjeta en bucket comun-publico para anon/authenticated.
-- ==============================================================================

-- 1. Bucket comun-publico: permitir audio e imágenes para tarjetas (máx 15 MB)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    update storage.buckets
       set allowed_mime_types = (
             select array_agg(distinct m)
             from unnest(
               coalesce(storage.buckets.allowed_mime_types, array[]::text[]) ||
               array[
                 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                 'application/pdf',
                 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm'
               ]
             ) as m
           ),
           file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 15728640)
     where id = 'comun-publico';

    drop policy if exists "tarjetas_media_insert_acotado" on storage.objects;
    create policy "tarjetas_media_insert_acotado"
      on storage.objects
      for insert
      to anon, authenticated
      with check (
        bucket_id = 'comun-publico'
        and (
          name ~ '^tarjetas-(audio|imagenes)/[a-z0-9_-]+/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9._-]+$'
          or name ~ '^[a-z0-9_-]+/tarjetas-(audio|imagenes)/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9._-]+$'
        )
      );
  end if;
end $$;

-- 2. RPC Pública Universal para Consultar Tarjeta Digital (sin requerir sesión iniciada)
drop function if exists comun_comercio.com_fn_obtener_tarjeta_publica(text);

create or replace function comun_comercio.com_fn_obtener_tarjeta_publica(
  p_token text,
  p_sumar_vista boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
  v_uuid uuid := null;
  v_orden record;
  v_prf record;
  v_ent record;
  v_vistas int;
  v_meta jsonb;
  v_det jsonb;
  v_tar jsonb;
  v_log jsonb;
  v_primer_ded jsonb;
  v_tipo text;
  v_es_condol boolean;
  v_bloqueado boolean;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Token de tarjeta no proporcionado.');
  end if;

  begin
    if v_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_uuid := v_token::uuid;
    end if;
  exception when others then
    v_uuid := null;
  end;

  -- A) Buscar en comun_comercio.com_orden_taller si la tabla existe
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller o
     where o.ota_eliminado_en is null
       and (
         o.ota_tarjeta_token = v_token
         or (v_uuid is not null and (o.ota_id = v_uuid or o.ota_proforma_id = v_uuid or o.ota_entrega_id = v_uuid))
       )
     limit 1;

    if v_orden.ota_id is not null then
      v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
      v_vistas := coalesce((v_meta->>'vistas_cliente')::int, 0);
      if coalesce(p_sumar_vista, true) then
        v_vistas := v_vistas + 1;
        v_meta := jsonb_set(v_meta, '{vistas_cliente}', to_jsonb(v_vistas), true);
        v_meta := jsonb_set(v_meta, '{ultima_vista_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
        update comun_comercio.com_orden_taller
           set ota_tarjeta_metadata = v_meta
         where ota_id = v_orden.ota_id;
      end if;

      v_tipo := coalesce(v_orden.ota_tarjeta_tipo, 'DIPTICO');
      v_es_condol := (v_tipo = 'CONDOLENCIAS_PLANA');

      return jsonb_build_object(
        'ok', true,
        'ordenId', v_orden.ota_id,
        'codigo', v_orden.ota_codigo,
        'negocio', v_orden.ota_negocio,
        'tokenVista', coalesce(v_orden.ota_tarjeta_token, v_orden.ota_id::text),
        'destinatario', coalesce(nullif(v_orden.ota_destinatario_fallecido, ''), ''),
        'remitente', coalesce(nullif(v_orden.ota_cliente_solicita, ''), ''),
        'dedicatoria', coalesce(v_orden.ota_dedicatoria, ''),
        'tipo', v_tipo,
        'confidencial', case when v_es_condol then false else coalesce((v_meta->>'confidencial_solo_qr')::boolean, false) end,
        'diseno', coalesce(v_meta->'diseno', '{}'::jsonb),
        'musicaUrl', case when v_es_condol then null else v_orden.ota_tarjeta_musica_url end,
        'musicaTitulo', case when v_es_condol then null else v_orden.ota_tarjeta_musica_titulo end,
        'lyrics', case when v_es_condol then '[]'::jsonb else coalesce(v_orden.ota_tarjeta_lyrics, '[]'::jsonb) end,
        'fechaEntrega', to_char(v_orden.ota_fecha_entrega, 'YYYY-MM-DD'),
        'estadoTaller', v_orden.ota_estado_taller,
        'bloqueadoEdicion', (
          v_orden.ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')
          or coalesce((v_meta->>'impresiones')::int, 0) > 0
        ),
        'vistas', v_vistas
      );
    end if;
  end if;

  -- B) Buscar en comun_comercio.com_proforma (pedidos web y pedidos manuales híbridos)
  if to_regclass('comun_comercio.com_proforma') is not null then
    select * into v_prf
      from comun_comercio.com_proforma p
     where p.prf_eliminado_en is null
       and (
         p.prf_token_aprobacion = v_token
         or (v_uuid is not null and p.prf_id = v_uuid)
         or (p.prf_detalle_proforma->'tarjeta'->>'token') = v_token
       )
     limit 1;

    if v_prf.prf_id is not null then
      v_det := coalesce(v_prf.prf_detalle_proforma, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_tar->'metadata', '{}'::jsonb);
      v_log := coalesce(v_det->'logistica_entrega', '{}'::jsonb);

      select elem->'dedicatoria' into v_primer_ded
        from jsonb_array_elements(
          case when jsonb_typeof(v_det->'items') = 'array' then v_det->'items' else '[]'::jsonb end
        ) as elem
       where coalesce(elem->'dedicatoria'->>'mensaje', '') <> ''
       limit 1;

      v_vistas := coalesce((v_meta->>'vistas_cliente')::int, 0);
      if coalesce(p_sumar_vista, true) then
        v_vistas := v_vistas + 1;
        v_meta := jsonb_set(v_meta, '{vistas_cliente}', to_jsonb(v_vistas), true);
        v_meta := jsonb_set(v_meta, '{ultima_vista_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
        v_tar := jsonb_set(v_tar, '{metadata}', v_meta, true);
        v_det := jsonb_set(v_det, '{tarjeta}', v_tar, true);
        update comun_comercio.com_proforma
           set prf_detalle_proforma = v_det
         where prf_id = v_prf.prf_id;
      end if;

      v_tipo := case
        when (v_tar->>'tipo') in ('CONDOLENCIAS_PLANA', 'SOLO_DIGITAL', 'DIPTICO') then v_tar->>'tipo'
        when upper(coalesce(v_det->>'clasificacion_pedido', '')) in ('CONDOLENCIAS', 'EXEQUIALES') then 'CONDOLENCIAS_PLANA'
        else 'DIPTICO'
      end;
      v_es_condol := (v_tipo = 'CONDOLENCIAS_PLANA');
      v_bloqueado := (
        upper(coalesce(v_prf.prf_estado, '')) in ('EN_RUTA', 'ENTREGADO')
        or coalesce((v_meta->>'impresiones')::int, 0) > 0
      );

      return jsonb_build_object(
        'ok', true,
        'ordenId', v_prf.prf_id,
        'codigo', coalesce(v_det->>'codigo_orden', v_det->>'codigo_proforma', 'PEDIDO'),
        'negocio', coalesce(v_prf.prf_negocio, 'tinkay'),
        'tokenVista', coalesce(v_tar->>'token', v_prf.prf_token_aprobacion, v_prf.prf_id::text),
        'destinatario', coalesce(v_tar->>'para', v_primer_ded->>'para', v_log->>'destinatario_nombre', ''),
        'remitente', coalesce(v_tar->>'de', v_primer_ded->>'de', v_prf.prf_cliente_nombre, ''),
        'dedicatoria', coalesce(v_tar->>'mensaje', v_primer_ded->>'mensaje', ''),
        'tipo', v_tipo,
        'confidencial', case when v_es_condol then false else coalesce((v_tar->>'confidencial')::boolean, (v_meta->>'confidencial_solo_qr')::boolean, false) end,
        'diseno', coalesce(v_tar->'diseno', v_meta->'diseno', '{}'::jsonb),
        'musicaUrl', case when v_es_condol then null else coalesce(v_tar->>'musica_url', v_tar->>'musicaUrl') end,
        'musicaTitulo', case when v_es_condol then null else coalesce(v_tar->>'musica_titulo', v_tar->>'musicaTitulo') end,
        'lyrics', case when v_es_condol then '[]'::jsonb else coalesce(v_tar->'lyrics', '[]'::jsonb) end,
        'fechaEntrega', coalesce(substr(v_log->>'fecha_entrega', 1, 10), ''),
        'estadoTaller', coalesce(v_prf.prf_estado, 'ORDEN_CONFIRMADA'),
        'bloqueadoEdicion', v_bloqueado,
        'vistas', v_vistas
      );
    end if;
  end if;

  -- C) Buscar en comun_comercio.com_entrega_evidencia (órdenes Exequiales OT-...)
  if v_uuid is not null and to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    select * into v_ent
      from comun_comercio.com_entrega_evidencia e
     where e.ent_id = v_uuid
       and e.ent_eliminado_en is null
     limit 1;

    if v_ent.ent_id is not null then
      v_det := coalesce(v_ent.ent_detalle_entrega, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_tar->'metadata', '{}'::jsonb);
      v_vistas := coalesce((v_meta->>'vistas_cliente')::int, 0);

      return jsonb_build_object(
        'ok', true,
        'ordenId', v_ent.ent_id,
        'codigo', coalesce(v_ent.ent_codigo_ot, 'OT'),
        'negocio', coalesce(v_ent.ent_negocio, 'tinkay'),
        'tokenVista', v_ent.ent_id::text,
        'destinatario', coalesce(v_tar->>'para', v_ent.ent_fallecido_destinatario, ''),
        'remitente', coalesce(v_tar->>'de', v_ent.ent_coordinador_nombre, ''),
        'dedicatoria', coalesce(v_tar->>'mensaje', v_det->>'dedicatoria', ''),
        'tipo', 'CONDOLENCIAS_PLANA',
        'confidencial', false,
        'diseno', coalesce(v_tar->'diseno', v_meta->'diseno', '{}'::jsonb),
        'musicaUrl', null,
        'musicaTitulo', null,
        'lyrics', '[]'::jsonb,
        'fechaEntrega', coalesce(substr(v_ent.ent_fecha_servicio::text, 1, 10), ''),
        'estadoTaller', coalesce(v_ent.ent_estado, 'PROGRAMADA'),
        'bloqueadoEdicion', (coalesce(v_ent.ent_estado, '') <> 'PROGRAMADA'),
        'vistas', v_vistas
      );
    end if;
  end if;

  return jsonb_build_object('ok', false, 'error', 'La tarjeta solicitada no existe o ya no está disponible.');
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_tarjeta_publica(text, boolean) to anon, authenticated, service_role;

-- 3. RPC SECURITY DEFINER para guardar edición de tarjeta (invocada desde Next.js tras validar firma HMAC de tokenEdicion)
create or replace function comun_comercio.com_fn_editar_tarjeta_publica(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
  v_uuid uuid := null;
  v_ded text := btrim(coalesce(p_payload->>'dedicatoria', ''));
  v_para text := p_payload->>'para';
  v_de text := p_payload->>'de';
  v_conf boolean := coalesce((p_payload->>'confidencial')::boolean, false);
  v_mus_url text := nullif(btrim(coalesce(p_payload->>'musicaUrl', '')), '');
  v_mus_tit text := nullif(btrim(coalesce(p_payload->>'musicaTitulo', '')), '');
  v_lyrics jsonb := case when jsonb_typeof(p_payload->'lyrics') = 'array' then p_payload->'lyrics' else '[]'::jsonb end;
  v_diseno jsonb := case when jsonb_typeof(p_payload->'diseno') = 'object' then p_payload->'diseno' else null end;
  v_orden record;
  v_prf record;
  v_ent record;
  v_meta jsonb;
  v_hist jsonb;
  v_det jsonb;
  v_tar jsonb;
  v_items jsonb;
  v_es_condol boolean;
  v_actualizado boolean := false;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'Token inválido.');
  end if;

  begin
    if v_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_uuid := v_token::uuid;
    end if;
  exception when others then
    v_uuid := null;
  end;

  -- A) Actualizar en com_orden_taller si existe
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller o
     where o.ota_eliminado_en is null
       and (
         o.ota_tarjeta_token = v_token
         or (v_uuid is not null and (o.ota_id = v_uuid or o.ota_proforma_id = v_uuid or o.ota_entrega_id = v_uuid))
       )
     limit 1;

    if v_orden.ota_id is not null then
      v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
      if v_orden.ota_estado_taller in ('EN_PREPARACION', 'LISTO_ENTREGA', 'ENTREGADO')
         or coalesce((v_meta->>'impresiones')::int, 0) > 0 then
        return jsonb_build_object(
          'ok', false,
          'bloqueado', true,
          'error', 'Tu tarjeta ya fue impresa en taller y no admite más modificaciones.'
        );
      end if;

      v_es_condol := (coalesce(v_orden.ota_tarjeta_tipo, 'DIPTICO') = 'CONDOLENCIAS_PLANA');
      v_hist := coalesce(v_meta->'historial_cambios', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'autor', 'Cliente / Diseñador (Web)',
          'rol', 'CLIENTE',
          'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'dedicatoria_anterior', v_orden.ota_dedicatoria,
          'dedicatoria_nueva', v_ded
        )
      );

      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_hist, true);
      v_meta := jsonb_set(v_meta, '{editado_por_cliente}', 'true'::jsonb, true);
      v_meta := jsonb_set(v_meta, '{ultima_edicion_cliente_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
      v_meta := jsonb_set(v_meta, '{confidencial_solo_qr}', to_jsonb(case when v_es_condol then false else v_conf end), true);
      if v_diseno is not null then
        v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
      end if;

      update comun_comercio.com_orden_taller
         set ota_dedicatoria = v_ded,
             ota_destinatario_fallecido = coalesce(nullif(btrim(v_para), ''), ota_destinatario_fallecido),
             ota_cliente_solicita = coalesce(nullif(btrim(v_de), ''), ota_cliente_solicita),
             ota_tarjeta_musica_url = case when v_es_condol then null else v_mus_url end,
             ota_tarjeta_musica_titulo = case when v_es_condol then null else v_mus_tit end,
             ota_tarjeta_lyrics = case when v_es_condol then '[]'::jsonb else v_lyrics end,
             ota_tarjeta_metadata = v_meta,
             ota_actualizado_en = now()
       where ota_id = v_orden.ota_id;

      v_actualizado := true;
    end if;
  end if;

  -- B) Sincronizar / actualizar en com_proforma
  if to_regclass('comun_comercio.com_proforma') is not null then
    select * into v_prf
      from comun_comercio.com_proforma p
     where p.prf_eliminado_en is null
       and (
         p.prf_token_aprobacion = v_token
         or (v_uuid is not null and p.prf_id = v_uuid)
         or (p.prf_detalle_proforma->'tarjeta'->>'token') = v_token
         or (v_orden.ota_proforma_id is not null and p.prf_id = v_orden.ota_proforma_id)
       )
     limit 1;

    if v_prf.prf_id is not null then
      v_det := coalesce(v_prf.prf_detalle_proforma, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_tar->'metadata', '{}'::jsonb);

      if not v_actualizado and (
        upper(coalesce(v_prf.prf_estado, '')) in ('EN_RUTA', 'ENTREGADO')
        or coalesce((v_meta->>'impresiones')::int, 0) > 0
      ) then
        return jsonb_build_object(
          'ok', false,
          'bloqueado', true,
          'error', 'Tu tarjeta ya fue impresa en taller y no admite más modificaciones.'
        );
      end if;

      v_es_condol := (
        coalesce(v_tar->>'tipo', '') = 'CONDOLENCIAS_PLANA'
        or upper(coalesce(v_det->>'clasificacion_pedido', '')) in ('CONDOLENCIAS', 'EXEQUIALES')
      );

      v_hist := coalesce(v_meta->'historial_cambios', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'autor', 'Cliente / Diseñador (Web)',
          'rol', 'CLIENTE',
          'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'dedicatoria_anterior', v_tar->>'mensaje',
          'dedicatoria_nueva', v_ded
        )
      );

      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_hist, true);
      v_meta := jsonb_set(v_meta, '{editado_por_cliente}', 'true'::jsonb, true);
      v_meta := jsonb_set(v_meta, '{ultima_edicion_cliente_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
      v_meta := jsonb_set(v_meta, '{confidencial_solo_qr}', to_jsonb(case when v_es_condol then false else v_conf end), true);
      if v_diseno is not null then
        v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
      end if;

      v_tar := jsonb_strip_nulls(
        v_tar || jsonb_build_object(
          'token', coalesce(v_tar->>'token', v_prf.prf_token_aprobacion, v_prf.prf_id::text),
          'mensaje', v_ded,
          'para', coalesce(nullif(btrim(v_para), ''), v_tar->>'para', ''),
          'de', coalesce(nullif(btrim(v_de), ''), v_tar->>'de', v_prf.prf_cliente_nombre, ''),
          'confidencial', case when v_es_condol then false else v_conf end,
          'diseno', coalesce(v_diseno, v_tar->'diseno', '{}'::jsonb),
          'lyrics', case when v_es_condol then '[]'::jsonb else v_lyrics end,
          'metadata', v_meta
        )
      );
      v_tar := jsonb_set(v_tar, '{musica_url}', case when v_es_condol or v_mus_url is null then 'null'::jsonb else to_jsonb(v_mus_url) end, true);
      v_tar := jsonb_set(v_tar, '{musica_titulo}', case when v_es_condol or v_mus_tit is null then 'null'::jsonb else to_jsonb(v_mus_tit) end, true);

      -- Sincronizar también primer ítem para compatibilidad con BandejaPedidosTienda
      if jsonb_typeof(v_det->'items') = 'array' and jsonb_array_length(v_det->'items') > 0 then
        v_items := jsonb_set(
          v_det->'items',
          '{0,dedicatoria}',
          jsonb_build_object(
            'para', coalesce(nullif(btrim(v_para), ''), v_tar->>'para', ''),
            'de', coalesce(nullif(btrim(v_de), ''), v_tar->>'de', ''),
            'mensaje', v_ded
          ),
          true
        );
        v_det := jsonb_set(v_det, '{items}', v_items, true);
      end if;

      v_det := jsonb_set(v_det, '{tarjeta}', v_tar, true);

      update comun_comercio.com_proforma
         set prf_detalle_proforma = v_det,
             prf_actualizado_en = now()
       where prf_id = v_prf.prf_id;

      v_actualizado := true;
    end if;
  end if;

  -- C) Sincronizar / actualizar en com_entrega_evidencia (Exequiales)
  if v_uuid is not null and not v_actualizado and to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    select * into v_ent
      from comun_comercio.com_entrega_evidencia e
     where e.ent_id = v_uuid
       and e.ent_eliminado_en is null
     limit 1;

    if v_ent.ent_id is not null then
      if coalesce(v_ent.ent_estado, '') <> 'PROGRAMADA' then
        return jsonb_build_object('ok', false, 'bloqueado', true, 'error', 'La entrega ya fue realizada y la tarjeta no admite cambios.');
      end if;

      v_det := coalesce(v_ent.ent_detalle_entrega, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_tar->'metadata', '{}'::jsonb);
      if v_diseno is not null then
        v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
      end if;
      v_meta := jsonb_set(v_meta, '{editado_por_cliente}', 'true'::jsonb, true);

      v_tar := v_tar || jsonb_build_object(
        'token', v_ent.ent_id::text,
        'tipo', 'CONDOLENCIAS_PLANA',
        'confidencial', false,
        'mensaje', v_ded,
        'para', coalesce(nullif(btrim(v_para), ''), v_ent.ent_fallecido_destinatario, ''),
        'de', coalesce(nullif(btrim(v_de), ''), v_ent.ent_coordinador_nombre, ''),
        'diseno', coalesce(v_diseno, v_tar->'diseno', '{}'::jsonb),
        'metadata', v_meta
      );
      v_det := jsonb_set(v_det, '{dedicatoria}', to_jsonb(v_ded), true);
      v_det := jsonb_set(v_det, '{tarjeta}', v_tar, true);

      update comun_comercio.com_entrega_evidencia
         set ent_detalle_entrega = v_det,
             ent_actualizado_en = now()
       where ent_id = v_ent.ent_id;

      v_actualizado := true;
    end if;
  end if;

  if not v_actualizado then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la tarjeta para actualizar.');
  end if;

  return jsonb_build_object('ok', true, 'mensaje', 'Tarjeta actualizada correctamente.');
end;
$$;

grant execute on function comun_comercio.com_fn_editar_tarjeta_publica(text, jsonb) to anon, authenticated, service_role;
