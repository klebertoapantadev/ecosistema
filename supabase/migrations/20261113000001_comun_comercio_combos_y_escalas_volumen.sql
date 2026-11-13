-- ==============================================================================
-- Migración: 20261113000001_comun_comercio_combos_y_escalas_volumen.sql
-- Módulo: comun_comercio (Catálogo Comercial Unificado - PLT-009 / ADR-0003)
-- Propósito:
--   1. Crear tabla relacional `comun_comercio.com_combo_componente` (prefijo `cbc_`)
--      con RLS estricto y auditoría `aud_fn_auditar_tabla()` para Sets/Combos
--      configurables compuestos por productos simples o multivariantes.
--   2. Actualizar `com_fn_guardar_producto_catalogo` para sincronizar de forma
--      transaccional `com_combo_componente` junto con `pro_detalle_producto` y
--      las escalas de descuento por volumen en `var_detalle_variante`.
-- ==============================================================================

-- 1. Tabla relacional de componentes de Sets / Combos comerciales
create table if not exists comun_comercio.com_combo_componente (
  cbc_id uuid primary key default gen_random_uuid(),
  cbc_secuencial bigint generated always as identity,
  cbc_negocio text not null,
  cbc_producto_combo_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  cbc_producto_componente_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  cbc_variante_default_id uuid references comun_comercio.com_variante(var_id) on delete set null,
  cbc_cantidad_base integer not null default 1 check (cbc_cantidad_base >= 1),
  cbc_orden integer not null default 1,
  cbc_detalle_componente jsonb not null default '{}'::jsonb,
  cbc_creado_en timestamptz not null default now(),
  cbc_actualizado_en timestamptz not null default now(),
  check (cbc_producto_combo_id <> cbc_producto_componente_id)
);

create index if not exists idx_com_cbc_combo
  on comun_comercio.com_combo_componente(cbc_producto_combo_id, cbc_orden);

create index if not exists idx_com_cbc_negocio
  on comun_comercio.com_combo_componente(cbc_negocio);

-- 2. Seguridad por fila (RLS obligatorio al 100%)
alter table comun_comercio.com_combo_componente enable row level security;

drop policy if exists com_combo_componente_lectura_publica on comun_comercio.com_combo_componente;
create policy com_combo_componente_lectura_publica
  on comun_comercio.com_combo_componente
  for select
  using (true);

drop policy if exists com_combo_componente_staff on comun_comercio.com_combo_componente;
create policy com_combo_componente_staff
  on comun_comercio.com_combo_componente
  for all
  using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cbc_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cbc_negocio));

-- 3. Trigger de auditoría obligatorio
drop trigger if exists trg_auditoria_com_combo_componente on comun_comercio.com_combo_componente;
create trigger trg_auditoria_com_combo_componente
  after insert or update or delete on comun_comercio.com_combo_componente
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 4. Permisos sobre tabla y secuencia
grant select on comun_comercio.com_combo_componente to anon, authenticated, service_role;
grant insert, update, delete on comun_comercio.com_combo_componente to authenticated, service_role;
grant usage, select on sequence comun_comercio.com_combo_componente_cbc_secuencial_seq to authenticated, service_role;

-- 5. Actualizar RPC transaccional com_fn_guardar_producto_catalogo para sincronizar combos
create or replace function comun_comercio.com_fn_guardar_producto_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pro_id uuid;
  v_negocio text;
  v_nombre text;
  v_slug text;
  v_descripcion text;
  v_categoria_id uuid;
  v_tipo text;
  v_destacado boolean;
  v_pro_activo boolean;
  v_detalle_prod jsonb;
  v_variantes jsonb;
  v_var jsonb;
  v_var_id uuid;
  v_var_id_raw text;
  v_var_sku text;
  v_var_nombre text;
  v_var_precio numeric(12, 4);
  v_var_precio_comp numeric(12, 4);
  v_var_tarifa_iva numeric(5, 2);
  v_var_impuesto text;
  v_var_tipo_oferta text;
  v_var_activo boolean;
  v_var_detalle jsonb;
  v_target_pro_id_raw text;
  v_skus_enviados text[] := array[]::text[];
  v_ids_enviados uuid[] := array[]::uuid[];
  v_es_combo boolean := false;
  v_combo_items jsonb := '[]'::jsonb;
  v_comp jsonb;
  v_comp_prod_id uuid;
  v_comp_var_id uuid;
  v_comp_prod_raw text;
  v_comp_var_raw text;
  v_comp_sku_raw text;
  v_comp_cant integer;
  v_comp_orden integer := 0;
begin
  v_target_pro_id_raw := p_datos->>'pro_id';
  v_negocio       := lower(trim(coalesce(p_datos->>'negocio', 'tranqi')));
  v_nombre        := trim(coalesce(p_datos->>'nombre', ''));
  v_slug          := trim(coalesce(p_datos->>'slug', ''));
  v_descripcion   := coalesce(p_datos->>'descripcion', '');
  v_tipo          := upper(coalesce(p_datos->>'tipo', 'FISICO'));
  v_destacado     := coalesce((p_datos->>'destacado')::boolean, false);
  v_pro_activo    := coalesce((p_datos->>'pro_activo')::boolean, true);
  v_detalle_prod  := coalesce(p_datos->'detalle_producto', '{}'::jsonb);
  v_variantes     := coalesce(p_datos->'variantes', '[]'::jsonb);

  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre del producto es obligatorio');
  end if;

  if p_datos->>'categoria_id' is not null and (p_datos->>'categoria_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_categoria_id := (p_datos->>'categoria_id')::uuid;
  else
    v_categoria_id := null;
  end if;

  -- 1. Insertar o actualizar el producto maestro
  if v_target_pro_id_raw is not null and v_target_pro_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_pro_id := v_target_pro_id_raw::uuid;

    update comun_comercio.com_producto
    set
      pro_nombre = v_nombre,
      pro_descripcion = v_descripcion,
      pro_tipo = v_tipo,
      pro_destacado = v_destacado,
      pro_categoria_principal_id = coalesce(v_categoria_id, pro_categoria_principal_id),
      pro_detalle_producto = v_detalle_prod,
      pro_activo = v_pro_activo,
      pro_actualizado_en = now()
    where pro_id = v_pro_id;
  else
    if v_slug = '' then
      v_slug := lower(regexp_replace(v_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
      v_slug := trim(both '-' from v_slug);
      v_slug := v_negocio || '-' || v_slug;
    end if;

    insert into comun_comercio.com_producto (
      pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo,
      pro_destacado, pro_categoria_principal_id, pro_activo, pro_detalle_producto
    ) values (
      v_negocio, v_nombre, v_slug, v_descripcion, v_tipo,
      v_destacado, v_categoria_id, v_pro_activo, v_detalle_prod
    )
    on conflict (pro_negocio, pro_slug) do update set
      pro_nombre = excluded.pro_nombre,
      pro_descripcion = excluded.pro_descripcion,
      pro_tipo = excluded.pro_tipo,
      pro_destacado = excluded.pro_destacado,
      pro_categoria_principal_id = coalesce(excluded.pro_categoria_principal_id, comun_comercio.com_producto.pro_categoria_principal_id),
      pro_detalle_producto = excluded.pro_detalle_producto,
      pro_activo = excluded.pro_activo,
      pro_actualizado_en = now()
    returning pro_id into v_pro_id;
  end if;

  -- 2. Procesar y persistir cada variante / tamaño
  for v_var in select * from jsonb_array_elements(v_variantes)
  loop
    v_var_id_raw := v_var->>'var_id';
    if v_var_id_raw is not null and v_var_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_var_id := v_var_id_raw::uuid;
      v_ids_enviados := array_append(v_ids_enviados, v_var_id);
    else
      v_var_id := null;
    end if;

    v_var_sku := trim(v_var->>'var_sku');
    if v_var_sku is null or v_var_sku = '' then
      v_var_sku := upper(substring(v_negocio from 1 for 3)) || '-VAR-' || to_char(now(), 'YYMMDDHH24MISSMS');
    end if;
    v_skus_enviados := array_append(v_skus_enviados, v_var_sku);

    v_var_nombre := coalesce(trim(v_var->>'var_nombre'), 'Variante');
    v_var_precio := coalesce((v_var->>'var_precio')::numeric, 0.0);

    if (v_var->>'var_precio_comparacion') is not null and (v_var->>'var_precio_comparacion') <> '' then
      v_var_precio_comp := (v_var->>'var_precio_comparacion')::numeric;
    else
      v_var_precio_comp := null;
    end if;

    v_var_tarifa_iva := coalesce((v_var->>'var_tarifa_iva_porcentaje')::numeric, 15.00);
    v_var_impuesto := coalesce(v_var->>'var_codigo_impuesto_sri', case when v_var_tarifa_iva > 0 then 'IVA_15' else 'IVA_0' end);
    v_var_tipo_oferta := coalesce(v_var->>'var_tipo_oferta', 'REGULAR');
    v_var_activo := coalesce((v_var->>'var_activo')::boolean, true);
    v_var_detalle := coalesce(v_var->'var_detalle_variante', '{}'::jsonb);

    if v_var_id is not null and exists (select 1 from comun_comercio.com_variante where var_id = v_var_id) then
      update comun_comercio.com_variante
      set
        var_producto_id = v_pro_id,
        var_sku = v_var_sku,
        var_nombre = v_var_nombre,
        var_precio = v_var_precio,
        var_precio_comparacion = v_var_precio_comp,
        var_codigo_impuesto_sri = v_var_impuesto,
        var_tarifa_iva_porcentaje = v_var_tarifa_iva,
        var_tipo_oferta = v_var_tipo_oferta,
        var_activo = v_var_activo,
        var_detalle_variante = v_var_detalle,
        var_actualizado_en = now()
      where var_id = v_var_id;
    else
      insert into comun_comercio.com_variante (
        var_producto_id, var_negocio, var_sku, var_nombre, var_precio,
        var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje,
        var_tipo_oferta, var_activo, var_detalle_variante
      ) values (
        v_pro_id, v_negocio, v_var_sku, v_var_nombre, v_var_precio,
        v_var_precio_comp, v_var_impuesto, v_var_tarifa_iva,
        v_var_tipo_oferta, v_var_activo, v_var_detalle
      )
      on conflict (var_negocio, var_sku) do update set
        var_producto_id = excluded.var_producto_id,
        var_nombre = excluded.var_nombre,
        var_precio = excluded.var_precio,
        var_precio_comparacion = excluded.var_precio_comparacion,
        var_codigo_impuesto_sri = excluded.var_codigo_impuesto_sri,
        var_tarifa_iva_porcentaje = excluded.var_tarifa_iva_porcentaje,
        var_tipo_oferta = excluded.var_tipo_oferta,
        var_activo = excluded.var_activo,
        var_detalle_variante = excluded.var_detalle_variante,
        var_actualizado_en = now();
    end if;
  end loop;

  -- 3. Purgar variantes antiguas de este producto que fueron eliminadas en el editor
  if jsonb_array_length(v_variantes) > 0 then
    begin
      delete from comun_comercio.com_variante
      where var_producto_id = v_pro_id
        and (cardinality(v_ids_enviados) = 0 or var_id != all(v_ids_enviados))
        and (cardinality(v_skus_enviados) = 0 or var_sku != all(v_skus_enviados));
    exception when foreign_key_violation then
      update comun_comercio.com_variante
      set var_activo = false,
          var_eliminado_en = now()
      where var_producto_id = v_pro_id
        and (cardinality(v_ids_enviados) = 0 or var_id != all(v_ids_enviados))
        and (cardinality(v_skus_enviados) = 0 or var_sku != all(v_skus_enviados));
    end;
  end if;

  -- 4. Sincronizar componentes relacionales del Set / Combo si aplica
  v_es_combo := coalesce((v_detalle_prod->>'es_combo')::boolean, false);
  delete from comun_comercio.com_combo_componente
  where cbc_producto_combo_id = v_pro_id;

  if v_es_combo and jsonb_typeof(v_detalle_prod->'combo_componentes') = 'array' then
    v_combo_items := v_detalle_prod->'combo_componentes';
    for v_comp in select * from jsonb_array_elements(v_combo_items)
    loop
      v_comp_orden := v_comp_orden + 1;
      v_comp_prod_id := null;
      v_comp_var_id := null;
      v_comp_prod_raw := trim(coalesce(v_comp->>'producto_id', ''));
      v_comp_var_raw := trim(coalesce(v_comp->>'variante_id', ''));
      v_comp_sku_raw := trim(coalesce(v_comp->>'variante_sku', ''));
      v_comp_cant := greatest(1, coalesce((v_comp->>'cantidad_base')::integer, 1));

      if v_comp_prod_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select p.pro_id into v_comp_prod_id
        from comun_comercio.com_producto p
        where p.pro_id = v_comp_prod_raw::uuid
          and p.pro_negocio = v_negocio
        limit 1;
      end if;

      if v_comp_prod_id is null and coalesce(v_comp->>'producto_slug', '') <> '' then
        select p.pro_id into v_comp_prod_id
        from comun_comercio.com_producto p
        where p.pro_negocio = v_negocio
          and p.pro_slug = trim(v_comp->>'producto_slug')
        limit 1;
      end if;

      if v_comp_var_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select v.var_id into v_comp_var_id
        from comun_comercio.com_variante v
        where v.var_id = v_comp_var_raw::uuid
          and v.var_negocio = v_negocio
        limit 1;
      elsif v_comp_sku_raw <> '' then
        select v.var_id into v_comp_var_id
        from comun_comercio.com_variante v
        where v.var_negocio = v_negocio
          and v.var_sku = v_comp_sku_raw
        limit 1;
      end if;

      if v_comp_prod_id is not null and v_comp_prod_id <> v_pro_id then
        insert into comun_comercio.com_combo_componente (
          cbc_negocio,
          cbc_producto_combo_id,
          cbc_producto_componente_id,
          cbc_variante_default_id,
          cbc_cantidad_base,
          cbc_orden,
          cbc_detalle_componente
        ) values (
          v_negocio,
          v_pro_id,
          v_comp_prod_id,
          v_comp_var_id,
          v_comp_cant,
          coalesce((v_comp->>'orden')::integer, v_comp_orden),
          v_comp
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'pro_id', v_pro_id);
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_producto_catalogo(jsonb) to anon, authenticated, service_role;

create or replace function public.com_fn_guardar_producto_catalogo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return comun_comercio.com_fn_guardar_producto_catalogo(p_datos);
end;
$$;

grant execute on function public.com_fn_guardar_producto_catalogo(jsonb) to anon, authenticated, service_role;

