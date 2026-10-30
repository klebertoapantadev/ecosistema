-- ==============================================================================
-- Migración: 20261025000001_comun_comercio_eliminar_categoria_rpc.sql
-- Módulo: comun_comercio
-- Propósito: RPC transaccional com_fn_eliminar_categoria_catalogo con control
--            estricto de integridad: si la categoría está asignada como categoría
--            principal a productos activos o tiene subcategorías, bloquea la
--            eliminación con detalle exacto de productos en uso;
--            si no está en uso principal, limpia relaciones secundarias en
--            com_producto_categoria y efectúa baja segura.
-- ==============================================================================

-- 1. Función RPC para verificar uso y eliminar categoría de forma segura
create or replace function comun_comercio.com_fn_eliminar_categoria_catalogo(
  p_categoria_id text,
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := coalesce(lower(trim(p_negocio)), 'tinkay');
  v_ctg_id uuid;
  v_cat_record record;
  v_conteo_principales int := 0;
  v_conteo_hijas int := 0;
  v_total_en_uso int := 0;
  v_nombres_ejemplo text[];
begin
  if p_categoria_id is null or trim(p_categoria_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'El identificador de la categoría es obligatorio.');
  end if;

  -- 1. Identificar la categoría por UUID o por slug dentro del negocio
  if p_categoria_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_cat_record
    from comun_comercio.com_categoria
    where ctg_id = p_categoria_id::uuid
      and ctg_eliminado_en is null;
  else
    select * into v_cat_record
    from comun_comercio.com_categoria
    where (ctg_slug = trim(p_categoria_id) or ctg_id::text = trim(p_categoria_id))
      and ctg_negocio = v_negocio
      and ctg_eliminado_en is null
    limit 1;
  end if;

  if v_cat_record is null or v_cat_record.ctg_id is null then
    return jsonb_build_object(
      'ok', true,
      'en_uso', false,
      'mensaje', 'La categoría no existe en la base de datos o ya ha sido eliminada previamente.'
    );
  end if;

  v_ctg_id := v_cat_record.ctg_id;

  -- 2. Verificar uso como categoría principal en com_producto (solo productos activos no eliminados)
  --    o como principal en com_producto_categoria cuando no tenga otra categoría asignada
  select count(distinct p.pro_id), array_agg(distinct p.pro_nombre) filter (where p.pro_nombre is not null)
  into v_conteo_principales, v_nombres_ejemplo
  from comun_comercio.com_producto p
  where (
    p.pro_categoria_principal_id = v_ctg_id 
    or (p.pro_detalle_producto->>'categoria_id') = v_ctg_id::text
    or (p.pro_categoria_principal_id is null and exists (
      select 1 from comun_comercio.com_producto_categoria pc
      where pc.pct_producto_id = p.pro_id 
        and pc.pct_categoria_id = v_ctg_id 
        and pc.pct_es_principal = true 
        and pc.pct_eliminado_en is null
    ))
  )
  and p.pro_eliminado_en is null
  and p.pro_activo = true;

  -- 3. Verificar si tiene subcategorías dependientes activas
  select count(*)
  into v_conteo_hijas
  from comun_comercio.com_categoria
  where ctg_padre_id = v_ctg_id
    and ctg_eliminado_en is null
    and ctg_activo = true;

  v_total_en_uso := coalesce(v_conteo_principales, 0);

  -- 4. Control estricto: Si está en uso como categoría principal por productos activos, NO permitir eliminar
  if v_total_en_uso > 0 or coalesce(v_conteo_hijas, 0) > 0 then
    return jsonb_build_object(
      'ok', false,
      'en_uso', true,
      'conteo_productos', v_total_en_uso,
      'conteo_subcategorias', coalesce(v_conteo_hijas, 0),
      'ejemplos_productos', coalesce(v_nombres_ejemplo[1:3], array[]::text[]),
      'categoria_nombre', v_cat_record.ctg_nombre,
      'error', 'No se puede eliminar la categoría "' || v_cat_record.ctg_nombre ||
               '" porque está asignada como categoría principal a ' || v_total_en_uso ||
               ' producto(s)' ||
               case when array_length(v_nombres_ejemplo, 1) > 0 
                    then ' (ej. "' || array_to_string(v_nombres_ejemplo[1:2], '", "') || '")' 
                    else '' end ||
               '. Reasigna o retira los productos asociados antes de eliminarla.'
    );
  end if;

  -- 5. Si no está en uso como principal: desvincular relaciones secundarias / etiquetas residuales
  delete from comun_comercio.com_producto_categoria
  where pct_categoria_id = v_ctg_id;

  -- Limpiar referencias secundarias en metadatos jsonb de productos
  update comun_comercio.com_producto
  set pro_detalle_producto = pro_detalle_producto - 'categoria_id' - 'categoria_slug'
  where (pro_detalle_producto->>'categoria_id') = v_ctg_id::text
     or (pro_detalle_producto->>'categoria_slug') = v_cat_record.ctg_slug;

  -- 6. Dar de baja de forma segura (soft delete y desactivación)
  update comun_comercio.com_categoria
  set
    ctg_activo = false,
    ctg_eliminado_en = now(),
    ctg_actualizado_en = now()
  where ctg_id = v_ctg_id;

  -- Intentar eliminación física limpia si no existen restricciones residuales de FK
  begin
    delete from comun_comercio.com_categoria
    where ctg_id = v_ctg_id;
  exception when foreign_key_violation then
    -- Mantener el soft delete ya aplicado arriba
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'en_uso', false,
    'categoria_id', v_ctg_id,
    'categoria_nombre', v_cat_record.ctg_nombre,
    'mensaje', 'Categoría "' || v_cat_record.ctg_nombre || '" eliminada exitosamente.'
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function comun_comercio.com_fn_eliminar_categoria_catalogo(text, text) to anon, authenticated, service_role;

-- Wrapper en esquema public para llamadas PostgREST
create or replace function public.com_fn_eliminar_categoria_catalogo(
  p_categoria_id text,
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
as $$
begin
  return comun_comercio.com_fn_eliminar_categoria_catalogo(p_categoria_id, p_negocio);
end;
$$;

grant execute on function public.com_fn_eliminar_categoria_catalogo(text, text) to anon, authenticated, service_role;

-- 2. Función RPC para consultar categorías con su conteo de productos en uso (sincronizada 100% con la eliminación)
create or replace function comun_comercio.com_fn_obtener_categorias_con_uso(
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := coalesce(lower(trim(p_negocio)), 'tinkay');
  v_resultado jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ctg_id', c.ctg_id,
        'ctg_negocio', c.ctg_negocio,
        'ctg_nombre', c.ctg_nombre,
        'ctg_slug', c.ctg_slug,
        'ctg_descripcion', c.ctg_descripcion,
        'ctg_tipo', c.ctg_tipo,
        'ctg_orden', c.ctg_orden,
        'ctg_activo', c.ctg_activo,
        'ctg_detalle_categoria', coalesce(c.ctg_detalle_categoria, '{}'::jsonb),
        'productos_conteo', (
          select count(distinct p.pro_id)
          from comun_comercio.com_producto p
          where (
            p.pro_categoria_principal_id = c.ctg_id 
            or (p.pro_detalle_producto->>'categoria_id') = c.ctg_id::text
            or (p.pro_categoria_principal_id is null and exists (
              select 1 from comun_comercio.com_producto_categoria pc
              where pc.pct_producto_id = p.pro_id 
                and pc.pct_categoria_id = c.ctg_id 
                and pc.pct_es_principal = true 
                and pc.pct_eliminado_en is null
            ))
          )
          and p.pro_eliminado_en is null
          and p.pro_activo = true
        ),
        'en_uso', (
          (select count(distinct p.pro_id)
           from comun_comercio.com_producto p
           where (
             p.pro_categoria_principal_id = c.ctg_id 
             or (p.pro_detalle_producto->>'categoria_id') = c.ctg_id::text
             or (p.pro_categoria_principal_id is null and exists (
               select 1 from comun_comercio.com_producto_categoria pc
               where pc.pct_producto_id = p.pro_id 
                 and pc.pct_categoria_id = c.ctg_id 
                 and pc.pct_es_principal = true 
                 and pc.pct_eliminado_en is null
             ))
           )
           and p.pro_eliminado_en is null
           and p.pro_activo = true) > 0
        ),
        'productos_ejemplo', coalesce(
          (
            select array_agg(sub.pro_nombre)
            from (
              select distinct p.pro_nombre
              from comun_comercio.com_producto p
              where (
                p.pro_categoria_principal_id = c.ctg_id 
                or (p.pro_detalle_producto->>'categoria_id') = c.ctg_id::text
                or (p.pro_categoria_principal_id is null and exists (
                  select 1 from comun_comercio.com_producto_categoria pc
                  where pc.pct_producto_id = p.pro_id 
                    and pc.pct_categoria_id = c.ctg_id 
                    and pc.pct_es_principal = true 
                    and pc.pct_eliminado_en is null
                ))
              )
              and p.pro_eliminado_en is null
              and p.pro_activo = true
              and p.pro_nombre is not null
              limit 3
            ) sub
          ),
          array[]::text[]
        )
      )
      order by c.ctg_orden asc, c.ctg_nombre asc
    ),
    '[]'::jsonb
  ) into v_resultado
  from comun_comercio.com_categoria c
  where c.ctg_negocio = v_negocio
    and c.ctg_activo = true
    and c.ctg_eliminado_en is null;

  return v_resultado;
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_categorias_con_uso(text) to anon, authenticated, service_role;

create or replace function public.com_fn_obtener_categorias_con_uso(
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
as $$
begin
  return comun_comercio.com_fn_obtener_categorias_con_uso(p_negocio);
end;
$$;

grant execute on function public.com_fn_obtener_categorias_con_uso(text) to anon, authenticated, service_role;
