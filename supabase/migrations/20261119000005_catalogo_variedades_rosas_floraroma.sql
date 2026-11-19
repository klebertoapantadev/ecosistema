-- =============================================================================
-- Migración: 20261119000005_catalogo_variedades_rosas_floraroma.sql
-- Requerimientos: PLT-009 / TNK-005 (Catálogo de Variedades de Rosas Ecuatorianas)
-- Descripción:
--   1. Tabla comun_comercio.com_variedad_rosa con clasificación de 11 colores
--      (estándar Floraroma S.A.), nombre de variedad, imagen de referencia y
--      bandera de variedad por defecto por color (`vro_es_defecto`).
--   2. RLS estricto + trigger de auditoría `aud_fn_auditar_tabla()`.
--   3. Política de Storage para fotos de nuevas variedades (`variedades-rosas/%`).
--   4. RPCs transaccionales: listar, inicializar semilla, guardar/agregar,
--      definir variedad por defecto y eliminar lógicamente.
-- =============================================================================

create table if not exists comun_comercio.com_variedad_rosa (
  vro_id uuid primary key default gen_random_uuid(),
  vro_secuencial bigint generated always as identity,
  vro_negocio text not null,
  vro_color_clave text not null,
  vro_nombre text not null,
  vro_imagen_url text,
  vro_es_defecto boolean not null default false,
  vro_orden integer not null default 100,
  vro_es_personalizada boolean not null default false,
  vro_activo boolean not null default true,
  vro_detalle_variedad jsonb not null default '{}'::jsonb,
  vro_creado_en timestamptz not null default now(),
  vro_actualizado_en timestamptz not null default now(),
  vro_eliminado_en timestamptz
);

create index if not exists idx_com_variedad_rosa_negocio_color
  on comun_comercio.com_variedad_rosa (vro_negocio, vro_color_clave, vro_es_defecto desc, vro_orden asc)
  where vro_eliminado_en is null;

create unique index if not exists uq_com_variedad_rosa_defecto_por_color
  on comun_comercio.com_variedad_rosa (vro_negocio, vro_color_clave)
  where vro_es_defecto = true and vro_eliminado_en is null;

alter table comun_comercio.com_variedad_rosa enable row level security;

drop policy if exists com_variedad_rosa_lectura on comun_comercio.com_variedad_rosa;
create policy com_variedad_rosa_lectura on comun_comercio.com_variedad_rosa
  for select using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(vro_negocio));

drop policy if exists com_variedad_rosa_escritura on comun_comercio.com_variedad_rosa;
create policy com_variedad_rosa_escritura on comun_comercio.com_variedad_rosa
  for all using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(vro_negocio))
  with check (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(vro_negocio));

drop trigger if exists trg_auditoria_com_variedad_rosa on comun_comercio.com_variedad_rosa;
create trigger trg_auditoria_com_variedad_rosa
  after insert or update or delete on comun_comercio.com_variedad_rosa
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_variedad_rosa to authenticated;
grant all on comun_comercio.com_variedad_rosa to service_role;

-- Política Storage para subir fotos de nuevas variedades en comun-publico/variedades-rosas/
do $$
begin
  drop policy if exists "variedades_rosas_insert_autenticado" on storage.objects;
  create policy "variedades_rosas_insert_autenticado"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'comun-publico'
      and name like 'variedades-rosas/%'
    );
exception when others then
  null;
end $$;

-- 1. RPC: Listar variedades activas del negocio
create or replace function comun_comercio.com_fn_listar_variedades_rosa(
  p_negocio text default 'tinkay'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_items jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para consultar variedades de rosas.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
  into v_items
  from (
    select
      v.vro_id as "id",
      v.vro_color_clave as "colorClave",
      v.vro_nombre as "nombre",
      coalesce(v.vro_imagen_url, '') as "imagenUrl",
      v.vro_es_defecto as "esDefecto",
      v.vro_orden as "orden",
      v.vro_es_personalizada as "esPersonalizada"
    from comun_comercio.com_variedad_rosa v
    where v.vro_negocio = v_negocio
      and v.vro_activo = true
      and v.vro_eliminado_en is null
    order by v.vro_color_clave asc, v.vro_es_defecto desc, v.vro_orden asc, v.vro_nombre asc
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'items', v_items
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_variedades_rosa(text) from public;
grant execute on function comun_comercio.com_fn_listar_variedades_rosa(text) to authenticated, service_role;

-- 2. RPC: Inicializar catálogo semilla Floraroma si el negocio aún no tiene variedades guardadas
create or replace function comun_comercio.com_fn_inicializar_variedades_rosa(
  p_negocio text,
  p_variedades jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_existentes integer := 0;
  v_el jsonb;
  v_orden integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para inicializar el catálogo.');
  end if;

  select count(*)
  into v_existentes
  from comun_comercio.com_variedad_rosa
  where vro_negocio = v_negocio
    and vro_eliminado_en is null;

  if v_existentes > 0 then
    return comun_comercio.com_fn_listar_variedades_rosa(v_negocio);
  end if;

  for v_el in select * from jsonb_array_elements(coalesce(p_variedades, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    insert into comun_comercio.com_variedad_rosa (
      vro_negocio,
      vro_color_clave,
      vro_nombre,
      vro_imagen_url,
      vro_es_defecto,
      vro_orden,
      vro_es_personalizada
    ) values (
      v_negocio,
      lower(btrim(coalesce(v_el->>'colorClave', 'rojo'))),
      btrim(coalesce(v_el->>'nombre', 'Variedad')),
      nullif(btrim(coalesce(v_el->>'imagenUrl', '')), ''),
      coalesce((v_el->>'esDefecto')::boolean, false),
      coalesce((v_el->>'orden')::integer, v_orden),
      coalesce((v_el->>'esPersonalizada')::boolean, false)
    );
  end loop;

  return comun_comercio.com_fn_listar_variedades_rosa(v_negocio);
end;
$$;

revoke execute on function comun_comercio.com_fn_inicializar_variedades_rosa(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_inicializar_variedades_rosa(text, jsonb) to authenticated, service_role;

-- 3. RPC: Agregar o editar una variedad de rosa
create or replace function comun_comercio.com_fn_guardar_variedad_rosa(
  p_negocio text,
  p_color_clave text,
  p_nombre text,
  p_imagen_url text default null,
  p_es_defecto boolean default false,
  p_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_color text := lower(btrim(coalesce(p_color_clave, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_img text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_es_def boolean := coalesce(p_es_defecto, false);
  v_fila comun_comercio.com_variedad_rosa;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para modificar variedades de rosas.');
  end if;

  if v_color = '' or v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El color y el nombre de la variedad son obligatorios.');
  end if;

  if v_es_def then
    update comun_comercio.com_variedad_rosa
       set vro_es_defecto = false,
           vro_actualizado_en = now()
     where vro_negocio = v_negocio
       and vro_color_clave = v_color
       and vro_es_defecto = true
       and vro_eliminado_en is null
       and (p_id is null or vro_id <> p_id);
  end if;

  if p_id is not null then
    update comun_comercio.com_variedad_rosa
       set vro_color_clave = v_color,
           vro_nombre = v_nombre,
           vro_imagen_url = coalesce(v_img, vro_imagen_url),
           vro_es_defecto = v_es_def,
           vro_actualizado_en = now()
     where vro_id = p_id
       and vro_negocio = v_negocio
       and vro_eliminado_en is null
    returning * into v_fila;
  end if;

  if v_fila.vro_id is null then
    insert into comun_comercio.com_variedad_rosa (
      vro_negocio,
      vro_color_clave,
      vro_nombre,
      vro_imagen_url,
      vro_es_defecto,
      vro_orden,
      vro_es_personalizada
    ) values (
      v_negocio,
      v_color,
      v_nombre,
      v_img,
      v_es_def,
      500,
      true
    )
    returning * into v_fila;
  end if;

  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object(
      'id', v_fila.vro_id,
      'colorClave', v_fila.vro_color_clave,
      'nombre', v_fila.vro_nombre,
      'imagenUrl', coalesce(v_fila.vro_imagen_url, ''),
      'esDefecto', v_fila.vro_es_defecto,
      'orden', v_fila.vro_orden,
      'esPersonalizada', v_fila.vro_es_personalizada
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_variedad_rosa(text, text, text, text, boolean, uuid) from public;
grant execute on function comun_comercio.com_fn_guardar_variedad_rosa(text, text, text, text, boolean, uuid) to authenticated, service_role;

-- 4. RPC: Definir variedad por defecto para un color (transaccional)
create or replace function comun_comercio.com_fn_definir_variedad_defecto(
  p_negocio text,
  p_color_clave text,
  p_variedad_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_color text := lower(btrim(coalesce(p_color_clave, '')));
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para cambiar la variedad por defecto.');
  end if;

  update comun_comercio.com_variedad_rosa
     set vro_es_defecto = false,
         vro_actualizado_en = now()
   where vro_negocio = v_negocio
     and vro_color_clave = v_color
     and vro_es_defecto = true
     and vro_eliminado_en is null;

  update comun_comercio.com_variedad_rosa
     set vro_es_defecto = true,
         vro_actualizado_en = now()
   where vro_id = p_variedad_id
     and vro_negocio = v_negocio
     and vro_color_clave = v_color
     and vro_eliminado_en is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_definir_variedad_defecto(text, text, uuid) from public;
grant execute on function comun_comercio.com_fn_definir_variedad_defecto(text, text, uuid) to authenticated, service_role;

-- 5. RPC: Eliminar variedad lógicamente (si era defecto, promueve otra variedad del mismo color)
create or replace function comun_comercio.com_fn_eliminar_variedad_rosa(
  p_negocio text,
  p_variedad_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_color text;
  v_era_def boolean := false;
  v_reemplazo_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para eliminar variedades.');
  end if;

  select vro_color_clave, vro_es_defecto
    into v_color, v_era_def
    from comun_comercio.com_variedad_rosa
   where vro_id = p_variedad_id
     and vro_negocio = v_negocio
     and vro_eliminado_en is null;

  if v_color is null then
    return jsonb_build_object('ok', false, 'error', 'Variedad no encontrada.');
  end if;

  update comun_comercio.com_variedad_rosa
     set vro_eliminado_en = now(),
         vro_activo = false,
         vro_es_defecto = false,
         vro_actualizado_en = now()
   where vro_id = p_variedad_id
     and vro_negocio = v_negocio;

  if v_era_def then
    select vro_id
      into v_reemplazo_id
      from comun_comercio.com_variedad_rosa
     where vro_negocio = v_negocio
       and vro_color_clave = v_color
       and vro_eliminado_en is null
       and vro_activo = true
     order by vro_orden asc, vro_nombre asc
     limit 1;

    if v_reemplazo_id is not null then
      update comun_comercio.com_variedad_rosa
         set vro_es_defecto = true,
             vro_actualizado_en = now()
       where vro_id = v_reemplazo_id;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_eliminar_variedad_rosa(text, uuid) from public;
grant execute on function comun_comercio.com_fn_eliminar_variedad_rosa(text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
