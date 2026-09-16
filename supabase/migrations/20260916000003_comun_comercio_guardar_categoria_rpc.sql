-- ==============================================================================
-- Migración: 20260916000003_comun_comercio_guardar_categoria_rpc.sql
-- Módulo: comun_comercio
-- Propósito: Función transaccional RPC con SECURITY DEFINER para persistencia
--            atómica de categorías y colecciones comerciales sin bloqueos RLS.
-- ==============================================================================

create or replace function comun_comercio.com_fn_guardar_categoria_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctg_id uuid;
  v_ctg_id_raw text;
  v_negocio text;
  v_nombre text;
  v_slug text;
  v_descripcion text;
  v_tipo text;
  v_orden int;
  v_detalle_cat jsonb;
  v_resultado jsonb;
begin
  v_negocio := coalesce(lower(trim(p_datos->>'negocio')), 'tranqi');
  v_nombre := trim(p_datos->>'nombre');
  v_slug := trim(p_datos->>'slug');
  v_descripcion := coalesce(p_datos->>'descripcion', '');
  v_tipo := coalesce(p_datos->>'tipo', 'FORMATO');
  v_orden := coalesce((p_datos->>'orden')::int, 10);
  v_detalle_cat := coalesce(p_datos->'detalle_categoria', '{}'::jsonb);

  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la categoría es obligatorio');
  end if;

  if v_slug is null or v_slug = '' then
    v_slug := lower(regexp_replace(v_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
  end if;

  v_ctg_id_raw := p_datos->>'ctg_id';
  if v_ctg_id_raw is not null and v_ctg_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_ctg_id := v_ctg_id_raw::uuid;
  end if;

  -- 1. Intentar actualizar si se proporcionó un ctg_id existente
  if v_ctg_id is not null then
    update comun_comercio.com_categoria
    set
      ctg_nombre = v_nombre,
      ctg_slug = v_slug,
      ctg_descripcion = v_descripcion,
      ctg_tipo = v_tipo,
      ctg_orden = v_orden,
      ctg_activo = true,
      ctg_detalle_categoria = v_detalle_cat,
      ctg_actualizado_en = now()
    where ctg_id = v_ctg_id;
  end if;

  -- 2. Si no se actualizó ninguna fila, hacer upsert por (ctg_negocio, ctg_slug)
  if v_ctg_id is null or not found then
    insert into comun_comercio.com_categoria (
      ctg_negocio,
      ctg_nombre,
      ctg_slug,
      ctg_descripcion,
      ctg_tipo,
      ctg_orden,
      ctg_activo,
      ctg_detalle_categoria,
      ctg_actualizado_en
    ) values (
      v_negocio,
      v_nombre,
      v_slug,
      v_descripcion,
      v_tipo,
      v_orden,
      true,
      v_detalle_cat,
      now()
    )
    on conflict (ctg_negocio, ctg_slug) do update
    set
      ctg_nombre = excluded.ctg_nombre,
      ctg_descripcion = excluded.ctg_descripcion,
      ctg_tipo = excluded.ctg_tipo,
      ctg_orden = excluded.ctg_orden,
      ctg_activo = true,
      ctg_detalle_categoria = excluded.ctg_detalle_categoria,
      ctg_actualizado_en = now()
    returning ctg_id into v_ctg_id;
  end if;

  -- 3. Retornar el objeto de la categoría guardada con su UUID real
  select jsonb_build_object(
    'ok', true,
    'categoria', jsonb_build_object(
      'ctg_id', c.ctg_id,
      'ctg_negocio', c.ctg_negocio,
      'ctg_nombre', c.ctg_nombre,
      'ctg_slug', c.ctg_slug,
      'ctg_descripcion', c.ctg_descripcion,
      'ctg_tipo', c.ctg_tipo,
      'ctg_orden', c.ctg_orden,
      'ctg_activo', c.ctg_activo,
      'ctg_detalle_categoria', c.ctg_detalle_categoria
    )
  ) into v_resultado
  from comun_comercio.com_categoria c
  where c.ctg_id = v_ctg_id;

  return v_resultado;
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_categoria_catalogo(jsonb) to anon, authenticated, service_role;

-- Wrapper en esquema public para PostgREST
create or replace function public.com_fn_guardar_categoria_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
as $$
begin
  return comun_comercio.com_fn_guardar_categoria_catalogo(p_datos);
end;
$$;

grant execute on function public.com_fn_guardar_categoria_catalogo(jsonb) to anon, authenticated, service_role;
