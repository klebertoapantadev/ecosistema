-- ==============================================================================
-- Migración: 20260916000002_comun_comercio_catalogo_rpc_and_tinkay_fix.sql
-- Módulo: Catálogo Comercial Unificado, RPCs de Lectura Transparente y Fix Tinkay
-- Propósito: Exponer RPCs con SECURITY DEFINER para lectura directa desde PostgREST/MCP
--            y calibrar productos y variantes reales de Tinkay (IVA 0%, precios y combos).
-- ==============================================================================

-- 1. Asegurar esquema comun_comercio y permisos
create schema if not exists comun_comercio;
grant usage on schema comun_comercio to anon, authenticated, service_role;

-- 2. Asegurar esquema tinkay_floristeria y permisos
create schema if not exists tinkay_floristeria;
grant usage on schema tinkay_floristeria to anon, authenticated, service_role;

-- 3. Vistas públicas para compatibilidad PostgREST
create or replace view public.com_categoria with (security_barrier = true) as
  select * from comun_comercio.com_categoria;

create or replace view public.com_producto with (security_barrier = true) as
  select * from comun_comercio.com_producto;

create or replace view public.com_variante with (security_barrier = true) as
  select * from comun_comercio.com_variante;

grant select on public.com_categoria to anon, authenticated, service_role;
grant select on public.com_producto to anon, authenticated, service_role;
grant select on public.com_variante to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC: com_fn_obtener_categorias_catalogo
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_obtener_categorias_catalogo(p_negocio text)
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
        'ctg_detalle_categoria', coalesce(c.ctg_detalle_categoria, '{}'::jsonb)
      )
      order by c.ctg_orden asc, c.ctg_nombre asc
    ),
    '[]'::jsonb
  ) into v_resultado
  from comun_comercio.com_categoria c
  where c.ctg_negocio = v_negocio
    and c.ctg_activo = true;

  return v_resultado;
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_categorias_catalogo(text) to anon, authenticated, service_role;

create or replace function public.com_fn_obtener_categorias_catalogo(p_negocio text)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_obtener_categorias_catalogo(p_negocio);
$$;

grant execute on function public.com_fn_obtener_categorias_catalogo(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC: com_fn_obtener_catalogo_productos (con filtro de canal omnicanal)
-- ------------------------------------------------------------------------------
create or replace function comun_comercio.com_fn_obtener_catalogo_productos(
  p_negocio text,
  p_canal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := coalesce(lower(trim(p_negocio)), 'tinkay');
  v_canal text := upper(trim(coalesce(p_canal, '')));
  v_resultado jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'pro_id', p.pro_id,
        'pro_negocio', p.pro_negocio,
        'pro_nombre', p.pro_nombre,
        'pro_slug', p.pro_slug,
        'pro_descripcion', p.pro_descripcion,
        'pro_tipo', p.pro_tipo,
        'pro_destacado', p.pro_destacado,
        'pro_categoria_principal_id', p.pro_categoria_principal_id,
        'pro_detalle_producto', coalesce(p.pro_detalle_producto, '{}'::jsonb),
        'canales_visibilidad', coalesce(
          p.pro_detalle_producto->'canales_visibilidad',
          jsonb_build_array('ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API')
        ),
        'categoria', (
          case when c.ctg_id is not null then
            jsonb_build_object(
              'ctg_id', c.ctg_id,
              'ctg_nombre', c.ctg_nombre,
              'ctg_slug', c.ctg_slug
            )
          else null end
        ),
        'variantes', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'var_id', v.var_id,
                'var_producto_id', v.var_producto_id,
                'var_sku', v.var_sku,
                'var_nombre', v.var_nombre,
                'var_precio', v.var_precio,
                'var_precio_comparacion', v.var_precio_comparacion,
                'var_codigo_impuesto_sri', coalesce(v.var_codigo_impuesto_sri, 'IVA_0'),
                'var_tarifa_iva_porcentaje', coalesce(v.var_tarifa_iva_porcentaje, 0),
                'var_tipo_oferta', coalesce(v.var_tipo_oferta, 'REGULAR'),
                'var_frecuencia_recurrencia', v.var_frecuencia_recurrencia,
                'var_activo', v.var_activo,
                'var_detalle_variante', coalesce(v.var_detalle_variante, '{}'::jsonb),
                'monto_iva', round(v.var_precio * (coalesce(v.var_tarifa_iva_porcentaje, 0) / 100.0), 2),
                'precio_total', round(v.var_precio * (1 + (coalesce(v.var_tarifa_iva_porcentaje, 0) / 100.0)), 2)
              )
              order by (v.var_detalle_variante->>'orden')::int nulls last, v.var_precio asc
            )
            from comun_comercio.com_variante v
            where v.var_producto_id = p.pro_id
              and v.var_activo = true
          ),
          '[]'::jsonb
        )
      )
      order by p.pro_destacado desc, p.pro_nombre asc
    ),
    '[]'::jsonb
  ) into v_resultado
  from comun_comercio.com_producto p
  left join comun_comercio.com_categoria c on c.ctg_id = p.pro_categoria_principal_id
  where p.pro_negocio = v_negocio
    and p.pro_activo = true
    and (
      v_canal = ''
      or v_canal = 'TODOS'
      or (p.pro_detalle_producto->'canales_visibilidad') is null
      or (p.pro_detalle_producto->'canales_visibilidad') ? v_canal
    );

  return v_resultado;
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_catalogo_productos(text, text) to anon, authenticated, service_role;

create or replace function public.com_fn_obtener_catalogo_productos(
  p_negocio text,
  p_canal text default null
)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_obtener_catalogo_productos(p_negocio, p_canal);
$$;

grant execute on function public.com_fn_obtener_catalogo_productos(text, text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC: tnk_fn_buscar_catalogo_conversacional (Búsqueda conversacional ARIA)
-- ------------------------------------------------------------------------------
create or replace function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(
  p_ocasion text default null,
  p_formato text default null,
  p_presupuesto_max_usd numeric default null,
  p_termino text default null,
  p_canal text default 'CHATBOT_WHATSAPP'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_presupuesto numeric := coalesce(p_presupuesto_max_usd, 999999);
  v_canal text := upper(trim(coalesce(p_canal, 'CHATBOT_WHATSAPP')));
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', p.pro_id,
        'nombre', p.pro_nombre,
        'slug', p.pro_slug,
        'descripcion', p.pro_descripcion,
        'categoria_nombre', c.ctg_nombre,
        'categoria_slug', c.ctg_slug,
        'portada_url', p.pro_detalle_producto->>'imagen_url',
        'album_fotos_url', p.pro_detalle_producto->>'album_fotos_url',
        'delivery_incluido', coalesce((p.pro_detalle_producto->'logistica'->>'delivery_incluido')::boolean, true),
        'canales_visibilidad', coalesce(
          p.pro_detalle_producto->'canales_visibilidad',
          jsonb_build_array('ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API')
        ),
        'variantes', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'variante_id', v.var_id,
                'nombre', v.var_nombre,
                'sku', v.var_sku,
                'precio_base_usd', v.var_precio,
                'tarifa_iva', coalesce(v.var_tarifa_iva_porcentaje, 0),
                'monto_iva_usd', round(v.var_precio * (coalesce(v.var_tarifa_iva_porcentaje, 0) / 100.0), 2),
                'pvp_total_usd', round(v.var_precio * (1 + (coalesce(v.var_tarifa_iva_porcentaje, 0) / 100.0)), 2),
                'foto_variante_url', v.var_detalle_variante->>'portada_url'
              )
              order by (v.var_detalle_variante->>'orden')::int nulls last, v.var_precio asc
            )
            from comun_comercio.com_variante v
            where v.var_producto_id = p.pro_id
              and v.var_activo = true
              and round(v.var_precio * (1 + (coalesce(v.var_tarifa_iva_porcentaje, 0) / 100.0)), 2) <= v_presupuesto
          ),
          '[]'::jsonb
        )
      )
      order by p.pro_destacado desc, p.pro_nombre asc
    ),
    '[]'::jsonb
  ) into v_resultado
  from comun_comercio.com_producto p
  left join comun_comercio.com_categoria c on c.ctg_id = p.pro_categoria_principal_id
  where p.pro_negocio = 'tinkay'
    and p.pro_activo = true
    and (
      v_canal = ''
      or v_canal = 'TODOS'
      or (p.pro_detalle_producto->'canales_visibilidad') is null
      or (p.pro_detalle_producto->'canales_visibilidad') ? v_canal
    )
    and (
      p_termino is null or trim(p_termino) = ''
      or p.pro_nombre ilike ('%' || trim(p_termino) || '%')
      or p.pro_descripcion ilike ('%' || trim(p_termino) || '%')
      or p.pro_detalle_producto::text ilike ('%' || trim(p_termino) || '%')
    )
    and (
      p_ocasion is null or trim(p_ocasion) = ''
      or p.pro_descripcion ilike ('%' || trim(p_ocasion) || '%')
      or c.ctg_slug ilike ('%' || trim(p_ocasion) || '%')
      or c.ctg_nombre ilike ('%' || trim(p_ocasion) || '%')
    )
    and (
      p_formato is null or trim(p_formato) = ''
      or c.ctg_slug ilike ('%' || trim(p_formato) || '%')
      or c.ctg_nombre ilike ('%' || trim(p_formato) || '%')
    );

  return v_resultado;
end;
$$;

grant execute on function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(text, text, numeric, text, text) to anon, authenticated, service_role;

create or replace function public.tnk_fn_buscar_catalogo_conversacional(
  p_ocasion text default null,
  p_formato text default null,
  p_presupuesto_max_usd numeric default null,
  p_termino text default null,
  p_canal text default 'CHATBOT_WHATSAPP'
)
returns jsonb
language sql
security definer
as $$
  select tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(p_ocasion, p_formato, p_presupuesto_max_usd, p_termino, p_canal);
$$;

grant execute on function public.tnk_fn_buscar_catalogo_conversacional(text, text, numeric, text, text) to anon, authenticated, service_role;

