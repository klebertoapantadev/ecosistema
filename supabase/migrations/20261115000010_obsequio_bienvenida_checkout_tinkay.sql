-- ==============================================================================
-- Migración: 20261115000010_obsequio_bienvenida_checkout_tinkay.sql
--
-- Ajusta com_fn_verificar_primera_compra_usuario para:
--   1. Resolver dinámicamente el producto real de obsequio desde comun_comercio.com_variante
--      (SKU 'TIN-VAR-4' / 'Ferrero x1 en Esfera acrílica', imagen de portada y precio referencial).
--   2. Exigir membresía activa en el negocio consultado (aislamiento multinegocio).
--   3. Soportar la línea extra con valor $0.00 en com_proforma_item cuando el cliente
--      acepta el obsequio por registro y primera compra al momento de pagar.
-- ==============================================================================

create or replace function comun_comercio.com_fn_verificar_primera_compra_usuario(
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio text := lower(trim(coalesce(p_negocio, 'tinkay')));
  v_email text;
  v_tiene_membresia boolean := false;
  v_compras_previas integer := 0;
  v_regalo_entregado boolean := false;
  v_sku text := 'TIN-VAR-4';
  v_nombre text := 'Bombón Ferrero x1 en Esfera Acrílica';
  v_precio numeric(12,2) := 1.50;
  v_imagen text := 'https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1793008388305-bouquet_rojo_recostado_esferas_ferrero.jpg';
begin
  select
    coalesce(nullif(trim(v.var_sku), ''), v_sku),
    coalesce(nullif(trim(v.var_nombre), ''), v_nombre),
    coalesce(v.var_precio, v_precio),
    coalesce(nullif(trim(v.var_detalle_variante->>'portada_url'), ''), v_imagen)
  into v_sku, v_nombre, v_precio, v_imagen
  from comun_comercio.com_variante v
  where lower(v.var_negocio) = v_negocio
    and v.var_activo = true
    and v.var_eliminado_en is null
    and (upper(coalesce(v.var_sku, '')) = 'TIN-VAR-4' or v.var_nombre ilike '%esfera%')
  order by (upper(coalesce(v.var_sku, '')) = 'TIN-VAR-4') desc, v.var_creado_en asc
  limit 1;

  if v_usuario is null then
    return jsonb_build_object(
      'autenticado', false,
      'aplica_regalo', false,
      'regalo', jsonb_build_object(
        'sku', v_sku,
        'nombre', v_nombre,
        'valor_referencia', v_precio,
        'imagen_url', v_imagen
      )
    );
  end if;

  select exists (
    select 1
    from comun_seguridad.seg_membresia m
    where m.mem_usuario_id = v_usuario
      and m.mem_estado in ('ACTIVO', 'ACTIVA')
      and lower(m.mem_negocio) in (v_negocio, lower(comun_comercio.com_fn_prefijo_negocio(v_negocio)))
  ) or exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = v_usuario
      and u.usu_superadmin_plataforma = true
  )
  into v_tiene_membresia;

  if not v_tiene_membresia then
    return jsonb_build_object(
      'autenticado', false,
      'aplica_regalo', false,
      'regalo', jsonb_build_object(
        'sku', v_sku,
        'nombre', v_nombre,
        'valor_referencia', v_precio,
        'imagen_url', v_imagen
      )
    );
  end if;

  select lower(trim(coalesce(usu_correo, '')))
    into v_email
    from comun_seguridad.seg_usuario
   where usu_id = v_usuario;

  select coalesce(bool_or(cli_regalo_primera_compra_entregado), false)
    into v_regalo_entregado
    from comun_comercio.com_cliente
   where cli_negocio = v_negocio
     and (cli_usuario_id = v_usuario or (v_email <> '' and lower(cli_correo) = v_email))
     and cli_eliminado_en is null;

  if not v_regalo_entregado then
    select count(*)
      into v_compras_previas
      from comun_comercio.com_proforma
     where prf_negocio = v_negocio
       and prf_eliminado_en is null
       and prf_estado in ('APROBADA', 'RESERVADA_70', 'EN_PRODUCCION', 'EN_CAMINO', 'ENTREGADO')
       and (
         prf_cliente_id = v_usuario
         or (v_email <> '' and lower(coalesce(prf_cliente_contacto->>'correo', '')) = v_email)
       );
  end if;

  return jsonb_build_object(
    'autenticado', true,
    'aplica_regalo', (not v_regalo_entregado and v_compras_previas = 0),
    'regalo', jsonb_build_object(
      'sku', v_sku,
      'nombre', v_nombre,
      'valor_referencia', v_precio,
      'imagen_url', v_imagen
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_verificar_primera_compra_usuario(text) from public;
grant execute on function comun_comercio.com_fn_verificar_primera_compra_usuario(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
