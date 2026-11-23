-- ==============================================================================
-- Migración: 20261123000001_contador_me_gusta_global_productos.sql
-- Módulo: comun_comercio (PLT-009 / TNK-002)
-- Propósito:
--   1. Agregar contador global persistente de "Me gusta" (corazones) por producto
--      (`pro_total_me_gusta`) y por variante (`var_total_me_gusta`) en
--      `comun_comercio.com_producto` y `comun_comercio.com_variante`.
--   2. Refrescar vistas públicas (`public.com_producto`, `public.com_variante`)
--      para exponer ambos contadores en PostgREST al cargar la tienda y el panel.
--   3. Exponer RPC transaccional SECURITY DEFINER
--      `comun_comercio.com_fn_registrar_me_gusta_producto` (y wrapper `public`)
--      que incrementa atómicamente (+1) el contador global sin decrementar jamás
--      cuando un usuario retira el producto de su lista personal de favoritos.
-- ==============================================================================

-- 1. Columnas de contador global persistente (nomenclatura estándar pro_ / var_)
alter table comun_comercio.com_producto
  add column if not exists pro_total_me_gusta bigint not null default 0;

alter table comun_comercio.com_variante
  add column if not exists var_total_me_gusta bigint not null default 0;

create index if not exists idx_com_producto_negocio_me_gusta
  on comun_comercio.com_producto (pro_negocio, pro_total_me_gusta desc)
  where pro_eliminado_en is null;

-- 2. Refrescar vistas públicas de compatibilidad PostgREST para incluir las nuevas columnas
create or replace view public.com_producto with (security_barrier = true) as
  select * from comun_comercio.com_producto;

create or replace view public.com_variante with (security_barrier = true) as
  select * from comun_comercio.com_variante;

grant select on public.com_producto to anon, authenticated, service_role;
grant select on public.com_variante to anon, authenticated, service_role;

-- 3. RPC SECURITY DEFINER: incrementar contador global de Me gusta (+1 permanente)
create or replace function comun_comercio.com_fn_registrar_me_gusta_producto(
  p_negocio text,
  p_producto_id uuid default null,
  p_producto_slug text default null,
  p_variante_sku text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_norm text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(nullif(btrim(p_negocio), ''), 'tinkay'));
  v_prod_id uuid;
  v_prod_slug text;
  v_pro_total bigint := 0;
  v_var_id uuid;
  v_var_sku text := nullif(btrim(coalesce(p_variante_sku, '')), '');
  v_var_total bigint := null;
begin
  -- Búsqueda in situ por UUID o por slug normalizado dentro del negocio
  if p_producto_id is not null then
    select p.pro_id, p.pro_slug
      into v_prod_id, v_prod_slug
    from comun_comercio.com_producto p
    where p.pro_id = p_producto_id
      and p.pro_eliminado_en is null
      and comun_seguridad.seg_fn_normalizar_negocio(p.pro_negocio) = v_negocio_norm
    limit 1;
  end if;

  if v_prod_id is null and nullif(btrim(coalesce(p_producto_slug, '')), '') is not null then
    select p.pro_id, p.pro_slug
      into v_prod_id, v_prod_slug
    from comun_comercio.com_producto p
    where lower(p.pro_slug) = lower(btrim(p_producto_slug))
      and p.pro_eliminado_en is null
      and comun_seguridad.seg_fn_normalizar_negocio(p.pro_negocio) = v_negocio_norm
    limit 1;
  end if;

  if v_prod_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Producto no encontrado para registrar Me gusta.'
    );
  end if;

  -- Incremento atómico permanente en el producto maestro (nunca se decrementa)
  update comun_comercio.com_producto
     set pro_total_me_gusta = coalesce(pro_total_me_gusta, 0) + 1
   where pro_id = v_prod_id
  returning pro_total_me_gusta into v_pro_total;

  -- Incremento atómico permanente en la variante específica (si aplica)
  if v_var_sku is not null then
    select v.var_id
      into v_var_id
    from comun_comercio.com_variante v
    where v.var_producto_id = v_prod_id
      and lower(v.var_sku) = lower(v_var_sku)
      and v.var_eliminado_en is null
    limit 1;

    if v_var_id is not null then
      update comun_comercio.com_variante
         set var_total_me_gusta = coalesce(var_total_me_gusta, 0) + 1
       where var_id = v_var_id
      returning var_total_me_gusta into v_var_total;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pro_id', v_prod_id,
    'pro_slug', v_prod_slug,
    'pro_total_me_gusta', coalesce(v_pro_total, 0),
    'var_sku', v_var_sku,
    'var_total_me_gusta', v_var_total
  );
end;
$$;

grant execute on function comun_comercio.com_fn_registrar_me_gusta_producto(text, uuid, text, text)
  to anon, authenticated, service_role;

create or replace function public.com_fn_registrar_me_gusta_producto(
  p_negocio text,
  p_producto_id uuid default null,
  p_producto_slug text default null,
  p_variante_sku text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_registrar_me_gusta_producto(
    p_negocio,
    p_producto_id,
    p_producto_slug,
    p_variante_sku
  );
$$;

grant execute on function public.com_fn_registrar_me_gusta_producto(text, uuid, text, text)
  to anon, authenticated, service_role;

-- 4. RPC auxiliar de lectura rápida de totales de Me gusta por negocio
create or replace function comun_comercio.com_fn_obtener_me_gusta_catalogo(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_norm text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(nullif(btrim(p_negocio), ''), 'tinkay'));
  v_total_global bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  select coalesce(sum(coalesce(p.pro_total_me_gusta, 0)), 0)
    into v_total_global
  from comun_comercio.com_producto p
  where p.pro_eliminado_en is null
    and p.pro_activo = true
    and comun_seguridad.seg_fn_normalizar_negocio(p.pro_negocio) = v_negocio_norm;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'pro_id', p.pro_id,
        'pro_slug', p.pro_slug,
        'pro_total_me_gusta', coalesce(p.pro_total_me_gusta, 0),
        'variantes', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'var_sku', v.var_sku,
                'var_total_me_gusta', coalesce(v.var_total_me_gusta, 0)
              )
            )
            from comun_comercio.com_variante v
            where v.var_producto_id = p.pro_id
              and v.var_eliminado_en is null
              and coalesce(v.var_total_me_gusta, 0) > 0
          ),
          '[]'::jsonb
        )
      )
      order by coalesce(p.pro_total_me_gusta, 0) desc
    ),
    '[]'::jsonb
  )
    into v_items
  from comun_comercio.com_producto p
  where p.pro_eliminado_en is null
    and p.pro_activo = true
    and comun_seguridad.seg_fn_normalizar_negocio(p.pro_negocio) = v_negocio_norm
    and coalesce(p.pro_total_me_gusta, 0) > 0;

  return jsonb_build_object(
    'ok', true,
    'total_global', v_total_global,
    'productos', v_items
  );
end;
$$;

grant execute on function comun_comercio.com_fn_obtener_me_gusta_catalogo(text)
  to anon, authenticated, service_role;

create or replace function public.com_fn_obtener_me_gusta_catalogo(
  p_negocio text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select comun_comercio.com_fn_obtener_me_gusta_catalogo(p_negocio);
$$;

grant execute on function public.com_fn_obtener_me_gusta_catalogo(text)
  to anon, authenticated, service_role;
