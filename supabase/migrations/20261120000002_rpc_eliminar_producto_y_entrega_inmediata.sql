-- ==============================================================================
-- Migración: 20261120000002_rpc_eliminar_producto_y_entrega_inmediata.sql
-- Módulo: comun_comercio (PLT-009 / TNK-001 / TNK-005)
-- Propósito:
--   1. Habilitar eliminación definitiva transaccional vía RPC SECURITY DEFINER
--      (`comun_comercio.com_fn_eliminar_producto_catalogo`) sin depender de
--      `service_role` en Next.js (Regla #3 y #5 de AGENTS.md).
--   2. Permitir que el rol OPERADOR (además de ADMINISTRADOR y SUPERADMIN)
--      elimine definitivamente productos de Entrega Inmediata ya vendidos,
--      retirados o inactivos, preservando intactos los históricos de órdenes,
--      proformas y facturas (se desvincula únicamente `pfi_variante_id` nullable
--      conservando descripción, precio y totales de cada venta histórica).
-- ==============================================================================

create or replace function comun_comercio.com_fn_eliminar_producto_catalogo(
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
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_es_admin boolean := false;
  v_es_operador boolean := false;
  v_prod comun_comercio.com_producto;
  v_cat_slug text := '';
  v_cat_nombre text := '';
  v_es_inmediata boolean := false;
  v_stock_total integer := 0;
  v_tiene_variante_activa boolean := false;
  v_ya_vendido_o_inactivo boolean := false;
  v_var_ids uuid[];
  v_tiene_suscripcion boolean := false;
begin
  if p_producto_id is null then
    return jsonb_build_object('ok', false, 'error', 'Identificador de producto inválido.');
  end if;

  if not v_es_service then
    if auth.uid() is null then
      return jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión para eliminar productos.');
    end if;

    v_es_admin := coalesce(comun_seguridad.seg_fn_es_superadmin(), false)
      or coalesce(comun_seguridad.seg_fn_es_admin_negocio(v_negocio), false)
      or coalesce(comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio)), false);

    -- Verificar si el usuario tiene rol OPERADOR activo en el negocio
    if not v_es_admin then
      select exists (
        select 1
        from comun_seguridad.seg_membresia m
        left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
        left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
        where m.mem_usuario_id = auth.uid()
          and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = comun_seguridad.seg_fn_normalizar_negocio(v_negocio)
          and m.mem_estado = 'ACTIVO'
          and (
            upper(coalesce(m.mem_rol, '')) in ('OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
            or upper(coalesce(p.per_clave, '')) in ('OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
          )
      ) into v_es_operador;
    end if;

    if not v_es_admin and not v_es_operador then
      return jsonb_build_object(
        'ok', false,
        'error', 'No tienes permisos para eliminar productos del catálogo.'
      );
    end if;
  end if;

  select * into v_prod
  from comun_comercio.com_producto
  where pro_id = p_producto_id
    and comun_seguridad.seg_fn_normalizar_negocio(pro_negocio) = comun_seguridad.seg_fn_normalizar_negocio(v_negocio);

  if v_prod.pro_id is null then
    return jsonb_build_object('ok', false, 'error', 'El producto ya no existe o pertenece a otro negocio.');
  end if;

  if v_prod.pro_categoria_principal_id is not null then
    select lower(coalesce(ctg_slug, '')), lower(coalesce(ctg_nombre, ''))
      into v_cat_slug, v_cat_nombre
    from comun_comercio.com_categoria
    where ctg_id = v_prod.pro_categoria_principal_id;
  end if;

  select
    coalesce(array_agg(v.var_id), array[]::uuid[]),
    coalesce(bool_or(coalesce(v.var_activo, false)), false),
    coalesce(sum(greatest(0, coalesce((v.var_detalle_variante->>'stock_inmediato')::integer, 0))), 0)
  into v_var_ids, v_tiene_variante_activa, v_stock_total
  from comun_comercio.com_variante v
  where v.var_producto_id = v_prod.pro_id
    and v.var_eliminado_en is null;

  v_es_inmediata :=
    coalesce((v_prod.pro_detalle_producto->>'es_entrega_inmediata')::boolean, false)
    or v_cat_slug like '%entrega-inmediata%'
    or v_cat_nombre like '%entrega inmediata%';

  v_ya_vendido_o_inactivo :=
    coalesce(v_prod.pro_activo, false) = false
    or nullif(btrim(coalesce(v_prod.pro_detalle_producto->>'motivo_baja_inmediata', '')), '') is not null
    or (not v_tiene_variante_activa)
    or (v_es_inmediata and v_stock_total <= 0);

  -- El Operador puede eliminar definitivamente productos de Entrega Inmediata ya vendidos/retirados/inactivos.
  -- Solo Administrador / SuperAdmin puede eliminar productos regulares del catálogo maestro.
  if not v_es_service and not v_es_admin then
    if not (v_es_inmediata and v_ya_vendido_o_inactivo) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Como operador solo puedes eliminar definitivamente productos de Entrega Inmediata que ya se vendieron o están inactivos.'
      );
    end if;
  end if;

  -- Preservar intactos los registros históricos de proformas/ventas/convenios desvinculando la FK nullable
  if cardinality(v_var_ids) > 0 then
    update comun_comercio.com_proforma_item
       set pfi_variante_id = null
     where pfi_variante_id = any(v_var_ids);

    update comun_comercio.com_convenio_empresa
       set cve_variante_id = null
     where cve_variante_id = any(v_var_ids);

    select exists (
      select 1
      from comun_comercio.com_suscripcion s
      where s.sub_variante_id = any(v_var_ids)
    ) into v_tiene_suscripcion;
  end if;

  -- Si existe suscripción histórica con FK NOT NULL, aplicar borrado lógico completo para que desaparezca de todo el catálogo
  if v_tiene_suscripcion then
    update comun_comercio.com_variante
       set var_activo = false,
           var_eliminado_en = now(),
           var_actualizado_en = now()
     where var_producto_id = v_prod.pro_id;

    update comun_comercio.com_producto
       set pro_activo = false,
           pro_eliminado_en = now(),
           pro_actualizado_en = now()
     where pro_id = v_prod.pro_id;

    return jsonb_build_object('ok', true, 'modo', 'logico');
  end if;

  -- Borrado físico definitivo (ON DELETE CASCADE elimina com_variante, com_producto_categoria, com_media y relacionados)
  begin
    delete from comun_comercio.com_producto
    where pro_id = v_prod.pro_id;
  exception when foreign_key_violation then
    update comun_comercio.com_variante
       set var_activo = false,
           var_eliminado_en = now(),
           var_actualizado_en = now()
     where var_producto_id = v_prod.pro_id;

    update comun_comercio.com_producto
       set pro_activo = false,
           pro_eliminado_en = now(),
           pro_actualizado_en = now()
     where pro_id = v_prod.pro_id;

    return jsonb_build_object('ok', true, 'modo', 'logico');
  end;

  return jsonb_build_object('ok', true, 'modo', 'fisico');
end;
$$;

revoke all on function comun_comercio.com_fn_eliminar_producto_catalogo(text, uuid) from public, anon;
grant execute on function comun_comercio.com_fn_eliminar_producto_catalogo(text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
