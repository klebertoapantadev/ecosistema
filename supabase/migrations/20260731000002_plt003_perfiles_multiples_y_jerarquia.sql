-- PLT-003 reglas 3, 4 y 5: perfiles multiples por usuario y negocio, escala
-- jerarquica 1-100, y techo jerarquico en la asignacion.
--
-- Que bloqueaba: `seg_membresia.mem_rol` es UNA columna de texto con `unique
-- (mem_usuario_id, mem_negocio)`. El ejemplo textual del requerimiento --
-- "un usuario en Tranqi puede ostentar simultaneamente CLIENTE y ABOGADO" --
-- no se podia representar. Y sin niveles no existia el numero con el que
-- comparar en la regla 5.
--
-- Estrategia expand/contract, no reemplazo directo: se anade el modelo nuevo,
-- se migran las filas vivas y los lectores pasan a el, pero `mem_rol` se
-- conserva como columna deprecada. Retirarla es un paso posterior, cuando
-- produccion lleve tiempo leyendo del modelo nuevo. Con datos reales delante,
-- borrar la unica fuente del dato anterior en la misma migracion que introduce
-- la nueva no deja a donde volver.

-- ═══════════ Catalogo de perfiles (regla 4) ═══════════
-- Estandarizado por la plataforma: los niveles NO los define cada negocio, o
-- la regla 5 dejaria de ser comparable entre productos.
create table comun_seguridad.seg_perfil (
  per_id uuid primary key default gen_random_uuid(),
  per_secuencial bigint generated always as identity,
  per_clave text not null unique,
  per_nombre text not null,
  per_nivel integer not null check (per_nivel between 1 and 100),
  -- SUPERADMIN figura en la escala porque la regla 4 lo lista como techo (100)
  -- y el techo tiene que ser comparable, pero NO es asignable como perfil de
  -- negocio: es un flag de plataforma (usu_superadmin_plataforma). Sin esta
  -- columna habria que tratarlo como caso especial en cada consulta.
  per_asignable boolean not null default true,
  per_activo boolean not null default true,
  per_detalle_perfil jsonb not null default '{}'::jsonb,
  per_creado_en timestamptz not null default now(),
  per_actualizado_en timestamptz not null default now()
);

alter table comun_seguridad.seg_perfil enable row level security;

-- Catalogo de lectura publica para cualquier sesion: son etiquetas y niveles,
-- no datos de nadie. Sin politica de escritura -- el catalogo lo gobierna la
-- plataforma via migracion (regla 1), no un administrador de negocio.
create policy seg_perfil_lectura on comun_seguridad.seg_perfil
  for select to authenticated using (true);

create trigger trg_auditoria_seg_perfil after insert or update or delete on comun_seguridad.seg_perfil for each row execute function comun_auditoria.aud_fn_auditar_tabla();

insert into comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_asignable) values
  ('CLIENTE',       'Cliente',       1,   true),
  ('OPERADOR',      'Operador',      30,  true),
  ('AUXILIAR',      'Auxiliar',      30,  true),
  ('TECNICO',       'Técnico',       50,  true),
  ('ABOGADO',       'Abogado',       50,  true),
  ('ADMINISTRADOR', 'Administrador', 80,  true),
  ('SUPERADMIN',    'SuperAdmin',    100, false)
on conflict (per_clave) do nothing;

-- ═══════════ Perfiles de una membresia (regla 3) ═══════════
-- Tabla de union explicita, no un array de claves en seg_membresia: lo exige
-- §2 del estandar de nomenclatura, y ademas permite auditar quien asigno que.
create table comun_seguridad.seg_membresia_perfil (
  mpe_id uuid primary key default gen_random_uuid(),
  mpe_secuencial bigint generated always as identity,
  mpe_membresia_id uuid not null references comun_seguridad.seg_membresia(mem_id) on delete cascade,
  mpe_perfil_id uuid not null references comun_seguridad.seg_perfil(per_id),
  mpe_asignado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  mpe_detalle_membresia_perfil jsonb not null default '{}'::jsonb,
  mpe_creado_en timestamptz not null default now(),
  mpe_actualizado_en timestamptz not null default now(),
  unique (mpe_membresia_id, mpe_perfil_id)
);

create index seg_membresia_perfil_membresia_idx on comun_seguridad.seg_membresia_perfil (mpe_membresia_id);

alter table comun_seguridad.seg_membresia_perfil enable row level security;

-- El usuario ve sus propios perfiles; el admin del negocio ve los de su
-- negocio. La escritura NO tiene politica: pasa por los RPC de abajo, que son
-- los que aplican el techo jerarquico (regla 5). Un update directo lo
-- saltaria.
create policy seg_membresia_perfil_lectura on comun_seguridad.seg_membresia_perfil
  for select using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_id = mpe_membresia_id
        and (m.mem_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_admin_negocio(m.mem_negocio))
    )
  );

create trigger trg_auditoria_seg_membresia_perfil after insert or update or delete on comun_seguridad.seg_membresia_perfil for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_seguridad.seg_perfil to authenticated;
grant select on comun_seguridad.seg_membresia_perfil to authenticated;

-- ═══════════ Migracion de las filas vivas ═══════════
-- Cada membresia existente pasa a tener su mem_rol como perfil. Se ignoran
-- valores que no esten en el catalogo: si apareciera alguno, es un dato
-- invalido preexistente y es mejor que salte a la vista al consultar que
-- inventarle un nivel aqui.
insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
select m.mem_id, p.per_id
from comun_seguridad.seg_membresia m
join comun_seguridad.seg_perfil p on p.per_clave = m.mem_rol
on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;

comment on column comun_seguridad.seg_membresia.mem_rol is
  'DEPRECADA (PLT-003 regla 3). La verdad esta en seg_membresia_perfil. Se conserva durante la transicion expand/contract y se retirara en una migracion posterior.';

-- ═══════════ Consultas de perfil y jerarquia ═══════════
-- Claves de perfil que el usuario actual tiene en un negocio.
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
    and m.mem_negocio = p_negocio
    and m.mem_estado = 'ACTIVO'
    and p.per_activo;
$$;

create or replace function comun_seguridad.seg_fn_tiene_perfil(p_negocio text, p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from comun_seguridad.seg_fn_perfiles(p_negocio) c where c = p_clave);
$$;

-- Nivel jerarquico maximo del usuario actual en un negocio -- el numero contra
-- el que se compara en la regla 5. El superadmin de plataforma es el techo
-- (100) en cualquier negocio, sin necesidad de membresia.
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
        and m.mem_negocio = p_negocio
        and m.mem_estado = 'ACTIVO'
        and p.per_activo
    ), 0)
  );
$$;

revoke execute on function comun_seguridad.seg_fn_perfiles(text) from public;
revoke execute on function comun_seguridad.seg_fn_tiene_perfil(text, text) from public;
revoke execute on function comun_seguridad.seg_fn_nivel_maximo(text) from public;
grant execute on function comun_seguridad.seg_fn_perfiles(text) to authenticated;
grant execute on function comun_seguridad.seg_fn_tiene_perfil(text, text) to authenticated;
grant execute on function comun_seguridad.seg_fn_nivel_maximo(text) to authenticated;

-- ═══════════ Quien es administrador, ahora por perfil ═══════════
-- Reescrita sobre la tabla de union: un usuario con CLIENTE + ADMINISTRADOR
-- dejaba de ser admin en el modelo viejo si mem_rol guardaba el otro valor.
create or replace function comun_seguridad.seg_fn_es_admin_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_superadmin()
      or exists (
        select 1
        from comun_seguridad.seg_membresia m
        join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
        join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
        where m.mem_usuario_id = auth.uid()
          and m.mem_negocio = p_negocio
          and m.mem_estado = 'ACTIVO'
          and p.per_clave = 'ADMINISTRADOR'
      );
$$;

-- ═══════════ Asignar y quitar perfiles, con techo jerarquico (regla 5) ═══════════
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
  v_perfil comun_seguridad.seg_perfil;
  v_nivel_gestor integer;
  v_membresia_id uuid;
begin
  select * into v_perfil from comun_seguridad.seg_perfil where per_clave = p_perfil and per_activo;
  if v_perfil.per_id is null then
    raise exception 'Perfil desconocido: %', p_perfil;
  end if;

  if not v_perfil.per_asignable then
    raise exception '% no es asignable como perfil de negocio (es un flag de plataforma)', p_perfil;
  end if;

  -- Regla 5: el gestor no puede asignar por encima de su propia jerarquia, ni
  -- auto-elevarse. Se compara contra el nivel maximo que ostenta EN ESE
  -- negocio, no en el ecosistema (regla 6, aislamiento).
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  if v_nivel_gestor < 80 then
    raise exception 'No autorizado para asignar perfiles en este negocio';
  end if;
  if v_perfil.per_nivel > v_nivel_gestor then
    raise exception 'No puedes asignar un perfil de jerarquia superior a la tuya (% > %)', v_perfil.per_nivel, v_nivel_gestor;
  end if;

  -- La membresia se crea si no existe: asignar un perfil a quien todavia no es
  -- miembro del negocio es alta + perfil, no un error.
  insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
  values (p_usuario_id, p_negocio, p_perfil, 'ACTIVO')
  on conflict (mem_usuario_id, mem_negocio) do update set mem_actualizado_en = now()
  returning mem_id into v_membresia_id;

  insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
  values (v_membresia_id, v_perfil.per_id, auth.uid())
  on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
end;
$$;

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

  select per_nivel into v_nivel_perfil from comun_seguridad.seg_perfil where per_clave = p_perfil;
  if v_nivel_perfil is null then
    raise exception 'Perfil desconocido: %', p_perfil;
  end if;
  if v_nivel_perfil > v_nivel_gestor then
    raise exception 'No puedes quitar un perfil de jerarquia superior a la tuya';
  end if;

  -- CLIENTE es el nivel base obligatorio (regla 2): se asigna al registrarse y
  -- no se retira, o el usuario quedaria miembro del negocio sin ningun perfil.
  if p_perfil = 'CLIENTE' then
    raise exception 'CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2)';
  end if;

  delete from comun_seguridad.seg_membresia_perfil mp
  using comun_seguridad.seg_membresia m, comun_seguridad.seg_perfil p
  where mp.mpe_membresia_id = m.mem_id
    and mp.mpe_perfil_id = p.per_id
    and m.mem_usuario_id = p_usuario_id
    and m.mem_negocio = p_negocio
    and p.per_clave = p_perfil;
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asignar_perfil(uuid, text, text) from public;
revoke execute on function comun_seguridad.seg_fn_quitar_perfil(uuid, text, text) from public;
grant execute on function comun_seguridad.seg_fn_asignar_perfil(uuid, text, text) to authenticated;
grant execute on function comun_seguridad.seg_fn_quitar_perfil(uuid, text, text) to authenticated;

-- ═══════════ Perfiles de otro usuario, para la consola de gestion ═══════════
-- La UI necesita listar los perfiles de CADA usuario del negocio, y las
-- funciones de arriba responden siempre sobre auth.uid(). Autorizada al admin
-- del negocio, que es quien ve esa pantalla.
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
    and m.mem_negocio = p_negocio
    and p.per_activo
    and comun_seguridad.seg_fn_es_admin_negocio(p_negocio);
$$;

revoke execute on function comun_seguridad.seg_fn_perfiles_de(uuid, text) from public;
grant execute on function comun_seguridad.seg_fn_perfiles_de(uuid, text) to authenticated;
