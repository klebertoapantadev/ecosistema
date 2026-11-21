-- ==============================================================================
-- Migración: 20261121000001_entrega_inmediata_usos_condolencias.sql
-- Módulo: comun_comercio (PLT-009 / TNK-005)
-- Propósito:
--   1. Actualizar `comun_comercio.com_fn_publicar_entrega_inmediata` manteniendo
--      su firma exacta de 9 parámetros para asignar automáticamente el uso
--      existente `"condolencias"` (🕊️ Condolencias / Duelo) dentro de
--      `pro_detalle_producto.usos` cuando el nombre del producto contenga
--      "condolencias" (o "condolencia", insensible a mayúsculas).
--   2. Exponer `usos` en `comun_comercio.com_fn_listar_entrega_inmediata`.
--   3. Regularizar retroactivamente los productos existentes de Entrega Inmediata
--      cuyo nombre contiene "condolencia" y aún no tenían el uso asignado.
-- ==============================================================================

create or replace function comun_comercio.com_fn_listar_entrega_inmediata(
  p_negocio text default 'tinkay',
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_es_staff boolean := false;
  v_items jsonb;
begin
  if auth.uid() is not null then
    v_es_staff := comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio);
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
      'productoId', p.pro_id,
      'varianteId', v.var_id,
      'slug', p.pro_slug,
      'sku', v.var_sku,
      'nombre', p.pro_nombre,
      'descripcion', coalesce(p.pro_descripcion, p.pro_detalle_producto->>'descripcion_corta', ''),
      'precio', coalesce(v.var_precio, 0),
      'precioComparacion', v.var_precio_comparacion,
      'imagenUrl', coalesce(p.pro_detalle_producto->>'imagen_url', v.var_detalle_variante->>'portada_url', ''),
      'galeriaUrls', coalesce(p.pro_detalle_producto->'galeria_urls', '[]'::jsonb),
      'stockDisponible', greatest(0, coalesce((v.var_detalle_variante->>'stock_inmediato')::integer, 1)),
      'tiempoEntregaTexto', coalesce(p.pro_detalle_producto->>'tiempo_entrega_inmediata', '1 a 2 horas'),
      'activo', (coalesce(p.pro_activo, false) and coalesce(v.var_activo, false)),
      'motivoBaja', p.pro_detalle_producto->>'motivo_baja_inmediata',
      'ordenVentaCodigo', p.pro_detalle_producto->>'orden_venta_codigo',
      'usos', coalesce(
        case
          when jsonb_typeof(p.pro_detalle_producto->'usos') = 'array' then p.pro_detalle_producto->'usos'
          else '[]'::jsonb
        end,
        '[]'::jsonb
      ),
      'creadoEn', p.pro_creado_en,
      'actualizadoEn', p.pro_actualizado_en
    ) as item
    from comun_comercio.com_producto p
    join lateral (
      select cv.*
      from comun_comercio.com_variante cv
      where cv.var_producto_id = p.pro_id
        and cv.var_eliminado_en is null
      order by cv.var_creado_en asc
      limit 1
    ) v on true
    where p.pro_negocio = v_negocio
      and p.pro_eliminado_en is null
      and coalesce((p.pro_detalle_producto->>'es_entrega_inmediata')::boolean, false) = true
      and (
        (coalesce(p.pro_activo, false) = true and coalesce(v.var_activo, false) = true and coalesce((v.var_detalle_variante->>'stock_inmediato')::integer, 1) > 0)
        or (p_incluir_inactivos and v_es_staff)
      )
    order by
      (case when coalesce(p.pro_activo, false) and coalesce(v.var_activo, false) then 0 else 1 end) asc,
      p.pro_creado_en desc
    limit 100
  ) sub;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_entrega_inmediata(text, boolean) from public;
grant execute on function comun_comercio.com_fn_listar_entrega_inmediata(text, boolean) to anon, authenticated, service_role;

create or replace function comun_comercio.com_fn_publicar_entrega_inmediata(
  p_negocio text,
  p_nombre text,
  p_precio numeric,
  p_imagen_url text,
  p_stock integer default 1,
  p_precio_comparacion numeric default null,
  p_descripcion text default null,
  p_galeria jsonb default '[]'::jsonb,
  p_producto_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_cat_id uuid;
  v_pro_id uuid;
  v_var_id uuid;
  v_slug text;
  v_sku text;
  v_nombre text := coalesce(nullif(btrim(coalesce(p_nombre, '')), ''), 'Arreglo Listo Entrega Inmediata');
  v_desc text := coalesce(nullif(btrim(coalesce(p_descripcion, '')), ''), 'Arreglo floral fresco recién elaborado en taller, disponible para entrega inmediata de 1 a 2 horas.');
  v_stock integer := greatest(1, coalesce(p_stock, 1));
  v_precio numeric(12,2) := round(greatest(1, coalesce(p_precio, 15))::numeric, 2);
  v_galeria jsonb;
  v_es_condolencias boolean := lower(coalesce(v_nombre, '')) like '%condolencia%';
  v_usos_existentes jsonb := '[]'::jsonb;
  v_usos_final jsonb := '[]'::jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para publicar arreglos de entrega inmediata.');
  end if;

  if coalesce(btrim(p_imagen_url), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Debes adjuntar o tomar al menos una fotografía del arreglo.');
  end if;

  select ctg_id into v_cat_id
  from comun_comercio.com_categoria
  where ctg_negocio = v_negocio
    and ctg_slug = 'entrega-inmediata'
    and ctg_eliminado_en is null
  limit 1;

  if v_cat_id is null then
    insert into comun_comercio.com_categoria (
      ctg_negocio, ctg_slug, ctg_nombre, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo, ctg_detalle_categoria
    ) values (
      v_negocio, 'entrega-inmediata', '⚡ Entrega Inmediata',
      'Arreglos recién elaborados disponibles para envío en 1 a 2 horas.', 'COLECCION', 0, true,
      jsonb_build_object('icono', '⚡', 'es_entrega_inmediata', true)
    )
    returning ctg_id into v_cat_id;
  end if;

  if jsonb_typeof(p_galeria) = 'array' and jsonb_array_length(p_galeria) > 0 then
    v_galeria := p_galeria;
  else
    v_galeria := jsonb_build_array(btrim(p_imagen_url));
  end if;

  if p_producto_id is not null then
    select case
             when jsonb_typeof(pro_detalle_producto->'usos') = 'array' then pro_detalle_producto->'usos'
             else '[]'::jsonb
           end
      into v_usos_existentes
    from comun_comercio.com_producto
    where pro_id = p_producto_id
      and pro_negocio = v_negocio;

    v_usos_final := coalesce(v_usos_existentes, '[]'::jsonb);
    if v_es_condolencias and not (v_usos_final ? 'condolencias') then
      v_usos_final := v_usos_final || jsonb_build_array('condolencias');
    end if;

    update comun_comercio.com_producto
       set pro_nombre = v_nombre,
           pro_descripcion = v_desc,
           pro_activo = true,
           pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb) || jsonb_build_object(
             'es_entrega_inmediata', true,
             'tiempo_entrega_inmediata', '1 a 2 horas',
             'imagen_url', btrim(p_imagen_url),
             'galeria_urls', v_galeria,
             'descripcion_corta', v_desc,
             'etiqueta_temporada', '⚡ ENTREGA 1–2H',
             'motivo_baja_inmediata', null,
             'usos', v_usos_final
           ),
           pro_actualizado_en = now()
     where pro_id = p_producto_id
       and pro_negocio = v_negocio
     returning pro_id, pro_slug into v_pro_id, v_slug;

    update comun_comercio.com_variante
       set var_precio = v_precio,
           var_precio_comparacion = p_precio_comparacion,
           var_activo = true,
           var_detalle_variante = coalesce(var_detalle_variante, '{}'::jsonb) || jsonb_build_object(
             'stock_inmediato', v_stock,
             'portada_url', btrim(p_imagen_url),
             'galeria_urls', v_galeria,
             'detalle', v_desc
           ),
           var_actualizado_en = now()
     where var_producto_id = v_pro_id
     returning var_id, var_sku into v_var_id, v_sku;
  else
    v_usos_final := case
      when v_es_condolencias then jsonb_build_array('condolencias')
      else '[]'::jsonb
    end;

    v_slug := 'inmediato-' || regexp_replace(lower(v_nombre), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
    v_sku := upper(left(v_negocio, 3)) || '-EXP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into comun_comercio.com_producto (
      pro_negocio,
      pro_categoria_principal_id,
      pro_slug,
      pro_nombre,
      pro_descripcion,
      pro_tipo,
      pro_destacado,
      pro_activo,
      pro_detalle_producto
    ) values (
      v_negocio,
      v_cat_id,
      v_slug,
      v_nombre,
      v_desc,
      'FISICO',
      true,
      true,
      jsonb_build_object(
        'es_entrega_inmediata', true,
        'tiempo_entrega_inmediata', '1 a 2 horas',
        'imagen_url', btrim(p_imagen_url),
        'galeria_urls', v_galeria,
        'descripcion_corta', v_desc,
        'etiqueta_temporada', '⚡ ENTREGA 1–2H',
        'usos', v_usos_final,
        'canales_visibilidad', jsonb_build_array('ECOMMERCE_WEB', 'WHATSAPP_ARIA', 'MOSTRADOR'),
        'beneficios', jsonb_build_array(
          'Arreglo físico recién elaborado en taller — recibes exactamente el diseño de la fotografía.',
          'Despacho prioritario inmediato en 1 a 2 horas tras coordinar ubicación.',
          'Tarifa especial de vitrina disponible únicamente hasta agotar existencia.'
        )
      )
    )
    returning pro_id into v_pro_id;

    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id)
    values (v_negocio, v_pro_id, v_cat_id)
    on conflict do nothing;

    insert into comun_comercio.com_variante (
      var_negocio,
      var_producto_id,
      var_sku,
      var_nombre,
      var_precio,
      var_precio_comparacion,
      var_tarifa_iva_porcentaje,
      var_activo,
      var_detalle_variante
    ) values (
      v_negocio,
      v_pro_id,
      v_sku,
      'Disponible Hoy (1–2h)',
      v_precio,
      p_precio_comparacion,
      0,
      true,
      jsonb_build_object(
        'orden', 1,
        'stock_inmediato', v_stock,
        'portada_url', btrim(p_imagen_url),
        'galeria_urls', v_galeria,
        'detalle', v_desc
      )
    )
    returning var_id into v_var_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'productoId', v_pro_id,
    'varianteId', v_var_id,
    'slug', v_slug,
    'sku', v_sku,
    'usos', v_usos_final
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_publicar_entrega_inmediata(text, text, numeric, text, integer, numeric, text, jsonb, uuid) from public;
grant execute on function comun_comercio.com_fn_publicar_entrega_inmediata(text, text, numeric, text, integer, numeric, text, jsonb, uuid) to authenticated, service_role;

-- Regularizar productos de entrega inmediata ya existentes cuyo nombre contiene "condolencia(s)"
update comun_comercio.com_producto
   set pro_detalle_producto = jsonb_set(
         coalesce(pro_detalle_producto, '{}'::jsonb),
         '{usos}',
         coalesce(
           case
             when jsonb_typeof(pro_detalle_producto->'usos') = 'array' then pro_detalle_producto->'usos'
             else '[]'::jsonb
           end,
           '[]'::jsonb
         ) || jsonb_build_array('condolencias'),
         true
       ),
       pro_actualizado_en = now()
 where pro_eliminado_en is null
   and coalesce((pro_detalle_producto->>'es_entrega_inmediata')::boolean, false) = true
   and lower(coalesce(pro_nombre, '')) like '%condolencia%'
   and not (
     jsonb_typeof(pro_detalle_producto->'usos') = 'array'
     and (pro_detalle_producto->'usos') ? 'condolencias'
   );

notify pgrst, 'reload schema';
