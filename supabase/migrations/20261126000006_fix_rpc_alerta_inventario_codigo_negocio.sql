-- =============================================================================
-- Migración: 20261126000006_fix_rpc_alerta_inventario_codigo_negocio.sql
-- Requerimientos: TNK-002 / TNK-005 / PLT-009
-- Descripción:
--   Corrige `comun_comercio.com_fn_verificar_y_alertar_inventario_rosas` para
--   eliminar la dependencia en `comun_seguridad.seg_fn_codigo_notificacion_negocio`
--   (inexistente en la instancia productiva) y alinear `not_negocio` con el código
--   usado por `seg_fn_monitoreo_notificaciones` y `CampanaNotificaciones`
--   ('TINKAY', 'MARGARITAS', 'FASTFIX', 'TRANQ').
-- =============================================================================

create or replace function comun_comercio.com_fn_verificar_y_alertar_inventario_rosas(
  p_negocio text default 'tinkay',
  p_horas_limite numeric default 15,
  p_cooldown_horas numeric default 6,
  p_forzar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_codigo_corto text := case comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio)
    when 'tinkay' then 'TINKAY'
    when 'fastfix' then 'FASTFIX'
    when 'margaritas' then 'MARGARITAS'
    else 'TRANQ'
  end;
  v_uid uuid := auth.uid();
  v_horas_limite numeric := greatest(1, coalesce(p_horas_limite, 15));
  v_cooldown_horas numeric := greatest(0.5, coalesce(p_cooldown_horas, 6));
  v_fecha_corte timestamptz := null;
  v_horas_transcurridas numeric := null;
  v_requiere_alerta boolean := false;
  v_cfg comun_configuracion.cfg_negocio;
  v_ultima_alerta_en timestamptz := null;
  v_emitir_ahora boolean := false;
  v_titulo text;
  v_cuerpo text;
  v_html text;
  v_pub text := null;
  v_priv text := null;
  v_dest record;
  v_not_id uuid;
  v_url_inv text;
  v_notificaciones_map jsonb := '{}'::jsonb;
  v_suscripciones jsonb := '[]'::jsonb;
begin
  -- Si es llamado por un usuario autenticado, validar que pertenezca al staff del negocio
  if v_uid is not null then
    if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio)
       and not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
      return jsonb_build_object('ok', false, 'error', 'Sin permisos para verificar el inventario de rosas.');
    end if;
  end if;

  select c.icr_fecha_corte
    into v_fecha_corte
    from comun_comercio.com_inventario_corte c
   where c.icr_negocio = v_negocio
     and c.icr_eliminado_en is null
   order by c.icr_fecha_corte desc
   limit 1;

  if v_fecha_corte is not null then
    v_horas_transcurridas := round((extract(epoch from (now() - v_fecha_corte)) / 3600.0)::numeric, 1);
  end if;

  v_requiere_alerta := (v_fecha_corte is null) or (v_horas_transcurridas >= v_horas_limite);

  select *
    into v_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_negocio
   limit 1;

  begin
    v_ultima_alerta_en := nullif(
      btrim(coalesce(v_cfg.cfg_detalle_configuracion #>> '{alerta_inventario_rosas,ultima_alerta_en}', '')),
      ''
    )::timestamptz;
  exception when others then
    v_ultima_alerta_en := null;
  end;

  v_titulo := '🌹 Inventario de rosas pendiente (+' || round(v_horas_limite)::text || 'h)';
  if v_fecha_corte is null then
    v_cuerpo := 'Aún no se ha registrado un inventario de rosas. Realízalo para mostrar colores disponibles en la tienda.';
    v_html := '<div><strong>Inventario de rosas pendiente:</strong> Aún no se ha registrado un corte de inventario de rosas. Regístralo en <strong>Inventario de Rosas (IA)</strong> para contar con colores disponibles en la tienda.</div>';
  else
    v_cuerpo := 'Han pasado ' || v_horas_transcurridas::text || 'h desde el último inventario de rosas. Actualízalo para mantener los colores disponibles en tienda.';
    v_html := '<div><strong>Inventario de rosas desactualizado:</strong> Han pasado <strong>' || v_horas_transcurridas::text || ' horas</strong> desde el último corte (límite ' || round(v_horas_limite)::text || 'h). Realiza un nuevo conteo para contar con colores disponibles en la tienda.</div>';
  end if;

  if v_requiere_alerta then
    if coalesce(p_forzar, false)
       or v_ultima_alerta_en is null
       or (extract(epoch from (now() - v_ultima_alerta_en)) / 3600.0) >= v_cooldown_horas then
      v_emitir_ahora := true;
    end if;
  end if;

  if v_emitir_ahora then
    v_pub := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'vapid_public_key', '')), '');
    if v_cfg.cfg_vapid_secreto_id is not null then
      select d.decrypted_secret into v_priv
        from vault.decrypted_secrets d
       where d.id = v_cfg.cfg_vapid_secreto_id;
    end if;

    for v_dest in
      with roles_equipo as (
        select
          u.usu_id as usuario_id,
          'SUPERADMIN'::text as rol,
          100 as prioridad
        from comun_seguridad.seg_usuario u
        where u.usu_eliminado_en is null
          and (
            (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com'))
            or (v_negocio <> 'tinkay' and u.usu_superadmin_plataforma = true)
          )

        union all

        select
          u.usu_id as usuario_id,
          case
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('SUPERADMIN') and v_negocio <> 'tinkay' then 'SUPERADMIN'
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN')
                 and (v_negocio <> 'tinkay' or coalesce((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false))
              then 'ADMINISTRADOR'
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO') then 'OPERADOR'
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR') then 'VENTAS'
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('TALLER', 'FLORISTA') then 'TALLER'
            else null
          end as rol,
          case
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('SUPERADMIN') then 95
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN') then 80
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('OPERADOR', 'AUXILIAR', 'TECNICO') then 30
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR') then 20
            when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('TALLER', 'FLORISTA') then 18
            else 0
          end as prioridad
        from comun_seguridad.seg_membresia m
        join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
        left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
        left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
        where u.usu_eliminado_en is null
          and m.mem_estado = 'ACTIVO'
          and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
      )
      select distinct on (r.usuario_id)
        r.usuario_id,
        r.rol
      from roles_equipo r
      where r.rol is not null
      order by r.usuario_id, r.prioridad desc
    loop
      v_not_id := gen_random_uuid();
      v_url_inv := '/panel/inventario-rosas?not_id=' || v_not_id::text;

      insert into comun_notificacion.not_registro (
        not_id,
        not_usuario_id,
        not_negocio,
        not_canal,
        not_titulo,
        not_contenido_html,
        not_url_accion,
        not_detalles,
        not_creado_en
      ) values (
        v_not_id,
        v_dest.usuario_id,
        v_codigo_corto,
        'IN_APP',
        v_titulo,
        v_html,
        v_url_inv,
        jsonb_build_object(
          'clave_original', v_not_id::text,
          'negocio_canon', v_negocio,
          'tipo_evento', 'ALERTA_INVENTARIO_ROSAS_15H',
          'horas_limite', v_horas_limite,
          'horas_desde_ultimo_corte', v_horas_transcurridas,
          'fecha_ultimo_corte', v_fecha_corte
        ),
        now()
      );

      v_notificaciones_map := v_notificaciones_map || jsonb_build_object(
        v_dest.usuario_id::text,
        jsonb_build_object(
          'notId', v_not_id::text,
          'rol', v_dest.rol,
          'url', v_url_inv
        )
      );

      select v_suscripciones || coalesce(
        jsonb_agg(
          jsonb_build_object(
            'usuarioId', s.psu_usuario_id,
            'rol', v_dest.rol,
            'notId', v_not_id::text,
            'url', v_url_inv,
            'endpoint', s.psu_endpoint,
            'p256dh', s.psu_p256dh,
            'auth', s.psu_auth
          )
        ),
        '[]'::jsonb
      )
      into v_suscripciones
      from comun_seguridad.seg_push_suscripcion s
      where s.psu_usuario_id = v_dest.usuario_id
        and s.psu_negocio = v_negocio
        and s.psu_activo = true
        and s.psu_eliminado_en is null;
    end loop;

    update comun_configuracion.cfg_negocio
       set cfg_detalle_configuracion =
             coalesce(cfg_detalle_configuracion, '{}'::jsonb)
             || jsonb_build_object(
               'alerta_inventario_rosas',
               jsonb_build_object(
                 'ultima_alerta_en', now(),
                 'ultimo_corte_evaluado_en', v_fecha_corte,
                 'horas_transcurridas', v_horas_transcurridas,
                 'horas_limite', v_horas_limite
               )
             ),
           cfg_actualizado_en = now()
     where cfg_negocio = v_negocio;
  end if;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'requiereAlerta', v_requiere_alerta,
    'alertaEmitida', v_emitir_ahora,
    'horasLimite', v_horas_limite,
    'horasDesdeUltimoCorte', v_horas_transcurridas,
    'fechaUltimoCorte', v_fecha_corte,
    'ultimaAlertaEn', case when v_emitir_ahora then now() else v_ultima_alerta_en end,
    'titulo', v_titulo,
    'cuerpoPlano', v_cuerpo,
    'vapidPublicKey', case when v_emitir_ahora then v_pub else null end,
    'vapidPrivateKey', case when v_emitir_ahora then v_priv else null end,
    'notificacionesPorUsuario', v_notificaciones_map,
    'suscripciones', v_suscripciones
  );
end;
$$;

revoke all on function comun_comercio.com_fn_verificar_y_alertar_inventario_rosas(text, numeric, numeric, boolean) from public, anon;
grant execute on function comun_comercio.com_fn_verificar_y_alertar_inventario_rosas(text, numeric, numeric, boolean) to authenticated, service_role;
