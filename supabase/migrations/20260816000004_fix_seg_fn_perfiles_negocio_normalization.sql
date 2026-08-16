-- Migración: Normalización de negocio en consultas de perfiles, niveles y asignación de roles
-- Esquema: comun_seguridad

-- 1. seg_fn_perfiles: Obtener los perfiles del usuario actual con normalización de negocio
create or replace function comun_seguridad.seg_fn_perfiles(p_negocio text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.per_clave
  from comun_seguridad.seg_membresia m
  join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
  join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
  where m.mem_usuario_id = auth.uid()
    and (
      upper(m.mem_negocio) = upper(p_negocio)
      or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
      or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
      or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
      or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
    )
    and m.mem_estado = 'ACTIVO'
    and p.per_activo;
$$;

-- 2. seg_fn_perfiles_de: Obtener los perfiles de un usuario específico
create or replace function comun_seguridad.seg_fn_perfiles_de(p_usuario_id uuid, p_negocio text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.per_clave
  from comun_seguridad.seg_membresia m
  join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
  join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
  where m.mem_usuario_id = p_usuario_id
    and (
      upper(m.mem_negocio) = upper(p_negocio)
      or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
      or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
      or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
      or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
    )
    and m.mem_estado = 'ACTIVO'
    and p.per_activo;
$$;

-- 3. seg_fn_tiene_perfil: Verificar si el usuario tiene un perfil
create or replace function comun_seguridad.seg_fn_tiene_perfil(p_negocio text, p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from comun_seguridad.seg_fn_perfiles(p_negocio) c where upper(c) = upper(p_clave));
$$;

-- 4. seg_fn_nivel_maximo: Nivel jerárquico máximo con normalización
create or replace function comun_seguridad.seg_fn_nivel_maximo(p_negocio text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    case when comun_seguridad.seg_fn_es_superadmin() then 100 else 0 end,
    coalesce((
      select max(p.per_nivel)
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
      where m.mem_usuario_id = auth.uid()
        and (
          upper(m.mem_negocio) = upper(p_negocio)
          or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
          or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
          or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
          or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
        )
        and m.mem_estado = 'ACTIVO'
        and p.per_activo
    ), 0)
  );
$$;

-- 5. seg_fn_asignar_perfil: Asignación segura con reutilización de membresía existente
create or replace function comun_seguridad.seg_fn_asignar_perfil(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel_gestor integer;
  v_perfil record;
  v_membresia_id uuid;
  v_negocio_db text;
begin
  select per_id, per_nivel, per_activo into v_perfil
  from comun_seguridad.seg_perfil
  where upper(per_clave) = upper(p_perfil);

  if v_perfil.per_id is null or not v_perfil.per_activo then
    raise exception 'Perfil desconocido o inactivo: %', p_perfil;
  end if;

  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  if v_nivel_gestor < 80 then
    raise exception 'No autorizado para asignar perfiles en este negocio';
  end if;
  if v_perfil.per_nivel > v_nivel_gestor then
    raise exception 'No puedes asignar un perfil de jerarquia superior a la tuya (% > %)', v_perfil.per_nivel, v_nivel_gestor;
  end if;

  -- Buscar si ya existe membresía para este usuario con cualquier alias del negocio
  select mem_id, mem_negocio into v_membresia_id, v_negocio_db
  from comun_seguridad.seg_membresia
  where mem_usuario_id = p_usuario_id
    and (
      upper(mem_negocio) = upper(p_negocio)
      or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
      or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(mem_negocio) in ('FFH', 'FASTFIX'))
      or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(mem_negocio) in ('TNK', 'TINKAY'))
      or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(mem_negocio) in ('MRG', 'MARGARITAS'))
    )
  limit 1;

  if v_membresia_id is null then
    insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    values (p_usuario_id, p_negocio, p_perfil, 'ACTIVO')
    returning mem_id into v_membresia_id;
  else
    update comun_seguridad.seg_membresia
    set mem_actualizado_en = now(), mem_estado = 'ACTIVO'
    where mem_id = v_membresia_id;
  end if;

  insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
  values (v_membresia_id, v_perfil.per_id, auth.uid())
  on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
end;
$$;

-- 6. seg_fn_quitar_perfil: Retiro seguro de perfil
create or replace function comun_seguridad.seg_fn_quitar_perfil(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel_gestor integer;
  v_nivel_perfil integer;
begin
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  if v_nivel_gestor < 80 then
    raise exception 'No autorizado para quitar perfiles en este negocio';
  end if;

  select per_nivel into v_nivel_perfil from comun_seguridad.seg_perfil where upper(per_clave) = upper(p_perfil);
  if v_nivel_perfil is null then
    raise exception 'Perfil desconocido: %', p_perfil;
  end if;
  if v_nivel_perfil > v_nivel_gestor then
    raise exception 'No puedes quitar un perfil de jerarquia superior a la tuya';
  end if;

  if upper(p_perfil) = 'CLIENTE' then
    raise exception 'CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2)';
  end if;

  delete from comun_seguridad.seg_membresia_perfil mp
  using comun_seguridad.seg_membresia m, comun_seguridad.seg_perfil p
  where mp.mpe_membresia_id = m.mem_id
    and mp.mpe_perfil_id = p.per_id
    and m.mem_usuario_id = p_usuario_id
    and (
      upper(m.mem_negocio) = upper(p_negocio)
      or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
      or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
      or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
      or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
    )
    and upper(p.per_clave) = upper(p_perfil);
end;
$$;

grant execute on function comun_seguridad.seg_fn_perfiles(text) to authenticated;
grant execute on function comun_seguridad.seg_fn_perfiles_de(uuid, text) to authenticated;
grant execute on function comun_seguridad.seg_fn_tiene_perfil(text, text) to authenticated;
grant execute on function comun_seguridad.seg_fn_nivel_maximo(text) to authenticated;
grant execute on function comun_seguridad.seg_fn_asignar_perfil(uuid, text, text) to authenticated;
grant execute on function comun_seguridad.seg_fn_quitar_perfil(uuid, text, text) to authenticated;
