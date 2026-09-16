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

-- ------------------------------------------------------------------------------
-- 7. Actualización de Semillas en BDD para Tinkay Floristería (IVA 0% y Precios Reales)
-- ------------------------------------------------------------------------------

-- Categorías
insert into comun_comercio.com_categoria (ctg_negocio, ctg_nombre, ctg_slug, ctg_tipo, ctg_orden, ctg_activo)
values
  ('tinkay', 'Para Florero', 'cat-floreros', 'FORMATO', 1, true),
  ('tinkay', 'Estilo Coreano', 'cat-coreanos', 'COLECCION', 2, true),
  ('tinkay', 'Especiales y Mix', 'cat-especiales', 'FORMATO', 3, true),
  ('tinkay', 'Combos y Aniversario', 'cat-combos', 'COLECCION', 4, true),
  ('tinkay', 'Abanicos & Pedestales', 'cat-abanicos', 'FORMATO', 5, true),
  ('tinkay', 'Detalles y Regalos', 'cat-detalles', 'COMPLEMENTO', 6, true)
on conflict (ctg_negocio, ctg_slug) do update set
  ctg_nombre = excluded.ctg_nombre,
  ctg_tipo = excluded.ctg_tipo,
  ctg_orden = excluded.ctg_orden,
  ctg_activo = true;

-- Producto 1: Bouquet Diseño Estilo Coreano
insert into comun_comercio.com_producto (
  pro_id, pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_detalle_producto
) values (
  '3af6aff5-ddd0-4746-b282-c760e4b42214',
  'tinkay',
  'Bouquet Diseño Estilo Coreano',
  'tinkay-bouq-coreano',
  'Arreglo exclusivo de vanguardia envuelto en finos papeles coreanos plisados y translúcidos con caída de cintas de seda satinada.',
  'FISICO',
  true,
  true,
  jsonb_build_object(
    'icono', 'Sparkles',
    'imagen_url', 'https://lh3.googleusercontent.com/pw/AP1GczOZEFibMGGeADW_BlMVDWuifn-a-CTi0efgjdil0ThfsclKkkMNC6cPbMNf54SmJDtME9HRHe6CwCEmCA4uGM60Mith_GOkuJ2pDaRSrmQgP5DaN68_=w1200',
    'album_fotos_url', 'https://photos.app.goo.gl/RhTxny2frDaV1XTv5',
    'tiempo_entrega', '🌸 Pide hoy, recibe hoy (Mismo Día)',
    'tarifa_iva_predeterminada', 0,
    'codigo_impuesto_sri', 'IVA_0',
    'logistica', jsonb_build_object(
      'delivery_incluido', true,
      'modalidad_transporte', 'INCLUIDO_GRATIS',
      'etiqueta_transporte', '🚚 Envío a Domicilio Incluido',
      'cobertura_texto', 'Quito Urbano y Valles'
    ),
    'canales_visibilidad', jsonb_build_array('ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API'),
    'beneficios', jsonb_build_array(
      'Rosas de exportación seleccionadas de tallo largo',
      'Papel coreano plisado y cintas de seda satinada',
      'Tarjeta dedicatoria personalizada gratis',
      'Envío a domicilio sin costo en Quito urbano y valles'
    )
  )
)
on conflict (pro_negocio, pro_slug) do update set
  pro_nombre = excluded.pro_nombre,
  pro_descripcion = excluded.pro_descripcion,
  pro_destacado = true,
  pro_activo = true,
  pro_detalle_producto = excluded.pro_detalle_producto;

-- Variantes Bouquet Coreano (5 Variantes Reales de Base de Datos)
insert into comun_comercio.com_variante (
  var_id, var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_tarifa_iva_porcentaje, var_codigo_impuesto_sri, var_activo, var_detalle_variante
) values
  ('var-tinkay-cor-peq', '3af6aff5-ddd0-4746-b282-c760e4b42214', 'tinkay', 'TNK-COR-PEQ', 'Pequeño (24 Rosas)', 26.00, 0, 'IVA_0', true, jsonb_build_object('orden', 1, 'tamano', 'Pequeño (24 Rosas)', 'pvp_nominal', 26.0, 'portada_url', 'https://lh3.googleusercontent.com/pw/AP1GczP9RID-AQeQ6oU3zqa7gBVW2ZvAZCW3KSvFvfUIRTvD4vK8N4UNmKNi9rVahSW4eIY3xiDvdQxm-FS2S1qGU_L767WWZt7FLODsvNy15bkHq0GWpkdm=w1200')),
  ('var-tinkay-cor-med', '3af6aff5-ddd0-4746-b282-c760e4b42214', 'tinkay', 'TNK-COR-MED', 'Mediano (40 Rosas)', 30.00, 0, 'IVA_0', true, jsonb_build_object('orden', 2, 'tamano', 'Mediano (40 Rosas)', 'pvp_nominal', 30.0, 'portada_url', 'https://lh3.googleusercontent.com/pw/AP1GczNzLNcUnBLT4DfAuiOz8_c7pcicI4GFwu6mCKv2NUIoDqn5H0NWqOuORRHBmYDrdD0hbPUcnjdknOmzhBDFvwqCeOSSB3Q74LBIpykkCfFpGe3wipb6=w1200')),
  ('var-tinkay-cor-gra', '3af6aff5-ddd0-4746-b282-c760e4b42214', 'tinkay', 'TNK-COR-GRA', 'Grande (60 Rosas)', 45.00, 0, 'IVA_0', true, jsonb_build_object('orden', 3, 'tamano', 'Grande', 'pvp_nominal', 45.0, 'portada_url', 'https://lh3.googleusercontent.com/pw/AP1GczP8-SWS6YF2iOsXEa1A7Ij26_J2C0CMLX6jMb5aqvkd5Hd2BQP9azHW4ZJR9wsZfg47ujPytVktmhNLiMBYQzV2fVGalU5znPN3oqjB2GoulGh0eyN5=w1200')),
  ('var-tinkay-cor-gig', '3af6aff5-ddd0-4746-b282-c760e4b42214', 'tinkay', 'TNK-COR-GIG', 'Gigante (90 Rosas)', 60.00, 0, 'IVA_0', true, jsonb_build_object('orden', 4, 'tamano', 'Gigante VIP', 'pvp_nominal', 60.0, 'portada_url', 'https://lh3.googleusercontent.com/pw/AP1GczNhxYIB2tPlUrod5q4ovLTZ8VeWkcLU1bxVREGSwMh9m0TS7DwgjezCYG8O8CCM6wn3p97mBth4B_dVLT7MmDiD_WBTr1Xl4H0PH1VQcgXskqLHS0GO=w1200')),
  ('var-tinkay-cor-vip180', '3af6aff5-ddd0-4746-b282-c760e4b42214', 'tinkay', 'TIN-VAR-5', 'Gigante VIP (180 Rosas)', 90.00, 0, 'IVA_0', true, jsonb_build_object('orden', 5, 'tamano', 'Gigante VIP (180 Rosas)', 'pvp_nominal', 90.0, 'portada_url', 'https://lh3.googleusercontent.com/pw/AP1GczNhxYIB2tPlUrod5q4ovLTZ8VeWkcLU1bxVREGSwMh9m0TS7DwgjezCYG8O8CCM6wn3p97mBth4B_dVLT7MmDiD_WBTr1Xl4H0PH1VQcgXskqLHS0GO=w1200'))
on conflict (var_negocio, var_sku) do update set
  var_nombre = excluded.var_nombre,
  var_precio = excluded.var_precio,
  var_tarifa_iva_porcentaje = 0,
  var_codigo_impuesto_sri = 'IVA_0',
  var_activo = true,
  var_detalle_variante = excluded.var_detalle_variante;

-- Producto 2: Combo Aniversario Romántico
insert into comun_comercio.com_producto (
  pro_id, pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_detalle_producto
) values (
  '4bf7b886-eee1-4857-c393-d871fb5e3325',
  'tinkay',
  'Combo Aniversario Romántico',
  'tinkay-combo-aniversario',
  'Experiencia completa para celebrar hitos y fechas inolvidables: Bouquet floral de impacto + Caja de bombones Ferrero Rocher + Globo personalizado con helio.',
  'FISICO',
  true,
  true,
  jsonb_build_object(
    'icono', 'Heart',
    'imagen_url', 'https://lh3.googleusercontent.com/pw/AP1GczNzLNcUnBLT4DfAuiOz8_c7pcicI4GFwu6mCKv2NUIoDqn5H0NWqOuORRHBmYDrdD0hbPUcnjdknOmzhBDFvwqCeOSSB3Q74LBIpykkCfFpGe3wipb6=w1200',
    'album_fotos_url', 'https://photos.app.goo.gl/tinkay-aniversario',
    'tiempo_entrega', '🌸 Pide hoy, recibe hoy (Mismo Día)',
    'tarifa_iva_predeterminada', 0,
    'codigo_impuesto_sri', 'IVA_0',
    'logistica', jsonb_build_object(
      'delivery_incluido', true,
      'modalidad_transporte', 'INCLUIDO_GRATIS',
      'etiqueta_transporte', '🚚 Envío a Domicilio Incluido',
      'cobertura_texto', 'Quito Urbano y Valles'
    ),
    'canales_visibilidad', jsonb_build_array('ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API'),
    'beneficios', jsonb_build_array(
      'Bouquet de rosas frescas seleccionadas',
      'Caja de bombones Ferrero Rocher',
      'Globo burbuja inflado con helio',
      'Tarjeta con mensaje caligráfico dedicatorio',
      'Envío a domicilio sin costo'
    )
  )
)
on conflict (pro_negocio, pro_slug) do update set
  pro_nombre = excluded.pro_nombre,
  pro_descripcion = excluded.pro_descripcion,
  pro_destacado = true,
  pro_activo = true,
  pro_detalle_producto = excluded.pro_detalle_producto;

-- Variantes Combo Aniversario
insert into comun_comercio.com_variante (
  var_id, var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_tarifa_iva_porcentaje, var_codigo_impuesto_sri, var_activo, var_detalle_variante
) values
  ('var-tinkay-combo-bas', '4bf7b886-eee1-4857-c393-d871fb5e3325', 'tinkay', 'TNK-COMBO-BAS', 'Combo Aniversario Básico (60 Rosas + Ferrero)', 38.00, 0, 'IVA_0', true, jsonb_build_object('orden', 1, 'pvp_nominal', 38.0)),
  ('var-tinkay-combo-vip', '4bf7b886-eee1-4857-c393-d871fb5e3325', 'tinkay', 'TNK-COMBO-VIP', 'Combo Aniversario VIP (100 Rosas + Ferrero + Globo)', 55.00, 0, 'IVA_0', true, jsonb_build_object('orden', 2, 'pvp_nominal', 55.0)),
  ('var-tinkay-combo-mon', '4bf7b886-eee1-4857-c393-d871fb5e3325', 'tinkay', 'TNK-COMBO-MON', 'Combo Monumental 180 Rosas VIP (180 Rosas + Corona + Ferrero + Globo)', 99.00, 0, 'IVA_0', true, jsonb_build_object('orden', 3, 'pvp_nominal', 99.0))
on conflict (var_negocio, var_sku) do update set
  var_nombre = excluded.var_nombre,
  var_precio = excluded.var_precio,
  var_tarifa_iva_porcentaje = 0,
  var_codigo_impuesto_sri = 'IVA_0',
  var_activo = true,
  var_detalle_variante = excluded.var_detalle_variante;
