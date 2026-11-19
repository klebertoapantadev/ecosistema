-- ==============================================================================
-- Migración: 20261119000007_guardar_tarjeta_staff_y_grant_update_orden_taller.sql
-- Requerimientos: PLT-009 / TNK-005
-- Descripción:
--   1. Otorga GRANT UPDATE sobre comun_comercio.com_orden_taller a authenticated
--      (resguardado por la política RLS com_orden_taller_escritura existente).
--   2. Crea RPC SECURITY DEFINER com_fn_guardar_tarjeta_staff para persistir de forma
--      atómica el diseño completo de la tarjeta (imágenes con rotación/transparencia,
--      múltiples cuadros de texto, firma, fuentes, música y lyrics) en com_orden_taller,
--      com_proforma y com_entrega_evidencia desde el panel interno sin fallos silenciosos.
-- ==============================================================================

grant update on comun_comercio.com_orden_taller to authenticated;

create or replace function comun_comercio.com_fn_guardar_tarjeta_staff(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg text := lower(btrim(coalesce(p_negocio, 'tinkay')));
  v_uid uuid := auth.uid();
  v_autor_nombre text := 'Staff';
  v_autor_rol text := 'STAFF';
  v_pedido_id uuid := null;
  v_orden_taller_id uuid := null;
  v_entrega_id uuid := null;
  v_ded text := btrim(coalesce(p_payload->>'dedicatoria', ''));
  v_para text := p_payload->>'destinatarioNombre';
  v_de text := p_payload->>'compradorNombre';
  v_tipo text := coalesce(nullif(btrim(coalesce(p_payload->>'tarjetaTipo', '')), ''), 'DIPTICO');
  v_es_condol boolean := (v_tipo = 'CONDOLENCIAS_PLANA');
  v_conf boolean := case when v_es_condol then false else coalesce((p_payload->>'tarjetaConfidencial')::boolean, false) end;
  v_mus_url text := case when v_es_condol then null else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaUrl', '')), '') end;
  v_mus_tit text := case when v_es_condol then null else nullif(btrim(coalesce(p_payload->>'tarjetaMusicaTitulo', '')), '') end;
  v_lyrics jsonb := case when v_es_condol then '[]'::jsonb when jsonb_typeof(p_payload->'tarjetaLyrics') = 'array' then p_payload->'tarjetaLyrics' else '[]'::jsonb end;
  v_diseno jsonb := case when jsonb_typeof(p_payload->'tarjetaDiseno') = 'object' then p_payload->'tarjetaDiseno' else null end;
  v_orden record;
  v_prf record;
  v_ent record;
  v_meta jsonb;
  v_hist jsonb;
  v_det jsonb;
  v_tar jsonb;
  v_items jsonb;
  v_token_final text := null;
  v_meta_final jsonb := null;
  v_actualizado boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para guardar la tarjeta.');
  end if;

  if not (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_neg)
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para editar tarjetas de este negocio.');
  end if;

  select
    coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Staff'),
    case when u.usu_superadmin_plataforma then 'SUPERADMIN' else 'STAFF' end
    into v_autor_nombre, v_autor_rol
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    if nullif(btrim(coalesce(p_payload->>'pedidoId', '')), '') ~* '^[0-9a-f-]{36}$' then
      v_pedido_id := (p_payload->>'pedidoId')::uuid;
    end if;
    if nullif(btrim(coalesce(p_payload->>'ordenTallerId', '')), '') ~* '^[0-9a-f-]{36}$' then
      v_orden_taller_id := (p_payload->>'ordenTallerId')::uuid;
    end if;
    if nullif(btrim(coalesce(p_payload->>'entregaId', '')), '') ~* '^[0-9a-f-]{36}$' then
      v_entrega_id := (p_payload->>'entregaId')::uuid;
    end if;
  exception when others then
    null;
  end;

  -- 1. Actualizar com_orden_taller
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    select * into v_orden
      from comun_comercio.com_orden_taller o
     where o.ota_eliminado_en is null
       and (
         (v_orden_taller_id is not null and o.ota_id = v_orden_taller_id)
         or (v_pedido_id is not null and (o.ota_id = v_pedido_id or o.ota_proforma_id = v_pedido_id))
       )
     limit 1;

    if v_orden.ota_id is not null then
      v_meta := coalesce(v_orden.ota_tarjeta_metadata, '{}'::jsonb);
      v_hist := coalesce(v_meta->'historial_cambios', '[]'::jsonb);
      if coalesce(v_orden.ota_dedicatoria, '') <> v_ded or coalesce(v_orden.ota_tarjeta_musica_url, '') <> coalesce(v_mus_url, '') then
        v_hist := v_hist || jsonb_build_array(
          jsonb_build_object(
            'autor', v_autor_nombre,
            'rol', v_autor_rol,
            'fecha', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            'dedicatoria_anterior', coalesce(v_orden.ota_dedicatoria, ''),
            'dedicatoria_nueva', v_ded
          )
        );
      end if;

      v_meta := jsonb_set(v_meta, '{confidencial_solo_qr}', to_jsonb(v_conf), true);
      v_meta := jsonb_set(v_meta, '{editado_por_staff}', 'true'::jsonb, true);
      v_meta := jsonb_set(v_meta, '{ultimo_editor_nombre}', to_jsonb(v_autor_nombre), true);
      v_meta := jsonb_set(v_meta, '{ultimo_editor_rol}', to_jsonb(v_autor_rol), true);
      v_meta := jsonb_set(v_meta, '{ultima_edicion_staff_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
      v_meta := jsonb_set(v_meta, '{historial_cambios}', v_hist, true);
      if v_diseno is not null then
        v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
      end if;

      v_token_final := coalesce(nullif(btrim(v_orden.ota_tarjeta_token), ''), substr(replace(gen_random_uuid()::text, '-', ''), 1, 18));

      update comun_comercio.com_orden_taller
         set ota_dedicatoria = v_ded,
             ota_destinatario_fallecido = coalesce(nullif(btrim(v_para), ''), ota_destinatario_fallecido),
             ota_cliente_solicita = coalesce(nullif(btrim(v_de), ''), ota_cliente_solicita),
             ota_tarjeta_token = v_token_final,
             ota_tarjeta_tipo = case when v_tipo in ('DIPTICO', 'CONDOLENCIAS_PLANA', 'SOLO_DIGITAL') then v_tipo else ota_tarjeta_tipo end,
             ota_tarjeta_musica_url = v_mus_url,
             ota_tarjeta_musica_titulo = v_mus_tit,
             ota_tarjeta_lyrics = v_lyrics,
             ota_tarjeta_metadata = v_meta,
             ota_actualizado_en = now()
       where ota_id = v_orden.ota_id;

      v_meta_final := v_meta;
      v_actualizado := true;
    end if;
  end if;

  -- 2. Sincronizar / actualizar com_proforma
  if to_regclass('comun_comercio.com_proforma') is not null then
    select * into v_prf
      from comun_comercio.com_proforma p
     where p.prf_eliminado_en is null
       and (
         (v_pedido_id is not null and p.prf_id = v_pedido_id)
         or (v_orden.ota_proforma_id is not null and p.prf_id = v_orden.ota_proforma_id)
       )
     limit 1;

    if v_prf.prf_id is not null then
      v_det := coalesce(v_prf.prf_detalle_proforma, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_meta_final, v_tar->'metadata', '{}'::jsonb);

      if v_meta_final is null then
        v_meta := jsonb_set(v_meta, '{confidencial_solo_qr}', to_jsonb(v_conf), true);
        v_meta := jsonb_set(v_meta, '{editado_por_staff}', 'true'::jsonb, true);
        v_meta := jsonb_set(v_meta, '{ultimo_editor_nombre}', to_jsonb(v_autor_nombre), true);
        v_meta := jsonb_set(v_meta, '{ultimo_editor_rol}', to_jsonb(v_autor_rol), true);
        v_meta := jsonb_set(v_meta, '{ultima_edicion_staff_en}', to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')), true);
        if v_diseno is not null then
          v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
        end if;
      end if;

      v_token_final := coalesce(v_token_final, nullif(btrim(v_tar->>'token'), ''), nullif(btrim(v_prf.prf_token_aprobacion), ''), v_prf.prf_id::text);

      v_tar := v_tar || jsonb_build_object(
        'token', v_token_final,
        'tipo', v_tipo,
        'confidencial', v_conf,
        'mensaje', v_ded,
        'para', coalesce(nullif(btrim(v_para), ''), v_tar->>'para', ''),
        'de', coalesce(nullif(btrim(v_de), ''), v_tar->>'de', v_prf.prf_cliente_nombre, ''),
        'diseno', coalesce(v_diseno, v_tar->'diseno', '{}'::jsonb),
        'musica_url', v_mus_url,
        'musica_titulo', v_mus_tit,
        'lyrics', v_lyrics,
        'metadata', v_meta
      );

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

      v_meta_final := v_meta;
      v_actualizado := true;
    end if;
  end if;

  -- 3. Sincronizar / actualizar com_entrega_evidencia
  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    select * into v_ent
      from comun_comercio.com_entrega_evidencia e
     where e.ent_eliminado_en is null
       and (
         (v_entrega_id is not null and e.ent_id = v_entrega_id)
         or (v_pedido_id is not null and e.ent_id = v_pedido_id)
       )
     limit 1;

    if v_ent.ent_id is not null then
      v_det := coalesce(v_ent.ent_detalle_entrega, '{}'::jsonb);
      v_tar := coalesce(v_det->'tarjeta', '{}'::jsonb);
      v_meta := coalesce(v_meta_final, v_tar->'metadata', '{}'::jsonb);
      if v_diseno is not null then
        v_meta := jsonb_set(v_meta, '{diseno}', v_diseno, true);
      end if;
      v_token_final := coalesce(v_token_final, nullif(btrim(v_tar->>'token'), ''), v_ent.ent_id::text);

      v_tar := v_tar || jsonb_build_object(
        'token', v_token_final,
        'tipo', v_tipo,
        'confidencial', v_conf,
        'mensaje', v_ded,
        'para', coalesce(nullif(btrim(v_para), ''), v_ent.ent_fallecido_destinatario, ''),
        'de', coalesce(nullif(btrim(v_de), ''), v_ent.ent_coordinador_nombre, ''),
        'diseno', coalesce(v_diseno, v_tar->'diseno', '{}'::jsonb),
        'musica_url', v_mus_url,
        'musica_titulo', v_mus_tit,
        'lyrics', v_lyrics,
        'metadata', v_meta
      );
      v_det := jsonb_set(v_det, '{dedicatoria}', to_jsonb(v_ded), true);
      v_det := jsonb_set(v_det, '{tarjeta}', v_tar, true);

      update comun_comercio.com_entrega_evidencia
         set ent_detalle_entrega = v_det,
             ent_actualizado_en = now()
       where ent_id = v_ent.ent_id;

      v_meta_final := v_meta;
      v_actualizado := true;
    end if;
  end if;

  if not v_actualizado then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la orden o pedido para guardar la tarjeta.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'tarjetaToken', v_token_final,
    'tarjetaConfidencial', v_conf,
    'tarjetaMetadata', coalesce(v_meta_final, '{}'::jsonb)
  );
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_tarjeta_staff(text, jsonb) to authenticated, service_role;
