-- ==============================================================================
-- Migración: RPC para Eliminar / Desactivar Variantes de Catálogo de Comercio
-- Fecha: 2026-10-29
-- Descripción:
--   1. com_fn_eliminar_variante_catalogo: Permite eliminar físicamente una variante
--      de com_variante o desactivarla lógicamente si posee integridad referencial (FK).
--   2. Actualización de com_fn_guardar_producto_catalogo para purgar de inmediato
--      en com_variante aquellas variantes eliminadas en el editor multivariante.
-- ==============================================================================

-- 1. Función RPC para eliminar una variante puntual
create or replace function comun_comercio.com_fn_eliminar_variante_catalogo(
  p_var_id uuid,
  p_pro_id uuid default null,
  p_negocio text default null
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_count int := 0;
  v_eliminado_fisico boolean := false;
begin
  if p_var_id is null then
    return jsonb_build_object('ok', false, 'error', 'Identificador de variante requerido');
  end if;

  -- 1. Intentar eliminación física de la variante
  begin
    delete from comun_comercio.com_variante
    where var_id = p_var_id
      and (p_pro_id is null or var_producto_id = p_pro_id)
      and (p_negocio is null or var_negocio = p_negocio);
    get diagnostics v_count = row_count;
    v_eliminado_fisico := (v_count > 0);
  exception when foreign_key_violation then
    -- 2. Si existen pedidos o registros vinculados, aplicar borrado lógico
    update comun_comercio.com_variante
    set var_activo = false,
        var_eliminado_en = now(),
        var_actualizado_en = now()
    where var_id = p_var_id
      and (p_pro_id is null or var_producto_id = p_pro_id)
      and (p_negocio is null or var_negocio = p_negocio);
    get diagnostics v_count = row_count;
    v_eliminado_fisico := false;
  end;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'No se encontró la variante a eliminar');
  end if;

  return jsonb_build_object(
    'ok', true,
    'var_id', p_var_id,
    'eliminado_fisico', v_eliminado_fisico,
    'mensaje', case when v_eliminado_fisico then 'Variante eliminada permanentemente' else 'Variante desactivada por historial de transacciones' end
  );
end;
$$;

grant execute on function comun_comercio.com_fn_eliminar_variante_catalogo(uuid, uuid, text) to anon, authenticated, service_role;

-- Wrapper en esquema public para acceso directo desde Supabase client
create or replace function public.com_fn_eliminar_variante_catalogo(
  p_var_id uuid,
  p_pro_id uuid default null,
  p_negocio text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  return comun_comercio.com_fn_eliminar_variante_catalogo(p_var_id, p_pro_id, p_negocio);
end;
$$;

grant execute on function public.com_fn_eliminar_variante_catalogo(uuid, uuid, text) to anon, authenticated, service_role;


-- 2. Actualizar com_fn_guardar_producto_catalogo para que purgue variantes omitidas
create or replace function comun_comercio.com_fn_guardar_producto_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_pro_id uuid;
  v_negocio text;
  v_nombre text;
  v_slug text;
  v_descripcion text;
  v_categoria_id uuid;
  v_tipo text;
  v_destacado boolean;
  v_pro_activo boolean;
  v_detalle_prod jsonb;
  v_variantes jsonb;
  v_var jsonb;
  v_var_id uuid;
  v_var_id_raw text;
  v_var_sku text;
  v_var_nombre text;
  v_var_precio numeric(12, 4);
  v_var_precio_comp numeric(12, 4);
  v_var_tarifa_iva numeric(5, 2);
  v_var_impuesto text;
  v_var_tipo_oferta text;
  v_var_activo boolean;
  v_var_detalle jsonb;
  v_target_pro_id_raw text;
  v_skus_enviados text[] := array[]::text[];
  v_ids_enviados uuid[] := array[]::uuid[];
begin
  -- Extraer campos del producto
  v_target_pro_id_raw := p_datos->>'pro_id';
  v_negocio       := lower(trim(coalesce(p_datos->>'negocio', 'tranqi')));
  v_nombre        := trim(coalesce(p_datos->>'nombre', ''));
  v_slug          := trim(coalesce(p_datos->>'slug', ''));
  v_descripcion   := coalesce(p_datos->>'descripcion', '');
  v_tipo          := upper(coalesce(p_datos->>'tipo', 'FISICO'));
  v_destacado     := coalesce((p_datos->>'destacado')::boolean, false);
  v_pro_activo    := coalesce((p_datos->>'pro_activo')::boolean, true);
  v_detalle_prod  := coalesce(p_datos->'detalle_producto', '{}'::jsonb);
  v_variantes     := coalesce(p_datos->'variantes', '[]'::jsonb);

  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre del producto es obligatorio');
  end if;

  if p_datos->>'categoria_id' is not null and (p_datos->>'categoria_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_categoria_id := (p_datos->>'categoria_id')::uuid;
  else
    v_categoria_id := null;
  end if;

  -- 1. Insertar o actualizar el producto maestro
  if v_target_pro_id_raw is not null and v_target_pro_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_pro_id := v_target_pro_id_raw::uuid;

    update comun_comercio.com_producto
    set
      pro_nombre = v_nombre,
      pro_descripcion = v_descripcion,
      pro_tipo = v_tipo,
      pro_destacado = v_destacado,
      pro_categoria_principal_id = coalesce(v_categoria_id, pro_categoria_principal_id),
      pro_detalle_producto = v_detalle_prod,
      pro_activo = v_pro_activo,
      pro_actualizado_en = now()
    where pro_id = v_pro_id;
  else
    if v_slug = '' then
      v_slug := lower(regexp_replace(v_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
      v_slug := trim(both '-' from v_slug);
      v_slug := v_negocio || '-' || v_slug;
    end if;

    insert into comun_comercio.com_producto (
      pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo,
      pro_destacado, pro_categoria_principal_id, pro_activo, pro_detalle_producto
    ) values (
      v_negocio, v_nombre, v_slug, v_descripcion, v_tipo,
      v_destacado, v_categoria_id, v_pro_activo, v_detalle_prod
    )
    on conflict (pro_negocio, pro_slug) do update set
      pro_nombre = excluded.pro_nombre,
      pro_descripcion = excluded.pro_descripcion,
      pro_tipo = excluded.pro_tipo,
      pro_destacado = excluded.pro_destacado,
      pro_categoria_principal_id = coalesce(excluded.pro_categoria_principal_id, comun_comercio.com_producto.pro_categoria_principal_id),
      pro_detalle_producto = excluded.pro_detalle_producto,
      pro_activo = excluded.pro_activo,
      pro_actualizado_en = now()
    returning pro_id into v_pro_id;
  end if;

  -- 2. Procesar y persistir cada variante / tamaño
  for v_var in select * from jsonb_array_elements(v_variantes)
  loop
    v_var_id_raw := v_var->>'var_id';
    if v_var_id_raw is not null and v_var_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_var_id := v_var_id_raw::uuid;
      v_ids_enviados := array_append(v_ids_enviados, v_var_id);
    else
      v_var_id := null;
    end if;

    v_var_sku := trim(v_var->>'var_sku');
    if v_var_sku is null or v_var_sku = '' then
      v_var_sku := upper(substring(v_negocio from 1 for 3)) || '-VAR-' || to_char(now(), 'YYMMDDHH24MISSMS');
    end if;
    v_skus_enviados := array_append(v_skus_enviados, v_var_sku);

    v_var_nombre := coalesce(trim(v_var->>'var_nombre'), 'Variante');
    v_var_precio := coalesce((v_var->>'var_precio')::numeric, 0.0);
    
    if (v_var->>'var_precio_comparacion') is not null and (v_var->>'var_precio_comparacion') <> '' then
      v_var_precio_comp := (v_var->>'var_precio_comparacion')::numeric;
    else
      v_var_precio_comp := null;
    end if;

    v_var_tarifa_iva := coalesce((v_var->>'var_tarifa_iva_porcentaje')::numeric, 15.00);
    v_var_impuesto := coalesce(v_var->>'var_codigo_impuesto_sri', case when v_var_tarifa_iva > 0 then 'IVA_15' else 'IVA_0' end);
    v_var_tipo_oferta := coalesce(v_var->>'var_tipo_oferta', 'REGULAR');
    v_var_activo := coalesce((v_var->>'var_activo')::boolean, true);
    v_var_detalle := coalesce(v_var->'var_detalle_variante', '{}'::jsonb);

    if v_var_id is not null and exists (select 1 from comun_comercio.com_variante where var_id = v_var_id) then
      update comun_comercio.com_variante
      set
        var_producto_id = v_pro_id,
        var_sku = v_var_sku,
        var_nombre = v_var_nombre,
        var_precio = v_var_precio,
        var_precio_comparacion = v_var_precio_comp,
        var_codigo_impuesto_sri = v_var_impuesto,
        var_tarifa_iva_porcentaje = v_var_tarifa_iva,
        var_tipo_oferta = v_var_tipo_oferta,
        var_activo = v_var_activo,
        var_detalle_variante = v_var_detalle,
        var_actualizado_en = now()
      where var_id = v_var_id;
    else
      insert into comun_comercio.com_variante (
        var_producto_id, var_negocio, var_sku, var_nombre, var_precio,
        var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje,
        var_tipo_oferta, var_activo, var_detalle_variante
      ) values (
        v_pro_id, v_negocio, v_var_sku, v_var_nombre, v_var_precio,
        v_var_precio_comp, v_var_impuesto, v_var_tarifa_iva,
        v_var_tipo_oferta, v_var_activo, v_var_detalle
      )
      on conflict (var_negocio, var_sku) do update set
        var_producto_id = excluded.var_producto_id,
        var_nombre = excluded.var_nombre,
        var_precio = excluded.var_precio,
        var_precio_comparacion = excluded.var_precio_comparacion,
        var_codigo_impuesto_sri = excluded.var_codigo_impuesto_sri,
        var_tarifa_iva_porcentaje = excluded.var_tarifa_iva_porcentaje,
        var_tipo_oferta = excluded.var_tipo_oferta,
        var_activo = excluded.var_activo,
        var_detalle_variante = excluded.var_detalle_variante,
        var_actualizado_en = now();
    end if;
  end loop;

  -- 3. Purgar variantes antiguas de este producto que fueron eliminadas en el editor
  if jsonb_array_length(v_variantes) > 0 then
    begin
      delete from comun_comercio.com_variante
      where var_producto_id = v_pro_id
        and (cardinality(v_ids_enviados) = 0 or var_id != all(v_ids_enviados))
        and (cardinality(v_skus_enviados) = 0 or var_sku != all(v_skus_enviados));
    exception when foreign_key_violation then
      update comun_comercio.com_variante
      set var_activo = false,
          var_eliminado_en = now()
      where var_producto_id = v_pro_id
        and (cardinality(v_ids_enviados) = 0 or var_id != all(v_ids_enviados))
        and (cardinality(v_skus_enviados) = 0 or var_sku != all(v_skus_enviados));
    end;
  end if;

  return jsonb_build_object('ok', true, 'pro_id', v_pro_id);
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_producto_catalogo(jsonb) to anon, authenticated, service_role;

create or replace function public.com_fn_guardar_producto_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
as $$
begin
  return comun_comercio.com_fn_guardar_producto_catalogo(p_datos);
end;
$$;

grant execute on function public.com_fn_guardar_producto_catalogo(jsonb) to anon, authenticated, service_role;
