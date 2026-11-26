-- =============================================================================
-- Migración: 20261126000005_alerta_inventario_15h_y_colores_oferta.sql
-- Requerimientos: TNK-002 / TNK-005 / PLT-009
-- Descripción:
--   1. RPC `com_fn_guardar_colores_oferta_inventario`: permite al equipo marcar
--      colores de rosas en oferta desde /panel/inventario-rosas con un porcentaje
--      de descuento configurable (10% por defecto) almacenado en cfg_negocio.
--   2. Actualiza `com_fn_obtener_colores_inventario_tienda` para exponer además
--      `ofertaColoresActiva`, `porcentajeDescuentoOferta` y `coloresEnOferta`
--      a la tienda web.
--   3. RPC `com_fn_verificar_y_alertar_inventario_rosas`: verifica si han pasado
--      más de 15 horas desde el último corte de inventario de rosas; si es así,
--      emite alerta IN_APP (campana) al equipo de inventario (Admin, Operador,
--      Ventas, Taller) respetando cooldown anti-spam y retorna el contexto Web
--      Push (VAPID + suscripciones) para notificación push nativa.
--   4. Tarea horaria `pg_cron` (`alerta-inventario-rosas-15h`) como red de
--      seguridad automática.
-- =============================================================================

-- 1. RPC: Guardar configuración de colores en oferta y % descuento desde el inventario
create or replace function comun_comercio.com_fn_guardar_colores_oferta_inventario(
  p_negocio text,
  p_activo boolean default true,
  p_porcentaje_descuento numeric default 10,
  p_colores jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_autor text;
  v_pct numeric;
  v_colores_limpios text[] := array[]::text[];
  v_item text;
  v_clave text;
  v_oferta jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para configurar colores en oferta.');
  end if;

  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER')
     and not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para configurar colores en oferta.');
  end if;

  v_pct := round(greatest(1, least(80, coalesce(p_porcentaje_descuento, 10))), 2);

  if jsonb_typeof(coalesce(p_colores, '[]'::jsonb)) = 'array' then
    for v_item in select jsonb_array_elements_text(coalesce(p_colores, '[]'::jsonb)) loop
      v_clave := lower(btrim(coalesce(v_item, '')));
      if v_clave = 'azul' then
        v_clave := 'tinturado';
      elsif v_clave = 'rosa' then
        v_clave := 'rosado';
      elsif v_clave in ('lila', 'morado') then
        v_clave := 'lavanda';
      end if;

      if v_clave <> ''
         and v_clave not like 'orquidea_%'
         and v_clave not in ('multicolor', 'surtido', 'mix')
         and not (v_clave = any(v_colores_limpios)) then
        v_colores_limpios := array_append(v_colores_limpios, v_clave);
      end if;
    end loop;
  end if;

  select coalesce(
           nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
           u.usu_correo,
           'Equipo'
         )
    into v_autor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_oferta := jsonb_build_object(
    'activo', coalesce(p_activo, false) and coalesce(array_length(v_colores_limpios, 1), 0) > 0,
    'porcentajeDescuento', v_pct,
    'colores', to_jsonb(coalesce(v_colores_limpios, array[]::text[])),
    'actualizadoEn', now(),
    'actualizadoPor', coalesce(v_autor, 'Equipo')
  );

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion =
           coalesce(cfg_detalle_configuracion, '{}'::jsonb)
           || jsonb_build_object('colores_rosas_oferta', v_oferta),
         cfg_actualizado_en = now()
   where cfg_negocio = v_negocio;

  if not found then
    insert into comun_configuracion.cfg_negocio (
      cfg_negocio,
      cfg_nombre_comercial,
      cfg_detalle_configuracion
    ) values (
      v_negocio,
      initcap(v_negocio),
      jsonb_build_object('colores_rosas_oferta', v_oferta)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'oferta', v_oferta
  );
end;
$$;

revoke all on function comun_comercio.com_fn_guardar_colores_oferta_inventario(text, boolean, numeric, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_colores_oferta_inventario(text, boolean, numeric, jsonb) to authenticated, service_role;

-- 2. Actualizar RPC pública de tienda para incluir colores en oferta y % de descuento
create or replace function comun_comercio.com_fn_obtener_colores_inventario_tienda(
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_corte record;
  v_tiene_inventario boolean := false;
  v_fecha_corte timestamptz := null;
  v_colores_en_stock text[] := array[]::text[];
  v_orquideas_en_stock text[] := array[]::text[];
  v_colores_catalogo text[] := array[]::text[];
  v_categorias_colores jsonb := '{}'::jsonb;
  v_oferta_raw jsonb := '{}'::jsonb;
  v_oferta_activa boolean := false;
  v_oferta_pct numeric := 10;
  v_colores_oferta text[] := array[]::text[];
  v_par record;
  v_cant numeric;
  v_clave text;
  v_clave_orq text;
  v_item_oferta text;
begin
  select c.icr_fecha_corte, c.icr_resumen_colores
    into v_corte
    from comun_comercio.com_inventario_corte c
   where c.icr_negocio = v_negocio
     and c.icr_eliminado_en is null
   order by c.icr_fecha_corte desc
   limit 1;

  if found then
    v_tiene_inventario := true;
    v_fecha_corte := v_corte.icr_fecha_corte;

    for v_par in
      select key, value
        from jsonb_each_text(coalesce(v_corte.icr_resumen_colores, '{}'::jsonb))
    loop
      begin
        v_cant := coalesce(nullif(btrim(v_par.value), '')::numeric, 0);
      exception when others then
        v_cant := 0;
      end;

      if v_cant > 0 then
        v_clave := lower(btrim(coalesce(v_par.key, '')));
        if v_clave like 'orquidea_%' then
          v_clave_orq := btrim(substring(v_clave from 10));
          if v_clave_orq <> '' and not (v_clave_orq = any(v_orquideas_en_stock)) then
            v_orquideas_en_stock := array_append(v_orquideas_en_stock, v_clave_orq);
          end if;
        else
          if v_clave = 'azul' then
            v_clave := 'tinturado';
          elsif v_clave = 'rosa' then
            v_clave := 'rosado';
          elsif v_clave in ('lila', 'morado') then
            v_clave := 'lavanda';
          end if;

          if v_clave <> ''
             and v_clave not in ('multicolor', 'surtido', 'mix')
             and not (v_clave = any(v_colores_en_stock)) then
            v_colores_en_stock := array_append(v_colores_en_stock, v_clave);
          end if;
        end if;
      end if;
    end loop;
  else
    if exists (
      select 1
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') = 'BONCHE_ROSAS'
    ) then
      v_tiene_inventario := true;

      select max(inv.inv_actualizado_en)
        into v_fecha_corte
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') = 'BONCHE_ROSAS';

      select coalesce(
        array_agg(distinct
          case
            when lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) = 'azul' then 'tinturado'
            when lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) = 'rosa' then 'rosado'
            when lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) in ('lila', 'morado') then 'lavanda'
            else lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', '')))
          end
        ),
        array[]::text[]
      )
        into v_colores_en_stock
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') = 'BONCHE_ROSAS'
         and coalesce(inv.inv_stock_actual, 0) > 0
         and lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) not in ('', 'multicolor', 'surtido', 'mix')
         and lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) not like 'orquidea_%';
    end if;
  end if;

  select coalesce(
    array_agg(distinct lower(btrim(v.vro_color_clave)) order by lower(btrim(v.vro_color_clave))),
    array[]::text[]
  )
    into v_colores_catalogo
    from comun_comercio.com_variedad_rosa v
   where v.vro_negocio = v_negocio
     and v.vro_activo = true
     and v.vro_eliminado_en is null
     and lower(btrim(coalesce(v.vro_color_clave, ''))) not in ('', 'multicolor', 'surtido', 'mix');

  select coalesce(n.cfg_detalle_configuracion->'categorias_colores_rosas', '{}'::jsonb),
         coalesce(n.cfg_detalle_configuracion->'colores_rosas_oferta', '{}'::jsonb)
    into v_categorias_colores, v_oferta_raw
    from comun_configuracion.cfg_negocio n
   where n.cfg_negocio = v_negocio
   limit 1;

  if jsonb_typeof(v_oferta_raw) = 'object' then
    begin
      v_oferta_pct := round(
        greatest(
          0,
          least(80, coalesce(nullif(btrim(coalesce(v_oferta_raw->>'porcentajeDescuento', '')), '')::numeric, 10))
        ),
        2
      );
    exception when others then
      v_oferta_pct := 10;
    end;

    if jsonb_typeof(coalesce(v_oferta_raw->'colores', '[]'::jsonb)) = 'array' then
      for v_item_oferta in select jsonb_array_elements_text(coalesce(v_oferta_raw->'colores', '[]'::jsonb)) loop
        v_clave := lower(btrim(coalesce(v_item_oferta, '')));
        if v_clave = 'azul' then
          v_clave := 'tinturado';
        elsif v_clave = 'rosa' then
          v_clave := 'rosado';
        elsif v_clave in ('lila', 'morado') then
          v_clave := 'lavanda';
        end if;
        if v_clave <> ''
           and v_clave not like 'orquidea_%'
           and v_clave not in ('multicolor', 'surtido', 'mix')
           and not (v_clave = any(v_colores_oferta)) then
          v_colores_oferta := array_append(v_colores_oferta, v_clave);
        end if;
      end loop;
    end if;

    v_oferta_activa :=
      coalesce((v_oferta_raw->>'activo')::boolean, false)
      and v_oferta_pct > 0
      and coalesce(array_length(v_colores_oferta, 1), 0) > 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'tieneInventarioRegistrado', v_tiene_inventario,
    'fechaUltimoCorte', v_fecha_corte,
    'coloresEnStock', to_jsonb(coalesce(v_colores_en_stock, array[]::text[])),
    'orquideasEnStock', to_jsonb(coalesce(v_orquideas_en_stock, array[]::text[])),
    'coloresCatalogo', to_jsonb(coalesce(v_colores_catalogo, array[]::text[])),
    'categoriasColores', coalesce(v_categorias_colores, '{}'::jsonb),
    'ofertaColoresActiva', v_oferta_activa,
    'porcentajeDescuentoOferta', v_oferta_pct,
    'coloresEnOferta', to_jsonb(coalesce(v_colores_oferta, array[]::text[]))
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) from public;
grant execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) to anon, authenticated, service_role;

-- 3. RPC: Verificar si pasaron >= 15 horas sin inventario de rosas y emitir alerta IN_APP + contexto Push al equipo
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
  v_codigo_corto text := comun_seguridad.seg_fn_codigo_notificacion_negocio(v_negocio);
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

-- 4. Red de seguridad automática con pg_cron (cada hora revisa si pasaron >= 15h sin inventario)
do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for v_job_id in
      select jobid from cron.job where jobname = 'alerta-inventario-rosas-15h'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'alerta-inventario-rosas-15h',
      '0 * * * *',
      $cron$select comun_comercio.com_fn_verificar_y_alertar_inventario_rosas('tinkay', 15, 6, false); select comun_comercio.com_fn_verificar_y_alertar_inventario_rosas('margaritas', 15, 6, false);$cron$
    );
  end if;
exception when others then
  null;
end $$;
