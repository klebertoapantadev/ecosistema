-- ==============================================================================
-- Migración: RPCs y Persistencia Robusta para Campañas e Informativos
-- Esquema: comun_comercio (com_campana_informativa y funciones transaccionales)
-- ==============================================================================

-- 1. Asegurar tabla com_campana_informativa con RLS y políticas completas (USING y WITH CHECK)
create table if not exists comun_comercio.com_campana_informativa (
  inf_id uuid primary key default gen_random_uuid(),
  inf_negocio text not null default 'tranqi',
  inf_titulo text not null,
  inf_slug text not null,
  inf_subtitulo text,
  inf_contenido_md text,
  inf_tipo text not null default 'COMUNICADO_GENERAL',
  inf_audiencia text[] not null default array['TODOS'],
  inf_ubicaciones text[] not null default array['PANEL_INICIO'],
  inf_fecha_inicio timestamptz not null default now(),
  inf_fecha_fin timestamptz,
  inf_activo boolean not null default true,
  inf_prioridad text not null default 'MEDIA',
  inf_detalle jsonb not null default '{}'::jsonb,
  inf_creado_en timestamptz not null default now(),
  inf_actualizado_en timestamptz not null default now()
);

-- Constraint único (negocio, slug)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_com_campana_negocio_slug'
  ) then
    alter table comun_comercio.com_campana_informativa
      add constraint uq_com_campana_negocio_slug unique (inf_negocio, inf_slug);
  end if;
end $$;

-- Habilitar RLS
alter table comun_comercio.com_campana_informativa enable row level security;

-- Política de lectura pública/autenticada
drop policy if exists com_campana_informativa_select_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_select_policy on comun_comercio.com_campana_informativa
  for select
  using (
    inf_activo = true
    or exists (
      select 1 from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_rol r on r.rol_id = m.mbr_rol_id
      where m.mbr_usuario_id = auth.uid()
        and m.mbr_activo = true
        and r.rol_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
    )
  );

-- Política de administración con USING y WITH CHECK
drop policy if exists com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa
  for all
  using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_rol r on r.rol_id = m.mbr_rol_id
      where m.mbr_usuario_id = auth.uid()
        and m.mbr_activo = true
        and r.rol_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
    )
  )
  with check (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_rol r on r.rol_id = m.mbr_rol_id
      where m.mbr_usuario_id = auth.uid()
        and m.mbr_activo = true
        and r.rol_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
    )
  );

-- 2. RPC: Guardar o Actualizar Campaña Informativa
create or replace function comun_comercio.com_fn_guardar_campana_informativa(
  p_campana jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, comun_seguridad, public
as $$
declare
  v_id uuid;
  v_negocio text;
  v_titulo text;
  v_slug text;
  v_subtitulo text;
  v_contenido_md text;
  v_tipo text;
  v_audiencia text[];
  v_ubicaciones text[];
  v_fecha_inicio timestamptz;
  v_fecha_fin timestamptz;
  v_activo boolean;
  v_prioridad text;
  v_detalle jsonb;
  v_resultado jsonb;
  v_reg comun_comercio.com_campana_informativa%rowtype;
begin
  v_negocio := coalesce(p_campana->>'inf_negocio', 'tranqi');
  v_titulo := trim(coalesce(p_campana->>'inf_titulo', ''));
  
  if v_titulo = '' then
    return jsonb_build_object('ok', false, 'error', 'El título es obligatorio');
  end if;

  v_slug := coalesce(nullif(trim(p_campana->>'inf_slug'), ''), lower(regexp_replace(v_titulo, '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug := trim(both '-' from v_slug);
  v_subtitulo := nullif(trim(p_campana->>'inf_subtitulo'), '');
  v_contenido_md := nullif(trim(p_campana->>'inf_contenido_md'), '');
  v_tipo := coalesce(nullif(trim(p_campana->>'inf_tipo'), ''), 'COMUNICADO_GENERAL');
  
  -- Extraer arreglos
  if p_campana ? 'inf_audiencia' and jsonb_typeof(p_campana->'inf_audiencia') = 'array' then
    select array_agg(x) into v_audiencia from jsonb_array_elements_text(p_campana->'inf_audiencia') as x;
  else
    v_audiencia := array['TODOS'];
  end if;

  if p_campana ? 'inf_ubicaciones' and jsonb_typeof(p_campana->'inf_ubicaciones') = 'array' then
    select array_agg(x) into v_ubicaciones from jsonb_array_elements_text(p_campana->'inf_ubicaciones') as x;
  else
    v_ubicaciones := array['PANEL_INICIO'];
  end if;

  v_fecha_inicio := coalesce((p_campana->>'inf_fecha_inicio')::timestamptz, now());
  if p_campana->>'inf_fecha_fin' is not null and p_campana->>'inf_fecha_fin' <> '' then
    v_fecha_fin := (p_campana->>'inf_fecha_fin')::timestamptz;
  else
    v_fecha_fin := null;
  end if;

  v_activo := coalesce((p_campana->>'inf_activo')::boolean, true);
  v_prioridad := coalesce(nullif(trim(p_campana->>'inf_prioridad'), ''), 'MEDIA');
  v_detalle := coalesce(p_campana->'inf_detalle', '{}'::jsonb);

  -- Validar si viene un UUID válido
  if p_campana->>'inf_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := (p_campana->>'inf_id')::uuid;
  else
    -- Intentar buscar por slug existente
    select inf_id into v_id from comun_comercio.com_campana_informativa
    where inf_negocio = v_negocio and inf_slug = v_slug
    limit 1;
  end if;

  if v_id is not null then
    -- UPDATE in-situ
    update comun_comercio.com_campana_informativa
    set
      inf_titulo = v_titulo,
      inf_slug = v_slug,
      inf_subtitulo = v_subtitulo,
      inf_contenido_md = v_contenido_md,
      inf_tipo = v_tipo,
      inf_audiencia = v_audiencia,
      inf_ubicaciones = v_ubicaciones,
      inf_fecha_inicio = v_fecha_inicio,
      inf_fecha_fin = v_fecha_fin,
      inf_activo = v_activo,
      inf_prioridad = v_prioridad,
      inf_detalle = v_detalle,
      inf_actualizado_en = now()
    where inf_id = v_id
    returning * into v_reg;
  else
    -- INSERT con nuevo UUID
    insert into comun_comercio.com_campana_informativa (
      inf_negocio,
      inf_titulo,
      inf_slug,
      inf_subtitulo,
      inf_contenido_md,
      inf_tipo,
      inf_audiencia,
      inf_ubicaciones,
      inf_fecha_inicio,
      inf_fecha_fin,
      inf_activo,
      inf_prioridad,
      inf_detalle,
      inf_creado_en,
      inf_actualizado_en
    ) values (
      v_negocio,
      v_titulo,
      v_slug,
      v_subtitulo,
      v_contenido_md,
      v_tipo,
      v_audiencia,
      v_ubicaciones,
      v_fecha_inicio,
      v_fecha_fin,
      v_activo,
      v_prioridad,
      v_detalle,
      now(),
      now()
    )
    on conflict (inf_negocio, inf_slug) do update set
      inf_titulo = excluded.inf_titulo,
      inf_subtitulo = excluded.inf_subtitulo,
      inf_contenido_md = excluded.inf_contenido_md,
      inf_tipo = excluded.inf_tipo,
      inf_audiencia = excluded.inf_audiencia,
      inf_ubicaciones = excluded.inf_ubicaciones,
      inf_fecha_inicio = excluded.inf_fecha_inicio,
      inf_fecha_fin = excluded.inf_fecha_fin,
      inf_activo = excluded.inf_activo,
      inf_prioridad = excluded.inf_prioridad,
      inf_detalle = excluded.inf_detalle,
      inf_actualizado_en = now()
    returning * into v_reg;
  end if;

  return jsonb_build_object(
    'ok', true,
    'campana', to_jsonb(v_reg)
  );
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
end;
$$;

-- 3. RPC: Eliminar Campaña Informativa (por UUID o por Slug)
create or replace function comun_comercio.com_fn_eliminar_campana_informativa(
  p_negocio text,
  p_id_o_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_eliminados int;
begin
  if p_id_o_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    delete from comun_comercio.com_campana_informativa
    where inf_id = p_id_o_slug::uuid
      and inf_negocio = p_negocio;
  else
    delete from comun_comercio.com_campana_informativa
    where (inf_slug = p_id_o_slug or inf_id::text = p_id_o_slug)
      and inf_negocio = p_negocio;
  end if;

  get diagnostics v_eliminados = row_count;

  return jsonb_build_object(
    'ok', true,
    'eliminados', v_eliminados
  );
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
end;
$$;

-- 4. RPC: Alternar Activo / Inactivo
create or replace function comun_comercio.com_fn_alternar_activo_campana(
  p_negocio text,
  p_id_o_slug text,
  p_activo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_actualizados int;
begin
  if p_id_o_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update comun_comercio.com_campana_informativa
    set inf_activo = p_activo, inf_actualizado_en = now()
    where inf_id = p_id_o_slug::uuid
      and inf_negocio = p_negocio;
  else
    update comun_comercio.com_campana_informativa
    set inf_activo = p_activo, inf_actualizado_en = now()
    where (inf_slug = p_id_o_slug or inf_id::text = p_id_o_slug)
      and inf_negocio = p_negocio;
  end if;

  get diagnostics v_actualizados = row_count;

  return jsonb_build_object(
    'ok', true,
    'actualizados', v_actualizados,
    'inf_activo', p_activo
  );
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
end;
$$;

-- 5. RPC: Obtener Campañas con Filtros
create or replace function comun_comercio.com_fn_obtener_campanas_informativas(
  p_negocio text,
  p_audiencia text default 'TODOS',
  p_tipo text default null,
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_data jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(t) order by t.inf_prioridad desc, t.inf_fecha_inicio desc), '[]'::jsonb)
  into v_data
  from (
    select *
    from comun_comercio.com_campana_informativa
    where inf_negocio = p_negocio
      and (p_incluir_inactivos = true or (
        inf_activo = true
        and inf_fecha_inicio <= now()
        and (inf_fecha_fin is null or inf_fecha_fin >= now())
      ))
      and (p_tipo is null or inf_tipo = p_tipo)
      and (
        p_audiencia is null 
        or p_audiencia = 'TODOS' 
        or 'TODOS' = any(inf_audiencia) 
        or p_audiencia = any(inf_audiencia)
      )
  ) t;

  return v_data;
end;
$$;

-- 6. Permisos de ejecución
grant execute on function comun_comercio.com_fn_guardar_campana_informativa(jsonb) to authenticated, anon, service_role;
grant execute on function comun_comercio.com_fn_eliminar_campana_informativa(text, text) to authenticated, anon, service_role;
grant execute on function comun_comercio.com_fn_alternar_activo_campana(text, text, boolean) to authenticated, anon, service_role;
grant execute on function comun_comercio.com_fn_obtener_campanas_informativas(text, text, text, boolean) to authenticated, anon, service_role;
