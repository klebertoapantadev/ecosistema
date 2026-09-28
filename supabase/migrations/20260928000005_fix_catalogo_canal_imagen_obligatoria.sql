-- ==============================================================================
-- Migración: Control de Visibilidad en Catálogo Comercial (Imagen Obligatoria)
-- Fecha: 2026-09-28
-- Descripción:
--   Actualiza la función RPC `com_fn_obtener_catalogo_productos` para exigir
--   que un producto cuente con al menos una imagen (portada, galería o en sus variantes)
--   para ser visible en los canales 'ECOMMERCE_WEB' y 'APP_CLIENTES'.
-- ==============================================================================

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
    )
    and (
      -- Si se consulta para los canales ECOMMERCE_WEB o APP_CLIENTES, exigir que tenga al menos una imagen
      case when v_canal in ('ECOMMERCE_WEB', 'APP_CLIENTES') then
        (
          coalesce(trim(p.pro_detalle_producto->>'imagen_url'), '') <> '' or
          coalesce(trim(p.pro_detalle_producto->>'foto_portada'), '') <> '' or
          coalesce(trim(p.pro_detalle_producto->>'portada_url'), '') <> '' or
          (
            jsonb_typeof(p.pro_detalle_producto->'galeria_imagenes') = 'array' and
            jsonb_array_length(p.pro_detalle_producto->'galeria_imagenes') > 0
          ) or
          (
            jsonb_typeof(p.pro_detalle_producto->'imagenes') = 'array' and
            jsonb_array_length(p.pro_detalle_producto->'imagenes') > 0
          ) or
          exists (
            select 1 from comun_comercio.com_variante v2
            where v2.var_producto_id = p.pro_id
              and v2.var_activo = true
              and (
                coalesce(trim(v2.var_detalle_variante->>'portada_url'), '') <> '' or
                coalesce(trim(v2.var_detalle_variante->>'imagen_url'), '') <> '' or
                coalesce(trim(v2.var_detalle_variante->>'foto_url'), '') <> '' or
                (
                  jsonb_typeof(v2.var_detalle_variante->'imagenes') = 'array' and
                  jsonb_array_length(v2.var_detalle_variante->'imagenes') > 0
                )
              )
          )
        )
      else true end
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
