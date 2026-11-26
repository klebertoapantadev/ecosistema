-- =============================================================================
-- Migración: 20261126000008_receta_composicion_producto_multinegocio.sql
-- Requerimientos: PLT-009 / TNK-001 / TNK-002 / TNK-005
-- Descripción:
--   Crea RPC `comun_comercio.com_fn_sincronizar_recetas_producto(p_negocio, p_producto_id)`
--   para sincronizar atómicamente (vía soft-delete + upsert, sin DELETE físico)
--   la composición / receta estructurada de cada variante (heredada desde Master
--   o personalizada en la variante) en `comun_comercio.com_insumo` y
--   `comun_comercio.com_receta`.
-- =============================================================================

create or replace function comun_comercio.com_fn_sincronizar_recetas_producto(
  p_negocio text,
  p_producto_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_prod record;
  v_var record;
  v_receta_master jsonb;
  v_receta_efectiva jsonb;
  v_rec_item jsonb;
  v_rec_clave text;
  v_rec_codigo_insumo text;
  v_rec_nombre_insumo text;
  v_rec_unidad text;
  v_rec_cant numeric(12, 4);
  v_rec_insumo_id uuid;
  v_variantes_procesadas integer := 0;
  v_items_activos integer := 0;
begin
  if p_producto_id is null then
    return jsonb_build_object('ok', false, 'error', 'Se requiere p_producto_id.');
  end if;

  if auth.uid() is not null
     and not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio)
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para sincronizar recetas de catálogo.');
  end if;

  select p.pro_id, p.pro_detalle_producto
    into v_prod
    from comun_comercio.com_producto p
   where p.pro_id = p_producto_id
     and p.pro_negocio = v_negocio
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado para el negocio indicado.');
  end if;

  v_receta_master := coalesce(
    case when jsonb_typeof(v_prod.pro_detalle_producto->'composicion_receta') = 'array'
         then v_prod.pro_detalle_producto->'composicion_receta' else null end,
    case when jsonb_typeof(v_prod.pro_detalle_producto->'personalizacion_floral'->'composicionReceta') = 'array'
         then v_prod.pro_detalle_producto->'personalizacion_floral'->'composicionReceta' else null end,
    '[]'::jsonb
  );

  for v_var in
    select v.var_id, v.var_detalle_variante
      from comun_comercio.com_variante v
     where v.var_producto_id = p_producto_id
       and v.var_negocio = v_negocio
       and v.var_eliminado_en is null
  loop
    v_variantes_procesadas := v_variantes_procesadas + 1;

    if coalesce(v_var.var_detalle_variante->>'personalizacion_floral_modo', 'heredar') = 'personalizado'
       and (
         jsonb_typeof(v_var.var_detalle_variante->'composicion_receta') = 'array'
         or jsonb_typeof(v_var.var_detalle_variante->'personalizacion_floral'->'composicionReceta') = 'array'
       ) then
      v_receta_efectiva := coalesce(
        case when jsonb_typeof(v_var.var_detalle_variante->'composicion_receta') = 'array'
             then v_var.var_detalle_variante->'composicion_receta' else null end,
        case when jsonb_typeof(v_var.var_detalle_variante->'personalizacion_floral'->'composicionReceta') = 'array'
             then v_var.var_detalle_variante->'personalizacion_floral'->'composicionReceta' else null end,
        '[]'::jsonb
      );
    else
      v_receta_efectiva := v_receta_master;
    end if;

    -- Marcar como eliminados lógicamente los ítems previos de esta variante antes de reactivar/insertar los vigentes
    update comun_comercio.com_receta
       set rec_eliminado_en = now(),
           rec_actualizado_en = now()
     where rec_variante_id = v_var.var_id
       and rec_negocio = v_negocio
       and rec_eliminado_en is null;

    if jsonb_typeof(v_receta_efectiva) = 'array' and jsonb_array_length(v_receta_efectiva) > 0 then
      for v_rec_item in select * from jsonb_array_elements(v_receta_efectiva) loop
        begin
          v_rec_cant := coalesce(nullif(trim(coalesce(v_rec_item->>'cantidad', '')), '')::numeric(12, 4), 0);
        exception when others then
          v_rec_cant := 0;
        end;
        if v_rec_cant <= 0 then
          continue;
        end if;

        v_rec_clave := lower(regexp_replace(trim(coalesce(v_rec_item->>'clave', '')), '[^a-z0-9_]+', '_', 'g'));
        if v_rec_clave = '' then
          continue;
        end if;

        v_rec_codigo_insumo := upper(
          coalesce(
            nullif(trim(coalesce(v_rec_item->>'codigoInsumo', '')), ''),
            'REC_' || v_rec_clave
          )
        );
        v_rec_nombre_insumo := coalesce(
          nullif(trim(coalesce(v_rec_item->>'etiquetaPlural', '')), ''),
          initcap(replace(v_rec_clave, '_', ' '))
        );
        v_rec_unidad := upper(coalesce(nullif(trim(coalesce(v_rec_item->>'unidadMedida', '')), ''), 'UNIDAD'));

        insert into comun_comercio.com_insumo (
          ins_negocio,
          ins_codigo,
          ins_nombre,
          ins_unidad_medida,
          ins_activo,
          ins_detalle_insumo
        ) values (
          v_negocio,
          v_rec_codigo_insumo,
          v_rec_nombre_insumo,
          v_rec_unidad,
          true,
          jsonb_build_object(
            'categoria_operativa', 'COMPONENTE_RECETA',
            'clave_receta', v_rec_clave
          )
        )
        on conflict (ins_negocio, ins_codigo) do update set
          ins_activo = true,
          ins_actualizado_en = now()
        returning ins_id into v_rec_insumo_id;

        if v_rec_insumo_id is not null then
          insert into comun_comercio.com_receta (
            rec_negocio,
            rec_variante_id,
            rec_insumo_id,
            rec_cantidad,
            rec_es_opcional,
            rec_detalle_receta,
            rec_eliminado_en,
            rec_actualizado_en
          ) values (
            v_negocio,
            v_var.var_id,
            v_rec_insumo_id,
            v_rec_cant,
            false,
            v_rec_item,
            null,
            now()
          )
          on conflict (rec_variante_id, rec_insumo_id) do update set
            rec_cantidad = excluded.rec_cantidad,
            rec_detalle_receta = excluded.rec_detalle_receta,
            rec_eliminado_en = null,
            rec_actualizado_en = now();

          v_items_activos := v_items_activos + 1;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'productoId', p_producto_id,
    'variantesProcesadas', v_variantes_procesadas,
    'itemsRecetaActivos', v_items_activos
  );
end;
$$;

revoke all on function comun_comercio.com_fn_sincronizar_recetas_producto(text, uuid) from public, anon;
grant execute on function comun_comercio.com_fn_sincronizar_recetas_producto(text, uuid) to authenticated, service_role;
