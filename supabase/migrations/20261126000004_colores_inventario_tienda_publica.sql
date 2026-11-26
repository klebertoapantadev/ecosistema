-- =============================================================================
-- Migración: 20261126000004_colores_inventario_tienda_publica.sql
-- Requerimientos: TNK-002 / TNK-005 / PLT-009
-- Descripción:
--   Expone una RPC pública de solo lectura (sin datos sensibles ni cantidades
--   internas) que devuelve los colores de rosas actualmente disponibles en el
--   último corte de inventario del negocio (`com_inventario_corte`) junto con
--   las categorías activas del catálogo de variedades (`com_variedad_rosa`) y
--   etiquetas personalizadas (`cfg_negocio.categorias_colores_rosas`), para que
--   la tienda web muestre disponibilidad real y advierta "Bajo confirmación" en
--   colores que no están actualmente en inventario.
-- =============================================================================

grant usage on schema comun_comercio to anon, authenticated, service_role;

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
  v_par record;
  v_cant numeric;
  v_clave text;
  v_clave_orq text;
begin
  -- 1. Fuente principal: último corte fotográfico/manual consolidado del taller
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
          -- Normalizar alias heredados hacia claves canónicas del inventario
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
    -- 2. Respaldo si aún no hay cortes en com_inventario_corte: leer com_inventario (BONCHE_ROSAS)
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

  -- 3. Categorías de color activas registradas en el catálogo de variedades de rosas
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

  -- 4. Etiquetas / colores personalizados configurados por el negocio (si existen)
  select coalesce(n.cfg_detalle_configuracion->'categorias_colores_rosas', '{}'::jsonb)
    into v_categorias_colores
    from comun_configuracion.cfg_negocio n
   where n.cfg_negocio = v_negocio
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'negocio', v_negocio,
    'tieneInventarioRegistrado', v_tiene_inventario,
    'fechaUltimoCorte', v_fecha_corte,
    'coloresEnStock', to_jsonb(coalesce(v_colores_en_stock, array[]::text[])),
    'orquideasEnStock', to_jsonb(coalesce(v_orquideas_en_stock, array[]::text[])),
    'coloresCatalogo', to_jsonb(coalesce(v_colores_catalogo, array[]::text[])),
    'categoriasColores', coalesce(v_categorias_colores, '{}'::jsonb)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) from public;
grant execute on function comun_comercio.com_fn_obtener_colores_inventario_tienda(text) to anon, authenticated, service_role;
