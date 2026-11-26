-- =============================================================================
-- Migración: 20261126000007_inventario_girasoles_orquideas_y_descuento_por_color.sql
-- Requerimientos: TNK-002 / TNK-005 / PLT-009
-- Descripción:
--   1. Actualiza `com_fn_guardar_corte_inventario_rosas` para registrar rosas
--      (bonches), girasoles (unidades) y orquídeas por color (`blanco`, `beige`,
--      `verde`, `amarilla`, `lila` en unidades/flores), manteniendo `icr_total_paquetes`
--      preciso para bonches de rosas.
--   2. Actualiza `com_fn_guardar_colores_oferta_inventario` para soportar:
--      - Porcentaje de descuento individual por cada color/flor (`descuentosPorColor`)
--      - Ofertas en rosas por color, `girasol` y `orquidea_<color>`
--   3. Actualiza `com_fn_obtener_colores_inventario_tienda` para exponer:
--      - `girasolesEnStock`, `orquideasEnStock`, `orquideasUnidadesPorColor`
--      - `descuentosPorColor` (mapa `{ [clave]: porcentaje }`) y `coloresEnOferta`
--        incluyendo rosas, girasoles y orquídeas.
-- =============================================================================

-- 1. Guardar corte de inventario soportando rosas (bonches), girasoles (unid.) y orquídeas (unid. por color)
create or replace function comun_comercio.com_fn_guardar_corte_inventario_rosas(
  p_negocio text,
  p_resumen_colores jsonb,
  p_fotos jsonb default '[]'::jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_autor text;
  v_total_rosas integer := 0;
  v_par record;
  v_cant integer;
  v_clave_norm text;
  v_color_orq text;
  v_codigo_insumo text;
  v_nombre_insumo text;
  v_unidad_medida text;
  v_categoria_op text;
  v_tallos_ref integer;
  v_corte comun_comercio.com_inventario_corte;
  v_insumo_id uuid;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio)
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar cortes de inventario.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Taller')
    into v_autor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  for v_par in select key, value from jsonb_each_text(coalesce(p_resumen_colores, '{}'::jsonb)) loop
    begin
      v_cant := greatest(0, coalesce(round(v_par.value::numeric)::integer, 0));
    exception when others then
      v_cant := 0;
    end;

    v_clave_norm := lower(btrim(coalesce(v_par.key, '')));
    if v_clave_norm = '' then
      continue;
    end if;

    if v_clave_norm in ('girasol', 'girasoles') then
      v_codigo_insumo := 'FLOR_GIRASOL';
      v_nombre_insumo := 'Girasoles (Unidades)';
      v_unidad_medida := 'UNIDAD';
      v_categoria_op := 'GIRASOLES';
      v_tallos_ref := 1;
    elsif v_clave_norm like 'orquidea_%' then
      v_color_orq := btrim(substring(v_clave_norm from 10));
      if v_color_orq = 'amarillo' then
        v_color_orq := 'amarilla';
      elsif v_color_orq in ('crema', 'champagne') then
        v_color_orq := 'beige';
      elsif v_color_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then
        v_color_orq := 'lila';
      end if;
      v_codigo_insumo := 'FLOR_ORQUIDEA_' || upper(regexp_replace(v_color_orq, '[^a-zA-Z0-9]+', '_', 'g'));
      v_nombre_insumo := 'Orquídeas (' || initcap(replace(v_color_orq, '_', ' ')) || ')';
      v_unidad_medida := 'UNIDAD';
      v_categoria_op := 'ORQUIDEAS';
      v_tallos_ref := 1;
    else
      v_total_rosas := v_total_rosas + v_cant;
      v_codigo_insumo := 'BONCHE_ROSA_' || upper(regexp_replace(v_clave_norm, '[^a-zA-Z0-9]+', '_', 'g'));
      v_nombre_insumo := 'Bonche de Rosas (' || initcap(replace(v_clave_norm, '_', ' ')) || ')';
      v_unidad_medida := 'UNIDAD';
      v_categoria_op := 'BONCHE_ROSAS';
      v_tallos_ref := 25;
    end if;

    insert into comun_comercio.com_insumo (
      ins_negocio, ins_codigo, ins_nombre, ins_unidad_medida, ins_activo, ins_detalle_insumo
    ) values (
      v_negocio,
      v_codigo_insumo,
      v_nombre_insumo,
      v_unidad_medida,
      true,
      jsonb_build_object(
        'categoria_operativa', v_categoria_op,
        'color_clave', v_clave_norm,
        'tallos_referencia', v_tallos_ref
      )
    )
    on conflict (ins_negocio, ins_codigo) do update set
      ins_nombre = excluded.ins_nombre,
      ins_activo = true,
      ins_detalle_insumo = coalesce(comun_comercio.com_insumo.ins_detalle_insumo, '{}'::jsonb) || excluded.ins_detalle_insumo,
      ins_actualizado_en = now()
    returning ins_id into v_insumo_id;

    insert into comun_comercio.com_inventario (
      inv_negocio, inv_insumo_id, inv_local_codigo, inv_stock_actual, inv_actualizado_en
    ) values (
      v_negocio, v_insumo_id, 'MATRIZ', v_cant, now()
    )
    on conflict (inv_negocio, inv_insumo_id, inv_local_codigo) do update set
      inv_stock_actual = excluded.inv_stock_actual,
      inv_actualizado_en = now();

    insert into comun_comercio.com_kardex (
      kar_negocio, kar_insumo_id, kar_local_codigo, kar_tipo_movimiento, kar_cantidad, kar_costo_unitario, kar_observacion, kar_registrado_por
    ) values (
      v_negocio, v_insumo_id, 'MATRIZ', 'AJUSTE_INVENTARIO', v_cant, 0, 'Corte fotográfico/manual de inventario floral', v_uid
    );
  end loop;

  insert into comun_comercio.com_inventario_corte (
    icr_negocio,
    icr_local_codigo,
    icr_fecha_corte,
    icr_registrado_por,
    icr_registrado_nombre,
    icr_total_paquetes,
    icr_resumen_colores,
    icr_observaciones,
    icr_detalle_corte
  ) values (
    v_negocio,
    'MATRIZ',
    now(),
    v_uid,
    coalesce(v_autor, 'Taller'),
    v_total_rosas,
    coalesce(p_resumen_colores, '{}'::jsonb),
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    jsonb_build_object(
      'fotos', coalesce(p_fotos, '[]'::jsonb),
      'origen', 'CONTEO_IA_ARIA_CONSOLIDADO'
    )
  )
  returning * into v_corte;

  return jsonb_build_object(
    'ok', true,
    'corte', jsonb_build_object(
      'id', v_corte.icr_id,
      'secuencial', v_corte.icr_secuencial,
      'negocio', v_corte.icr_negocio,
      'localCodigo', v_corte.icr_local_codigo,
      'fechaCorte', v_corte.icr_fecha_corte,
      'registradoPor', v_corte.icr_registrado_por,
      'registradoNombre', v_corte.icr_registrado_nombre,
      'totalPaquetes', v_corte.icr_total_paquetes,
      'resumenColores', v_corte.icr_resumen_colores,
      'observaciones', v_corte.icr_observaciones,
      'fotos', coalesce(v_corte.icr_detalle_corte->'fotos', '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_corte_inventario_rosas(text, jsonb, jsonb, text) from public;
grant execute on function comun_comercio.com_fn_guardar_corte_inventario_rosas(text, jsonb, jsonb, text) to authenticated, service_role;

-- 2. Guardar configuración de ofertas por color (rosas), girasoles y orquídeas con % individual por clave
create or replace function comun_comercio.com_fn_guardar_ofertas_inventario(
  p_negocio text,
  p_activo boolean default true,
  p_porcentaje_descuento numeric default 10,
  p_colores jsonb default '[]'::jsonb,
  p_descuentos_por_color jsonb default '{}'::jsonb
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
  v_pct_defecto numeric;
  v_colores_limpios text[] := array[]::text[];
  v_descuentos_limpios jsonb := '{}'::jsonb;
  v_item text;
  v_par record;
  v_clave text;
  v_color_orq text;
  v_pct_item numeric;
  v_oferta jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para configurar colores y flores en oferta.');
  end if;

  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER')
     and not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para configurar colores y flores en oferta.');
  end if;

  v_pct_defecto := round(greatest(1, least(80, coalesce(p_porcentaje_descuento, 10))), 2);

  -- 2a. Procesar mapa individual descuentosPorColor (prioritario)
  if jsonb_typeof(coalesce(p_descuentos_por_color, '{}'::jsonb)) = 'object' then
    for v_par in select key, value from jsonb_each_text(coalesce(p_descuentos_por_color, '{}'::jsonb)) loop
      v_clave := lower(btrim(coalesce(v_par.key, '')));
      if v_clave in ('girasoles', 'girasol') then
        v_clave := 'girasol';
      elsif v_clave like 'orquidea_%' then
        v_color_orq := btrim(substring(v_clave from 10));
        if v_color_orq = 'amarillo' then
          v_color_orq := 'amarilla';
        elsif v_color_orq in ('crema', 'champagne') then
          v_color_orq := 'beige';
        elsif v_color_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then
          v_color_orq := 'lila';
        end if;
        v_clave := case when v_color_orq <> '' then 'orquidea_' || v_color_orq else '' end;
      elsif v_clave = 'azul' then
        v_clave := 'tinturado';
      elsif v_clave = 'rosa' then
        v_clave := 'rosado';
      elsif v_clave in ('lila', 'morado') then
        v_clave := 'lavanda';
      end if;

      begin
        v_pct_item := round(greatest(0, least(80, coalesce(nullif(btrim(v_par.value), '')::numeric, 0))), 2);
      exception when others then
        v_pct_item := 0;
      end;

      if v_clave <> ''
         and v_clave not in ('multicolor', 'surtido', 'mix')
         and v_pct_item > 0 then
        v_descuentos_limpios := v_descuentos_limpios || jsonb_build_object(v_clave, v_pct_item);
        if not (v_clave = any(v_colores_limpios)) then
          v_colores_limpios := array_append(v_colores_limpios, v_clave);
        end if;
      end if;
    end loop;
  end if;

  -- 2b. Completar con cualquier clave en p_colores usando el porcentaje por defecto
  if jsonb_typeof(coalesce(p_colores, '[]'::jsonb)) = 'array' then
    for v_item in select jsonb_array_elements_text(coalesce(p_colores, '[]'::jsonb)) loop
      v_clave := lower(btrim(coalesce(v_item, '')));
      if v_clave in ('girasoles', 'girasol') then
        v_clave := 'girasol';
      elsif v_clave like 'orquidea_%' then
        v_color_orq := btrim(substring(v_clave from 10));
        if v_color_orq = 'amarillo' then
          v_color_orq := 'amarilla';
        elsif v_color_orq in ('crema', 'champagne') then
          v_color_orq := 'beige';
        elsif v_color_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then
          v_color_orq := 'lila';
        end if;
        v_clave := case when v_color_orq <> '' then 'orquidea_' || v_color_orq else '' end;
      elsif v_clave = 'azul' then
        v_clave := 'tinturado';
      elsif v_clave = 'rosa' then
        v_clave := 'rosado';
      elsif v_clave in ('lila', 'morado') then
        v_clave := 'lavanda';
      end if;

      if v_clave <> ''
         and v_clave not in ('multicolor', 'surtido', 'mix') then
        if not (v_clave = any(v_colores_limpios)) then
          v_colores_limpios := array_append(v_colores_limpios, v_clave);
        end if;
        if not (v_descuentos_limpios ? v_clave) then
          v_descuentos_limpios := v_descuentos_limpios || jsonb_build_object(v_clave, v_pct_defecto);
        end if;
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
    'porcentajeDescuento', v_pct_defecto,
    'colores', to_jsonb(coalesce(v_colores_limpios, array[]::text[])),
    'descuentosPorColor', v_descuentos_limpios,
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

revoke all on function comun_comercio.com_fn_guardar_ofertas_inventario(text, boolean, numeric, jsonb, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_ofertas_inventario(text, boolean, numeric, jsonb, jsonb) to authenticated, service_role;

-- Wrapper retrocompatible de 4 argumentos
create or replace function comun_comercio.com_fn_guardar_colores_oferta_inventario(
  p_negocio text,
  p_activo boolean default true,
  p_porcentaje_descuento numeric default 10,
  p_colores jsonb default '[]'::jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_guardar_ofertas_inventario(
    p_negocio,
    p_activo,
    p_porcentaje_descuento,
    p_colores,
    '{}'::jsonb
  );
$$;

revoke all on function comun_comercio.com_fn_guardar_colores_oferta_inventario(text, boolean, numeric, jsonb) from public, anon;
grant execute on function comun_comercio.com_fn_guardar_colores_oferta_inventario(text, boolean, numeric, jsonb) to authenticated, service_role;

-- 3. Actualizar RPC pública de tienda para exponer girasoles, orquídeas (unidades por color) y descuentos por color/flor
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
  v_girasoles_en_stock integer := 0;
  v_orquideas_en_stock text[] := array[]::text[];
  v_orquideas_unidades jsonb := '{}'::jsonb;
  v_colores_catalogo text[] := array[]::text[];
  v_categorias_colores jsonb := '{}'::jsonb;
  v_oferta_raw jsonb := '{}'::jsonb;
  v_oferta_activa boolean := false;
  v_oferta_pct numeric := 10;
  v_colores_oferta text[] := array[]::text[];
  v_descuentos_por_color jsonb := '{}'::jsonb;
  v_par record;
  v_cant numeric;
  v_clave text;
  v_clave_orq text;
  v_prev_orq integer;
  v_item_oferta text;
  v_pct_item numeric;
  v_foto jsonb;
  v_item_var jsonb;
  v_flores_foto integer;
  v_orq_fotos_unidades jsonb := '{}'::jsonb;
begin
  select c.icr_fecha_corte, c.icr_resumen_colores, c.icr_detalle_corte
    into v_corte
    from comun_comercio.com_inventario_corte c
   where c.icr_negocio = v_negocio
     and c.icr_eliminado_en is null
   order by c.icr_fecha_corte desc
   limit 1;

  if found then
    v_tiene_inventario := true;
    v_fecha_corte := v_corte.icr_fecha_corte;

    -- Leer numeroFlores exacto de orquídeas desde detalle_corte->fotos si existe
    if jsonb_typeof(coalesce(v_corte.icr_detalle_corte->'fotos', '[]'::jsonb)) = 'array' then
      for v_foto in select jsonb_array_elements(coalesce(v_corte.icr_detalle_corte->'fotos', '[]'::jsonb)) loop
        if jsonb_typeof(coalesce(v_foto->'itemsVariedad', '[]'::jsonb)) = 'array' then
          for v_item_var in select jsonb_array_elements(coalesce(v_foto->'itemsVariedad', '[]'::jsonb)) loop
            if lower(coalesce(v_item_var->>'tipoFlor', '')) = 'orquidea' then
              v_clave_orq := lower(btrim(coalesce(v_item_var->>'colorClave', '')));
              if v_clave_orq = 'amarillo' then v_clave_orq := 'amarilla';
              elsif v_clave_orq in ('crema', 'champagne') then v_clave_orq := 'beige';
              elsif v_clave_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then v_clave_orq := 'lila';
              end if;
              begin
                v_flores_foto := greatest(
                  0,
                  coalesce(
                    nullif(btrim(coalesce(v_item_var->>'numeroFlores', '')), '')::integer,
                    nullif(btrim(coalesce(v_item_var->>'cantidad', '')), '')::integer,
                    0
                  )
                );
              exception when others then
                v_flores_foto := 0;
              end;
              if v_clave_orq <> '' and v_flores_foto > 0 then
                v_prev_orq := coalesce((v_orq_fotos_unidades->>v_clave_orq)::integer, 0);
                v_orq_fotos_unidades := v_orq_fotos_unidades || jsonb_build_object(v_clave_orq, v_prev_orq + v_flores_foto);
              end if;
            end if;
          end loop;
        end if;
      end loop;
    end if;

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
        if v_clave in ('girasol', 'girasoles') then
          v_girasoles_en_stock := v_girasoles_en_stock + round(v_cant)::integer;
        elsif v_clave like 'orquidea_%' then
          v_clave_orq := btrim(substring(v_clave from 10));
          if v_clave_orq = 'amarillo' then
            v_clave_orq := 'amarilla';
          elsif v_clave_orq in ('crema', 'champagne') then
            v_clave_orq := 'beige';
          elsif v_clave_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then
            v_clave_orq := 'lila';
          end if;
          if v_clave_orq <> '' then
            if not (v_clave_orq = any(v_orquideas_en_stock)) then
              v_orquideas_en_stock := array_append(v_orquideas_en_stock, v_clave_orq);
            end if;
            v_prev_orq := coalesce((v_orquideas_unidades->>v_clave_orq)::integer, 0);
            v_orquideas_unidades := v_orquideas_unidades || jsonb_build_object(
              v_clave_orq,
              v_prev_orq + round(v_cant)::integer
            );
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

    -- Si las fotos tenían numeroFlores explícito por color de orquídea, prevalece ese conteo exacto de unidades
    if v_orq_fotos_unidades <> '{}'::jsonb then
      for v_par in select key, value from jsonb_each_text(v_orq_fotos_unidades) loop
        if not (v_par.key = any(v_orquideas_en_stock)) then
          v_orquideas_en_stock := array_append(v_orquideas_en_stock, v_par.key);
        end if;
        v_orquideas_unidades := v_orquideas_unidades || jsonb_build_object(v_par.key, (v_par.value)::integer);
      end loop;
    end if;
  else
    if exists (
      select 1
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') in ('BONCHE_ROSAS', 'GIRASOLES', 'ORQUIDEAS')
    ) then
      v_tiene_inventario := true;

      select max(inv.inv_actualizado_en)
        into v_fecha_corte
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') in ('BONCHE_ROSAS', 'GIRASOLES', 'ORQUIDEAS');

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
         and lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) not in ('', 'multicolor', 'surtido', 'mix', 'girasol', 'girasoles')
         and lower(btrim(coalesce(i.ins_detalle_insumo->>'color_clave', ''))) not like 'orquidea_%';

      select coalesce(sum(greatest(0, round(inv.inv_stock_actual)::integer)), 0)
        into v_girasoles_en_stock
        from comun_comercio.com_insumo i
        join comun_comercio.com_inventario inv on inv.inv_insumo_id = i.ins_id
       where i.ins_negocio = v_negocio
         and i.ins_activo = true
         and coalesce(i.ins_detalle_insumo->>'categoria_operativa', '') = 'GIRASOLES'
         and coalesce(inv.inv_stock_actual, 0) > 0;
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

    -- Leer mapa individual descuentosPorColor primero
    if jsonb_typeof(coalesce(v_oferta_raw->'descuentosPorColor', '{}'::jsonb)) = 'object' then
      for v_par in select key, value from jsonb_each_text(coalesce(v_oferta_raw->'descuentosPorColor', '{}'::jsonb)) loop
        v_clave := lower(btrim(coalesce(v_par.key, '')));
        if v_clave in ('girasoles', 'girasol') then
          v_clave := 'girasol';
        elsif v_clave like 'orquidea_%' then
          v_clave_orq := btrim(substring(v_clave from 10));
          if v_clave_orq = 'amarillo' then v_clave_orq := 'amarilla';
          elsif v_clave_orq in ('crema', 'champagne') then v_clave_orq := 'beige';
          elsif v_clave_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then v_clave_orq := 'lila';
          end if;
          v_clave := case when v_clave_orq <> '' then 'orquidea_' || v_clave_orq else '' end;
        elsif v_clave = 'azul' then
          v_clave := 'tinturado';
        elsif v_clave = 'rosa' then
          v_clave := 'rosado';
        elsif v_clave in ('lila', 'morado') then
          v_clave := 'lavanda';
        end if;

        begin
          v_pct_item := round(greatest(0, least(80, coalesce(nullif(btrim(v_par.value), '')::numeric, 0))), 2);
        exception when others then
          v_pct_item := 0;
        end;

        if v_clave <> '' and v_clave not in ('multicolor', 'surtido', 'mix') and v_pct_item > 0 then
          v_descuentos_por_color := v_descuentos_por_color || jsonb_build_object(v_clave, v_pct_item);
          if not (v_clave = any(v_colores_oferta)) then
            v_colores_oferta := array_append(v_colores_oferta, v_clave);
          end if;
        end if;
      end loop;
    end if;

    -- Retrocompatibilidad con lista plana `colores`
    if jsonb_typeof(coalesce(v_oferta_raw->'colores', '[]'::jsonb)) = 'array' then
      for v_item_oferta in select jsonb_array_elements_text(coalesce(v_oferta_raw->'colores', '[]'::jsonb)) loop
        v_clave := lower(btrim(coalesce(v_item_oferta, '')));
        if v_clave in ('girasoles', 'girasol') then
          v_clave := 'girasol';
        elsif v_clave like 'orquidea_%' then
          v_clave_orq := btrim(substring(v_clave from 10));
          if v_clave_orq = 'amarillo' then v_clave_orq := 'amarilla';
          elsif v_clave_orq in ('crema', 'champagne') then v_clave_orq := 'beige';
          elsif v_clave_orq in ('lavanda', 'morado', 'rosado', 'vino', 'bicolor') then v_clave_orq := 'lila';
          end if;
          v_clave := case when v_clave_orq <> '' then 'orquidea_' || v_clave_orq else '' end;
        elsif v_clave = 'azul' then
          v_clave := 'tinturado';
        elsif v_clave = 'rosa' then
          v_clave := 'rosado';
        elsif v_clave in ('lila', 'morado') then
          v_clave := 'lavanda';
        end if;

        if v_clave <> '' and v_clave not in ('multicolor', 'surtido', 'mix') then
          if not (v_clave = any(v_colores_oferta)) then
            v_colores_oferta := array_append(v_colores_oferta, v_clave);
          end if;
          if not (v_descuentos_por_color ? v_clave) and v_oferta_pct > 0 then
            v_descuentos_por_color := v_descuentos_por_color || jsonb_build_object(v_clave, v_oferta_pct);
          end if;
        end if;
      end loop;
    end if;

    v_oferta_activa :=
      coalesce((v_oferta_raw->>'activo')::boolean, false)
      and coalesce(array_length(v_colores_oferta, 1), 0) > 0
      and v_descuentos_por_color <> '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'tieneInventarioRegistrado', v_tiene_inventario,
    'fechaUltimoCorte', v_fecha_corte,
    'coloresEnStock', to_jsonb(coalesce(v_colores_en_stock, array[]::text[])),
    'girasolesEnStock', v_girasoles_en_stock,
    'orquideasEnStock', to_jsonb(coalesce(v_orquideas_en_stock, array[]::text[])),
    'orquideasUnidadesPorColor', v_orquideas_unidades,
    'coloresCatalogo', to_jsonb(coalesce(v_colores_catalogo, array[]::text[])),
    'categoriasColores', coalesce(v_categorias_colores, '{}'::jsonb),
    'ofertaColoresActiva', v_oferta_activa,
    'porcentajeDescuentoOferta', v_oferta_pct,
    'coloresEnOferta', to_jsonb(coalesce(v_colores_oferta, array[]::text[])),
    'descuentosPorColor', v_descuentos_por_color
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) from public;
grant execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) to anon, authenticated, service_role;
