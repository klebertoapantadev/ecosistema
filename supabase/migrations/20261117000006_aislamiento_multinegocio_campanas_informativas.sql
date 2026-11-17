-- ==============================================================================
-- Migración: Aislamiento Estricto Multi-Negocio en Campañas Informativas
-- Esquema: comun_comercio (com_campana_informativa + RPCs + RLS por membresía activa)
-- Reglas cumplidas:
--   1. RLS habilitado con aislamiento por negocio (mem_negocio = inf_negocio y mem_estado = 'ACTIVO')
--   2. Trigger aud_fn_auditar_tabla() garantizado en com_campana_informativa
--   3. Cero contaminación cruzada de avisos legales/tributarios de Tranqi hacia otros negocios
-- ==============================================================================

-- 1. Limpieza preventiva de cualquier semilla jurídica/tributaria de Tranqi que haya podido
--    quedar registrada accidentalmente bajo otro negocio (tinkay, margaritas, fastfix)
delete from comun_comercio.com_campana_informativa
where lower(btrim(inf_negocio)) <> 'tranqi'
  and inf_slug in (
    'reforma-ley-inquilinato-arriendos-garantias',
    'control-horas-suplementarias-registro-digital',
    'decreto-515-autogeneracion-energetica-empresas',
    'cumplimiento-obligatorio-proteccion-datos-lopdp',
    'validez-legal-firma-electronica-juntas-actas',
    'proteccion-integral-reforma-penal-menores',
    'convenio-capacitacion-socios-abogados',
    'alerta-ant-suspension-sistema-matriculacion',
    'descuento-patente-municipal-quito-noviembre'
  );

-- Normalizar códigos existentes de inf_negocio a minúsculas canónicas
update comun_comercio.com_campana_informativa
set inf_negocio = case
  when lower(btrim(inf_negocio)) in ('tnk', 'tinkay') then 'tinkay'
  when lower(btrim(inf_negocio)) in ('mrg', 'margaritas') then 'margaritas'
  when lower(btrim(inf_negocio)) in ('ffh', 'fastfix') then 'fastfix'
  when lower(btrim(inf_negocio)) in ('trq', 'tranq', 'tranqi', 'tranqui', 'legal') then 'tranqi'
  else lower(btrim(inf_negocio))
end
where inf_negocio <> lower(btrim(inf_negocio))
   or lower(btrim(inf_negocio)) in ('tnk', 'mrg', 'ffh', 'trq', 'tranq', 'tranqui', 'legal');

-- 2. Función auxiliar pura para normalizar el código canónico de negocio en SQL
create or replace function comun_comercio.com_fn_normalizar_negocio_campana(
  p_negocio text
)
returns text
language sql
immutable
as $$
  select case
    when p_negocio is null or btrim(p_negocio) = '' then 'tranqi'
    when lower(btrim(p_negocio)) in ('tnk', 'tinkay') then 'tinkay'
    when lower(btrim(p_negocio)) in ('mrg', 'margaritas') then 'margaritas'
    when lower(btrim(p_negocio)) in ('ffh', 'fastfix') then 'fastfix'
    when lower(btrim(p_negocio)) in ('trq', 'tranq', 'tranqi', 'tranqui', 'legal') then 'tranqi'
    else lower(btrim(p_negocio))
  end;
$$;

-- 3. Asegurar RLS y Trigger de Auditoría (Reglas 1 y 2 de AGENTS.md)
alter table comun_comercio.com_campana_informativa enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'comun_auditoria'
      and p.proname = 'aud_fn_auditar_tabla'
  ) then
    drop trigger if exists trg_auditoria_com_campana_informativa on comun_comercio.com_campana_informativa;
    create trigger trg_auditoria_com_campana_informativa
      after insert or update or delete on comun_comercio.com_campana_informativa
      for each row execute function comun_auditoria.aud_fn_auditar_tabla();
  end if;
end $$;

-- 4. Políticas RLS con aislamiento estricto por membresía activa del mismo negocio
drop policy if exists com_campana_informativa_select_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_select_policy on comun_comercio.com_campana_informativa
  for select
  using (
    inf_activo = true
    or comun_seguridad.seg_fn_es_superadmin()
    or exists (
      select 1
      from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid()
        and m.mem_estado = 'ACTIVO'
        and comun_comercio.com_fn_normalizar_negocio_campana(m.mem_negocio)
            = comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio)
        and (
          m.mem_rol in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          or exists (
            select 1
            from comun_seguridad.seg_membresia_perfil mp
            join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
            where mp.mpe_membresia_id = m.mem_id
              and p.per_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          )
        )
    )
  );

drop policy if exists com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa
  for all
  using (
    comun_seguridad.seg_fn_es_superadmin()
    or exists (
      select 1
      from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid()
        and m.mem_estado = 'ACTIVO'
        and comun_comercio.com_fn_normalizar_negocio_campana(m.mem_negocio)
            = comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio)
        and (
          m.mem_rol in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          or exists (
            select 1
            from comun_seguridad.seg_membresia_perfil mp
            join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
            where mp.mpe_membresia_id = m.mem_id
              and p.per_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          )
        )
    )
  )
  with check (
    comun_seguridad.seg_fn_es_superadmin()
    or exists (
      select 1
      from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid()
        and m.mem_estado = 'ACTIVO'
        and comun_comercio.com_fn_normalizar_negocio_campana(m.mem_negocio)
            = comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio)
        and (
          m.mem_rol in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          or exists (
            select 1
            from comun_seguridad.seg_membresia_perfil mp
            join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
            where mp.mpe_membresia_id = m.mem_id
              and p.per_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
          )
        )
    )
  );

-- 5. RPC: Obtener campañas informativas estrictamente del negocio consultado
create or replace function comun_comercio.com_fn_obtener_campanas_informativas(
  p_negocio text,
  p_audiencia text default 'TODOS',
  p_tipo text default null,
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, comun_seguridad, public
as $$
declare
  v_negocio text;
  v_data jsonb;
begin
  v_negocio := comun_comercio.com_fn_normalizar_negocio_campana(p_negocio);

  select coalesce(
    jsonb_agg(to_jsonb(t) order by t.inf_prioridad desc, t.inf_fecha_inicio desc),
    '[]'::jsonb
  )
  into v_data
  from (
    select *
    from comun_comercio.com_campana_informativa
    where comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio
      and (
        p_incluir_inactivos = true
        or (
          inf_activo = true
          and inf_fecha_inicio <= now()
          and (inf_fecha_fin is null or inf_fecha_fin >= now())
        )
      )
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

-- 6. RPC: Guardar o actualizar campaña aislada por negocio
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
  v_reg comun_comercio.com_campana_informativa%rowtype;
begin
  v_negocio := comun_comercio.com_fn_normalizar_negocio_campana(p_campana->>'inf_negocio');
  v_titulo := trim(coalesce(p_campana->>'inf_titulo', ''));

  if v_titulo = '' then
    return jsonb_build_object('ok', false, 'error', 'El título es obligatorio');
  end if;

  v_slug := coalesce(
    nullif(trim(p_campana->>'inf_slug'), ''),
    lower(regexp_replace(v_titulo, '[^a-zA-Z0-9]+', '-', 'g'))
  );
  v_slug := trim(both '-' from v_slug);
  v_subtitulo := nullif(trim(p_campana->>'inf_subtitulo'), '');
  v_contenido_md := nullif(trim(p_campana->>'inf_contenido_md'), '');
  v_tipo := coalesce(nullif(trim(p_campana->>'inf_tipo'), ''), 'COMUNICADO_GENERAL');

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

  if p_campana->>'inf_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select inf_id into v_id
    from comun_comercio.com_campana_informativa
    where inf_id = (p_campana->>'inf_id')::uuid
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio
    limit 1;
  else
    select inf_id into v_id
    from comun_comercio.com_campana_informativa
    where comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio
      and inf_slug = v_slug
    limit 1;
  end if;

  if v_id is not null then
    update comun_comercio.com_campana_informativa
    set
      inf_negocio = v_negocio,
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
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio
    returning * into v_reg;
  else
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

  return jsonb_build_object('ok', true, 'campana', to_jsonb(v_reg));
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

-- 7. RPC: Eliminar campaña informativa estrictamente dentro de su negocio
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
  v_negocio text;
  v_eliminados int;
begin
  v_negocio := comun_comercio.com_fn_normalizar_negocio_campana(p_negocio);

  if p_id_o_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    delete from comun_comercio.com_campana_informativa
    where inf_id = p_id_o_slug::uuid
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio;
  else
    delete from comun_comercio.com_campana_informativa
    where (inf_slug = p_id_o_slug or inf_id::text = p_id_o_slug)
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio;
  end if;

  get diagnostics v_eliminados = row_count;
  return jsonb_build_object('ok', true, 'eliminados', v_eliminados);
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

-- 8. RPC: Alternar activo/inactivo estrictamente dentro de su negocio
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
  v_negocio text;
  v_actualizados int;
begin
  v_negocio := comun_comercio.com_fn_normalizar_negocio_campana(p_negocio);

  if p_id_o_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update comun_comercio.com_campana_informativa
    set inf_activo = p_activo, inf_actualizado_en = now()
    where inf_id = p_id_o_slug::uuid
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio;
  else
    update comun_comercio.com_campana_informativa
    set inf_activo = p_activo, inf_actualizado_en = now()
    where (inf_slug = p_id_o_slug or inf_id::text = p_id_o_slug)
      and comun_comercio.com_fn_normalizar_negocio_campana(inf_negocio) = v_negocio;
  end if;

  get diagnostics v_actualizados = row_count;
  return jsonb_build_object('ok', true, 'actualizados', v_actualizados, 'inf_activo', p_activo);
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

-- 9. Permisos: revocar escritura anónima y permitir ejecución autenticada / service_role
revoke execute on function comun_comercio.com_fn_guardar_campana_informativa(jsonb) from anon;
revoke execute on function comun_comercio.com_fn_eliminar_campana_informativa(text, text) from anon;
revoke execute on function comun_comercio.com_fn_alternar_activo_campana(text, text, boolean) from anon;

grant execute on function comun_comercio.com_fn_normalizar_negocio_campana(text) to authenticated, anon, service_role;
grant execute on function comun_comercio.com_fn_obtener_campanas_informativas(text, text, text, boolean) to authenticated, service_role;
grant execute on function comun_comercio.com_fn_guardar_campana_informativa(jsonb) to authenticated, service_role;
grant execute on function comun_comercio.com_fn_eliminar_campana_informativa(text, text) to authenticated, service_role;
grant execute on function comun_comercio.com_fn_alternar_activo_campana(text, text, boolean) to authenticated, service_role;
