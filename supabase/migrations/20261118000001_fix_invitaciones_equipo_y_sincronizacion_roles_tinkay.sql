-- ==============================================================================
-- Migración: 20261118000001_fix_invitaciones_equipo_y_sincronizacion_roles_tinkay.sql
-- Módulo: Gestión de Usuarios, Invitaciones de Equipo y Aislamiento de Roles (PLT-003 / PLT-011 / TNK-005)
-- Descripción:
--   1. Repara permisos administrativos en BDD de `tinkay.uio@gmail.com` y `kleber.toapanta.ch@gmail.com`
--      en `tinkay` sin contaminar otros negocios (`seg_fn_es_admin_negocio`, `seg_fn_es_superadmin_negocio`,
--      `seg_fn_nivel_maximo`, `seg_fn_obtener_rol_operativo_negocio`, `seg_fn_es_admin_negocio_omnicanal`).
--   2. Evita que en `tinkay` cuentas SuperAdmin de otros negocios hereden `SUPERADMIN` sin asignación explícita,
--      respetando el rol operativo asignado por invitación (ej. `VENTAS`).
--   3. Crea RPCs transaccionales `SECURITY DEFINER` (Regla 3 y Regla 5 de AGENTS.md, cero dependencia de `service_role` en Vercel):
--      - `comun_seguridad.seg_fn_invitar_miembro_equipo`
--      - `comun_seguridad.seg_fn_eliminar_invitacion_equipo`
--      - `comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay`
--      - `comun_seguridad.seg_fn_asignar_perfil_negocio`
--      - `comun_seguridad.seg_fn_quitar_perfil_negocio`
--      - `comun_seguridad.seg_fn_listar_usuarios_negocio`
--   4. Regulariza la invitación activa de `familiammtg@gmail.com` con el rol `VENTAS` en `tinkay`.
-- ==============================================================================

-- 1. Semilla completa e idempotente de perfiles operativos en comun_seguridad.seg_perfil
insert into comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_activo, per_asignable)
values
  ('CLIENTE',          'Cliente',                    10,  true,  true),
  ('DELIVERY_EXTERNO', 'Delivery Subcontratado',     12,  true,  true),
  ('DELIVERY',         'Delivery Interno',           15,  true,  true),
  ('TALLER',           'Taller Floral',              18,  true,  true),
  ('VENTAS',           'Ventas / Asesor Comercial',  20,  true,  true),
  ('OPERADOR',         'Operador',                   30,  true,  true),
  ('ADMINISTRADOR',    'Administrador',              80,  true,  true),
  ('SUPERADMIN',       'SuperAdmin',                 100, true,  false)
on conflict (per_clave) do update set
  per_nombre = excluded.per_nombre,
  per_nivel = case
    when comun_seguridad.seg_perfil.per_clave = 'CLIENTE' then comun_seguridad.seg_perfil.per_nivel
    else excluded.per_nivel
  end,
  per_activo = true,
  per_asignable = case
    when comun_seguridad.seg_perfil.per_clave = 'SUPERADMIN' then false
    else true
  end;

-- Asegurar fila base de tinkay en comun_configuracion.cfg_negocio
insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
values ('tinkay', 'Tinkay Floristería')
on conflict (cfg_negocio) do nothing;

-- 2. Reparar membresía y perfiles de propietarios de Tinkay (`tinkay.uio@gmail.com` y `kleber.toapanta.ch@gmail.com`)
do $$
declare
  v_rec record;
  v_mem_id uuid;
  v_per_super uuid;
  v_per_admin uuid;
  v_per_cliente uuid;
begin
  select per_id into v_per_super from comun_seguridad.seg_perfil where per_clave = 'SUPERADMIN';
  select per_id into v_per_admin from comun_seguridad.seg_perfil where per_clave = 'ADMINISTRADOR';
  select per_id into v_per_cliente from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  for v_rec in
    select usu_id, lower(btrim(usu_correo)) as correo
    from comun_seguridad.seg_usuario
    where lower(btrim(usu_correo)) in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com')
  loop
    select mem_id into v_mem_id
    from comun_seguridad.seg_membresia
    where mem_usuario_id = v_rec.usu_id
      and comun_seguridad.seg_fn_normalizar_negocio(mem_negocio) = 'tinkay'
    order by (mem_negocio = 'tinkay') desc, mem_creado_en asc
    limit 1;

    if v_mem_id is null then
      insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      values (v_rec.usu_id, 'tinkay', 'SUPERADMIN', 'ACTIVO')
      on conflict (mem_usuario_id, mem_negocio) do update
        set mem_rol = 'SUPERADMIN',
            mem_estado = 'ACTIVO',
            mem_actualizado_en = now()
      returning mem_id into v_mem_id;
    else
      update comun_seguridad.seg_membresia
         set mem_negocio = 'tinkay',
             mem_rol = 'SUPERADMIN',
             mem_estado = 'ACTIVO',
             mem_actualizado_en = now()
       where mem_id = v_mem_id;
    end if;

    if v_mem_id is not null then
      if v_per_super is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_super)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;
      if v_per_admin is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_admin)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;
      if v_per_cliente is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_cliente)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;
    end if;

    update comun_seguridad.seg_usuario
       set usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object('roles_explicitos_tinkay', true),
           usu_actualizado_en = now()
     where usu_id = v_rec.usu_id;
  end loop;
end $$;

-- 3. Funciones canónicas de autorización multi-negocio con aislamiento estricto para Tinkay
create or replace function comun_seguridad.seg_fn_es_propietario_tinkay(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = coalesce(p_uid, auth.uid())
      and lower(btrim(coalesce(u.usu_correo, ''))) in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com')
  );
$$;

revoke execute on function comun_seguridad.seg_fn_es_propietario_tinkay(uuid) from public;
grant execute on function comun_seguridad.seg_fn_es_propietario_tinkay(uuid) to anon, authenticated, service_role;

create or replace function comun_seguridad.seg_fn_es_superadmin_negocio(p_negocio text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
begin
  if v_uid is null then
    return false;
  end if;

  if v_neg = 'tinkay' then
    return comun_seguridad.seg_fn_es_propietario_tinkay(v_uid);
  end if;

  if comun_seguridad.seg_fn_es_superadmin() then
    return true;
  end if;

  return exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = v_uid
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
      and m.mem_estado = 'ACTIVO'
      and (
        upper(coalesce(m.mem_rol, '')) = 'SUPERADMIN'
        or upper(coalesce(p.per_clave, '')) = 'SUPERADMIN'
      )
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_es_superadmin_negocio(text) from public;
grant execute on function comun_seguridad.seg_fn_es_superadmin_negocio(text) to anon, authenticated, service_role;

create or replace function comun_seguridad.seg_fn_es_admin_negocio(p_negocio text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_explicito_tinkay boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  if v_neg = 'tinkay' then
    if comun_seguridad.seg_fn_es_propietario_tinkay(v_uid) then
      return true;
    end if;

    select coalesce((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false)
      into v_explicito_tinkay
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_uid;

    if not coalesce(v_explicito_tinkay, false) then
      return false;
    end if;

    return exists (
      select 1
      from comun_seguridad.seg_membresia m
      left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
      where m.mem_usuario_id = v_uid
        and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = 'tinkay'
        and m.mem_estado = 'ACTIVO'
        and (
          upper(coalesce(m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
          or upper(coalesce(p.per_clave, '')) in ('ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
        )
    );
  end if;

  if comun_seguridad.seg_fn_es_superadmin() then
    return true;
  end if;

  return exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = v_uid
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
      and m.mem_estado = 'ACTIVO'
      and (
        upper(coalesce(m.mem_rol, '')) in ('ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
        or upper(coalesce(p.per_clave, '')) in ('ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
      )
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_es_admin_negocio(text) from public;
grant execute on function comun_seguridad.seg_fn_es_admin_negocio(text) to anon, authenticated, service_role;

create or replace function comun_seguridad.seg_fn_es_admin_negocio_omnicanal(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_admin_negocio(p_negocio);
$$;

revoke execute on function comun_seguridad.seg_fn_es_admin_negocio_omnicanal(text) from public;
grant execute on function comun_seguridad.seg_fn_es_admin_negocio_omnicanal(text) to authenticated, service_role;

create or replace function comun_seguridad.seg_fn_obtener_rol_operativo_negocio(p_negocio text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_explicito_tinkay boolean := false;
  v_roles text[];
begin
  if v_uid is null then
    return 'ANONIMO';
  end if;

  if v_neg = 'tinkay' then
    if comun_seguridad.seg_fn_es_propietario_tinkay(v_uid) then
      return 'SUPERADMIN';
    end if;

    select coalesce((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false)
      into v_explicito_tinkay
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_uid;
  else
    if comun_seguridad.seg_fn_es_superadmin() then
      return 'SUPERADMIN';
    end if;
  end if;

  select coalesce(
    array_agg(distinct upper(r.clave)) filter (where r.clave is not null and btrim(r.clave) <> ''),
    array[]::text[]
  )
  into v_roles
  from (
    select m.mem_rol as clave
      from comun_seguridad.seg_membresia m
     where m.mem_usuario_id = v_uid
       and m.mem_estado = 'ACTIVO'
       and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
    union all
    select p.per_clave as clave
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
     where m.mem_usuario_id = v_uid
       and m.mem_estado = 'ACTIVO'
       and p.per_activo = true
       and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
  ) r;

  if v_neg = 'tinkay' and not coalesce(v_explicito_tinkay, false) then
    v_roles := array_remove(array_remove(array_remove(v_roles, 'SUPERADMIN'), 'ADMINISTRADOR'), 'ADMIN');
  elsif v_neg = 'tinkay' then
    v_roles := array_remove(v_roles, 'SUPERADMIN');
  end if;

  if v_roles && array['SUPERADMIN'] then
    return 'SUPERADMIN';
  elsif v_roles && array['ADMINISTRADOR', 'ADMIN'] then
    return 'ADMINISTRADOR';
  elsif v_roles && array['OPERADOR', 'AUXILIAR', 'TECNICO'] then
    return 'OPERADOR';
  elsif v_roles && array['VENTAS', 'VENDEDOR', 'ASESOR'] then
    return 'VENTAS';
  elsif v_roles && array['TALLER', 'FLORISTA'] then
    return 'TALLER';
  elsif v_roles && array['DELIVERY', 'REPARTIDOR'] then
    return 'DELIVERY';
  elsif v_roles && array['DELIVERY_EXTERNO', 'SUBCONTRATADO'] then
    return 'DELIVERY_EXTERNO';
  end if;

  return 'CLIENTE';
end;
$$;

grant execute on function comun_seguridad.seg_fn_obtener_rol_operativo_negocio(text) to authenticated, service_role;

create or replace function comun_seguridad.seg_fn_nivel_maximo(p_negocio text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
begin
  if auth.uid() is null then
    return 0;
  end if;

  if v_neg = 'tinkay' then
    v_rol := comun_seguridad.seg_fn_obtener_rol_operativo_negocio('tinkay');
    return case v_rol
      when 'SUPERADMIN' then 100
      when 'ADMINISTRADOR' then 80
      when 'OPERADOR' then 30
      when 'VENTAS' then 20
      when 'TALLER' then 18
      when 'DELIVERY' then 15
      when 'DELIVERY_EXTERNO' then 12
      else 10
    end;
  end if;

  return greatest(
    case when comun_seguridad.seg_fn_es_superadmin() then 100 else 0 end,
    coalesce((
      select max(p.per_nivel)
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
      where m.mem_usuario_id = auth.uid()
        and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
        and m.mem_estado = 'ACTIVO'
        and p.per_activo
    ), 0)
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_nivel_maximo(text) from public;
grant execute on function comun_seguridad.seg_fn_nivel_maximo(text) to authenticated, service_role;

-- Actualizar políticas RLS de seg_usuario y seg_membresia para tolerar variantes de negocio ('tinkay' / 'TINKAY' / 'tnk')
drop policy if exists seg_usuario_admin_select on comun_seguridad.seg_usuario;
create policy seg_usuario_admin_select on comun_seguridad.seg_usuario
  for select using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = seg_usuario.usu_id
        and comun_seguridad.seg_fn_es_admin_negocio(comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio))
    )
  );

drop policy if exists seg_membresia_admin_select on comun_seguridad.seg_membresia;
create policy seg_membresia_admin_select on comun_seguridad.seg_membresia
  for select using (comun_seguridad.seg_fn_es_admin_negocio(comun_seguridad.seg_fn_normalizar_negocio(mem_negocio)));

drop policy if exists seg_membresia_admin_todo on comun_seguridad.seg_membresia;
create policy seg_membresia_admin_todo on comun_seguridad.seg_membresia
  for all using (comun_seguridad.seg_fn_es_admin_negocio(comun_seguridad.seg_fn_normalizar_negocio(mem_negocio)))
  with check (comun_seguridad.seg_fn_es_admin_negocio(comun_seguridad.seg_fn_normalizar_negocio(mem_negocio)));

-- ==============================================================================
-- 4. RPC TRANSACCIONAL: Invitar miembro del equipo por correo y rol
-- ==============================================================================
create or replace function comun_seguridad.seg_fn_invitar_miembro_equipo(
  p_negocio text,
  p_correo text,
  p_nombre text default null,
  p_rol text default 'VENTAS'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_rol text := upper(btrim(coalesce(p_rol, 'VENTAS')));
  v_correo_admin text;
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
  v_usr record;
  v_mem_id uuid;
  v_per_rol_id uuid;
  v_per_cliente_id uuid;
  v_aplicado_inmediato boolean := false;
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_prev_inv jsonb;
  v_nueva_inv jsonb;
  v_nuevas_inv jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión expirada. Vuelve a iniciar sesión.');
  end if;

  if not comun_seguridad.seg_fn_es_admin_negocio(v_neg) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador de la tienda puede enviar invitaciones de equipo.');
  end if;

  if v_correo = '' or position('@' in v_correo) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un correo electrónico válido.');
  end if;

  if v_rol not in ('VENTAS', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO', 'OPERADOR', 'ADMINISTRADOR') then
    return jsonb_build_object('ok', false, 'error', 'Selecciona un rol válido para el portal.');
  end if;

  select coalesce(u.usu_correo, 'admin@tinkay.ec')
    into v_correo_admin
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select per_id into v_per_rol_id from comun_seguridad.seg_perfil where per_clave = v_rol;
  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  -- Verificar si el correo ya existe en seg_usuario y ya tiene membresía en este negocio
  select u.usu_id, u.usu_nombres, u.usu_apellidos, u.usu_detalle_usuario
    into v_usr
    from comun_seguridad.seg_usuario u
   where lower(btrim(u.usu_correo)) = v_correo
   limit 1;

  if v_usr.usu_id is not null then
    select m.mem_id into v_mem_id
    from comun_seguridad.seg_membresia m
    where m.mem_usuario_id = v_usr.usu_id
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
    order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
    limit 1;

    if v_mem_id is not null then
      update comun_seguridad.seg_membresia
         set mem_negocio = v_neg,
             mem_rol = v_rol,
             mem_estado = 'ACTIVO',
             mem_actualizado_en = v_ahora
       where mem_id = v_mem_id;

      -- Reemplazar perfiles operativos anteriores en esta membresía conservando CLIENTE + nuevo rol invitado
      delete from comun_seguridad.seg_membresia_perfil mp
      using comun_seguridad.seg_perfil p
      where mp.mpe_membresia_id = v_mem_id
        and mp.mpe_perfil_id = p.per_id
        and p.per_clave <> 'CLIENTE'
        and (not comun_seguridad.seg_fn_es_propietario_tinkay(v_usr.usu_id) or p.per_clave <> 'SUPERADMIN');

      if v_per_cliente_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        values (v_mem_id, v_per_cliente_id, v_uid)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      if v_per_rol_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        values (v_mem_id, v_per_rol_id, v_uid)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      update comun_seguridad.seg_usuario
         set usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object('roles_explicitos_tinkay', true),
             usu_actualizado_en = v_ahora
       where usu_id = v_usr.usu_id;

      v_aplicado_inmediato := true;
    end if;

    if v_nombre is null then
      v_nombre := nullif(btrim(coalesce(v_usr.usu_nombres, '') || ' ' || coalesce(v_usr.usu_apellidos, '')), '');
    end if;
  end if;

  -- Asegurar fila en comun_configuracion.cfg_negocio y bloquear para actualización atómica
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_neg, initcap(v_neg))
  on conflict (cfg_negocio) do nothing;

  select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
    into v_cfg_id, v_det_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_neg
   for update;

  v_prev_inv := case
    when jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then v_det_cfg->'invitaciones_equipo'
    else '[]'::jsonb
  end;

  v_nueva_inv := jsonb_strip_nulls(jsonb_build_object(
    'id', 'inv-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    'correo', v_correo,
    'nombre', v_nombre,
    'rol', v_rol,
    'estado', case when v_aplicado_inmediato then 'ACEPTADA' else 'PENDIENTE' end,
    'invitadoPorCorreo', coalesce(v_correo_admin, 'admin@tinkay.ec'),
    'creadoEn', v_ahora_iso,
    'aceptadoEn', case when v_aplicado_inmediato then v_ahora_iso else null end
  ));

  select jsonb_build_array(v_nueva_inv) || coalesce(
    (
      select jsonb_agg(elem)
      from jsonb_array_elements(v_prev_inv) as elem
      where lower(btrim(coalesce(elem->>'correo', ''))) <> v_correo
    ),
    '[]'::jsonb
  )
  into v_nuevas_inv;

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
         cfg_actualizado_en = v_ahora
   where cfg_id = v_cfg_id;

  return jsonb_build_object(
    'ok', true,
    'invitacion', v_nueva_inv,
    'aplicadoInmediato', v_aplicado_inmediato
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_invitar_miembro_equipo(text, text, text, text) from public;
grant execute on function comun_seguridad.seg_fn_invitar_miembro_equipo(text, text, text, text) to authenticated, service_role;

-- ==============================================================================
-- 5. RPC TRANSACCIONAL: Eliminar / revocar invitación de equipo
-- ==============================================================================
create or replace function comun_seguridad.seg_fn_eliminar_invitacion_equipo(
  p_negocio text,
  p_invitacion_id text,
  p_correo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_prev_inv jsonb;
  v_nuevas_inv jsonb;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio(v_neg) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para eliminar invitaciones.');
  end if;

  select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
    into v_cfg_id, v_det_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_neg
   for update;

  if v_cfg_id is null then
    return jsonb_build_object('ok', true, 'invitaciones', '[]'::jsonb);
  end if;

  v_prev_inv := case
    when jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then v_det_cfg->'invitaciones_equipo'
    else '[]'::jsonb
  end;

  select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_nuevas_inv
    from jsonb_array_elements(v_prev_inv) as elem
   where coalesce(elem->>'id', '') <> coalesce(p_invitacion_id, '')
     and (v_correo = '' or lower(btrim(coalesce(elem->>'correo', ''))) <> v_correo);

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
         cfg_actualizado_en = now()
   where cfg_id = v_cfg_id;

  return jsonb_build_object('ok', true, 'invitaciones', v_nuevas_inv);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_eliminar_invitacion_equipo(text, text, text) from public;
grant execute on function comun_seguridad.seg_fn_eliminar_invitacion_equipo(text, text, text) to authenticated, service_role;

-- ==============================================================================
-- 6. RPC TRANSACCIONAL: Sincronizar y reclamar invitación de rol al registrarse o ingresar
-- ==============================================================================
create or replace function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(
  p_negocio text default 'tinkay',
  p_crear_cliente_si_no_existe boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_correo text;
  v_nombres text;
  v_detalle jsonb;
  v_explicito boolean := false;
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_inv_arr jsonb;
  v_inv_match jsonb;
  v_rol_inv text;
  v_estado_inv text;
  v_nombre_inv text;
  v_mem_id uuid;
  v_mem_rol text;
  v_per_rol_id uuid;
  v_per_cliente_id uuid;
  v_nuevas_inv jsonb;
  v_rol_efectivo text;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'CLIENTE',
      'invitacionAplicada', false,
      'tieneMembresia', false
    );
  end if;

  select lower(btrim(coalesce(u.usu_correo, au.email, ''))),
         u.usu_nombres,
         coalesce(u.usu_detalle_usuario, '{}'::jsonb)
    into v_correo, v_nombres, v_detalle
    from auth.users au
    left join comun_seguridad.seg_usuario u on u.usu_id = au.id
   where au.id = v_uid;

  -- Propietarios de Tinkay: garantizar SUPERADMIN + ADMINISTRADOR
  if v_neg = 'tinkay' and v_correo in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com') then
    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'SUPERADMIN',
      'invitacionAplicada', false,
      'tieneMembresia', true
    );
  end if;

  v_explicito := coalesce((v_detalle->>'roles_explicitos_tinkay')::boolean, false);
  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  -- 1. Revisar si existe invitación para su correo en cfg_negocio
  select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
    into v_cfg_id, v_det_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_neg;

  if v_cfg_id is not null and jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then
    v_inv_arr := v_det_cfg->'invitaciones_equipo';

    select elem
      into v_inv_match
      from jsonb_array_elements(v_inv_arr) as elem
     where lower(btrim(coalesce(elem->>'correo', ''))) = v_correo
     limit 1;

    if v_inv_match is not null then
      v_rol_inv := upper(btrim(coalesce(v_inv_match->>'rol', 'VENTAS')));
      v_estado_inv := upper(btrim(coalesce(v_inv_match->>'estado', 'PENDIENTE')));
      v_nombre_inv := nullif(btrim(coalesce(v_inv_match->>'nombre', '')), '');

      select m.mem_id, upper(coalesce(m.mem_rol, 'CLIENTE'))
        into v_mem_id, v_mem_rol
        from comun_seguridad.seg_membresia m
       where m.mem_usuario_id = v_uid
         and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
       order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
       limit 1;

      -- Reclamar si está PENDIENTE, o auto-reparar si estaba ACEPTADA pero faltaba aplicar el rol en membresía
      if v_estado_inv = 'PENDIENTE' or not v_explicito or v_mem_id is null then
        select per_id into v_per_rol_id from comun_seguridad.seg_perfil where per_clave = v_rol_inv;

        if v_mem_id is null then
          insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
          values (v_uid, v_neg, v_rol_inv, 'ACTIVO')
          on conflict (mem_usuario_id, mem_negocio) do update
            set mem_rol = v_rol_inv,
                mem_estado = 'ACTIVO',
                mem_actualizado_en = v_ahora
          returning mem_id into v_mem_id;
        else
          update comun_seguridad.seg_membresia
             set mem_negocio = v_neg,
                 mem_rol = v_rol_inv,
                 mem_estado = 'ACTIVO',
                 mem_actualizado_en = v_ahora
           where mem_id = v_mem_id;
        end if;

        if v_estado_inv = 'PENDIENTE' then
          delete from comun_seguridad.seg_membresia_perfil mp
          using comun_seguridad.seg_perfil p
          where mp.mpe_membresia_id = v_mem_id
            and mp.mpe_perfil_id = p.per_id
            and p.per_clave <> 'CLIENTE';
        end if;

        if v_per_cliente_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_cliente_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        if v_per_rol_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_rol_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        update comun_seguridad.seg_usuario
           set usu_nombres = coalesce(nullif(btrim(usu_nombres), ''), v_nombre_inv),
               usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object('roles_explicitos_tinkay', true),
               usu_actualizado_en = v_ahora
         where usu_id = v_uid;

        if v_estado_inv = 'PENDIENTE' then
          select coalesce(
            jsonb_agg(
              case
                when lower(btrim(coalesce(elem->>'correo', ''))) = v_correo
                  then elem || jsonb_build_object('estado', 'ACEPTADA', 'aceptadoEn', v_ahora_iso)
                else elem
              end
            ),
            '[]'::jsonb
          )
          into v_nuevas_inv
          from jsonb_array_elements(v_inv_arr) as elem;

          update comun_configuracion.cfg_negocio
             set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
                 cfg_actualizado_en = v_ahora
           where cfg_id = v_cfg_id;
        end if;

        return jsonb_build_object(
          'ok', true,
          'rolEfectivo', v_rol_inv,
          'invitacionAplicada', true,
          'tieneMembresia', true
        );
      end if;
    end if;
  end if;

  -- 2. Evaluar membresía actual en el negocio
  select m.mem_id, upper(coalesce(m.mem_rol, 'CLIENTE'))
    into v_mem_id, v_mem_rol
    from comun_seguridad.seg_membresia m
   where m.mem_usuario_id = v_uid
     and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
     and m.mem_estado = 'ACTIVO'
   order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
   limit 1;

  if v_mem_id is null then
    if p_crear_cliente_si_no_existe then
      insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      values (v_uid, v_neg, 'CLIENTE', 'ACTIVO')
      on conflict (mem_usuario_id, mem_negocio) do update
        set mem_estado = 'ACTIVO',
            mem_actualizado_en = v_ahora
      returning mem_id into v_mem_id;

      if v_per_cliente_id is not null and v_mem_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_cliente_id)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      return jsonb_build_object(
        'ok', true,
        'rolEfectivo', 'CLIENTE',
        'invitacionAplicada', false,
        'tieneMembresia', true
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'CLIENTE',
      'invitacionAplicada', false,
      'tieneMembresia', false
    );
  end if;

  -- Si en Tinkay tenía SUPERADMIN/ADMINISTRADOR heredado sin asignación explícita, normalizar a CLIENTE
  if v_neg = 'tinkay' and not v_explicito and v_mem_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN') then
    update comun_seguridad.seg_membresia
       set mem_rol = 'CLIENTE',
           mem_actualizado_en = v_ahora
     where mem_id = v_mem_id;

    delete from comun_seguridad.seg_membresia_perfil mp
    using comun_seguridad.seg_perfil p
    where mp.mpe_membresia_id = v_mem_id
      and mp.mpe_perfil_id = p.per_id
      and p.per_clave in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN');

    if v_per_cliente_id is not null then
      insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
      values (v_mem_id, v_per_cliente_id)
      on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
    end if;
  end if;

  v_rol_efectivo := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_neg);
  if v_rol_efectivo = 'ANONIMO' then
    v_rol_efectivo := 'CLIENTE';
  end if;

  return jsonb_build_object(
    'ok', true,
    'rolEfectivo', v_rol_efectivo,
    'invitacionAplicada', false,
    'tieneMembresia', true
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(text, boolean) from public;
grant execute on function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(text, boolean) to authenticated, service_role;

-- ==============================================================================
-- 7. RPCs TRANSACCIONALES: Asignar / Quitar perfil y Listar usuarios del negocio
-- ==============================================================================
create or replace function comun_seguridad.seg_fn_asignar_perfil_negocio(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_rol text := upper(btrim(coalesce(p_perfil, '')));
  v_nivel_gestor integer := comun_seguridad.seg_fn_nivel_maximo(v_neg);
  v_perfil record;
  v_mem_id uuid;
  v_per_cliente_id uuid;
  v_correo_target text;
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_nuevas_inv jsonb;
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
begin
  if v_nivel_gestor < 30 then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para asignar perfiles en este negocio.');
  end if;

  select per_id, per_nombre, per_nivel, per_asignable
    into v_perfil
    from comun_seguridad.seg_perfil
   where per_clave = v_rol
     and per_activo = true;

  if v_perfil.per_id is null then
    return jsonb_build_object('ok', false, 'error', 'Perfil no encontrado: ' || v_rol);
  end if;

  if not v_perfil.per_asignable then
    return jsonb_build_object('ok', false, 'error', 'El perfil ' || v_rol || ' no es asignable.');
  end if;

  if v_perfil.per_nivel > v_nivel_gestor then
    return jsonb_build_object('ok', false, 'error', 'No puedes asignar un perfil de jerarquía superior a la tuya.');
  end if;

  select m.mem_id into v_mem_id
  from comun_seguridad.seg_membresia m
  where m.mem_usuario_id = p_usuario_id
    and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
  order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
  limit 1;

  if v_mem_id is null then
    insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    values (p_usuario_id, v_neg, v_rol, 'ACTIVO')
    on conflict (mem_usuario_id, mem_negocio) do update
      set mem_rol = v_rol,
          mem_estado = 'ACTIVO',
          mem_actualizado_en = v_ahora
    returning mem_id into v_mem_id;
  else
    update comun_seguridad.seg_membresia
       set mem_negocio = v_neg,
           mem_rol = v_rol,
           mem_estado = 'ACTIVO',
           mem_actualizado_en = v_ahora
     where mem_id = v_mem_id;
  end if;

  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';
  if v_per_cliente_id is not null then
    insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
    values (v_mem_id, v_per_cliente_id, v_uid)
    on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
  end if;

  insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
  values (v_mem_id, v_perfil.per_id, v_uid)
  on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;

  update comun_seguridad.seg_usuario
     set usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) ||
         case when v_neg = 'tinkay' then jsonb_build_object('roles_explicitos_tinkay', true) else '{}'::jsonb end,
         usu_actualizado_en = v_ahora
   where usu_id = p_usuario_id
   returning lower(btrim(usu_correo)) into v_correo_target;

  -- Si existía invitación PENDIENTE para este correo, marcarla como ACEPTADA
  if v_correo_target is not null then
    select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
      into v_cfg_id, v_det_cfg
      from comun_configuracion.cfg_negocio
     where cfg_negocio = v_neg;

    if v_cfg_id is not null and jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then
      select coalesce(
        jsonb_agg(
          case
            when lower(btrim(coalesce(elem->>'correo', ''))) = v_correo_target
              then elem || jsonb_build_object('rol', v_rol, 'estado', 'ACEPTADA', 'aceptadoEn', v_ahora_iso)
            else elem
          end
        ),
        '[]'::jsonb
      )
      into v_nuevas_inv
      from jsonb_array_elements(v_det_cfg->'invitaciones_equipo') as elem;

      update comun_configuracion.cfg_negocio
         set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
             cfg_actualizado_en = v_ahora
       where cfg_id = v_cfg_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'rolNombre', v_perfil.per_nombre);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asignar_perfil_negocio(uuid, text, text) from public;
grant execute on function comun_seguridad.seg_fn_asignar_perfil_negocio(uuid, text, text) to authenticated, service_role;

create or replace function comun_seguridad.seg_fn_quitar_perfil_negocio(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_rol text := upper(btrim(coalesce(p_perfil, '')));
  v_nivel_gestor integer := comun_seguridad.seg_fn_nivel_maximo(v_neg);
  v_nivel_perfil integer;
  v_mem_id uuid;
  v_rol_remanente text := 'CLIENTE';
begin
  if v_nivel_gestor < 30 then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para revocar perfiles en este negocio.');
  end if;

  if v_rol = 'CLIENTE' then
    return jsonb_build_object('ok', false, 'error', 'CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2).');
  end if;

  select per_nivel into v_nivel_perfil from comun_seguridad.seg_perfil where per_clave = v_rol;
  if v_nivel_perfil is not null and v_nivel_perfil > v_nivel_gestor then
    return jsonb_build_object('ok', false, 'error', 'No puedes revocar un perfil de jerarquía superior a la tuya.');
  end if;

  select m.mem_id into v_mem_id
  from comun_seguridad.seg_membresia m
  where m.mem_usuario_id = p_usuario_id
    and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
  limit 1;

  if v_mem_id is not null then
    delete from comun_seguridad.seg_membresia_perfil mp
    using comun_seguridad.seg_perfil p
    where mp.mpe_membresia_id = v_mem_id
      and mp.mpe_perfil_id = p.per_id
      and upper(p.per_clave) = v_rol;

    select coalesce(
      (
        select p.per_clave
        from comun_seguridad.seg_membresia_perfil mp
        join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
        where mp.mpe_membresia_id = v_mem_id
          and p.per_activo = true
        order by p.per_nivel desc
        limit 1
      ),
      'CLIENTE'
    ) into v_rol_remanente;

    update comun_seguridad.seg_membresia
       set mem_rol = v_rol_remanente,
           mem_actualizado_en = now()
     where mem_id = v_mem_id;
  end if;

  return jsonb_build_object('ok', true, 'rolRemanente', v_rol_remanente);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_quitar_perfil_negocio(uuid, text, text) from public;
grant execute on function comun_seguridad.seg_fn_quitar_perfil_negocio(uuid, text, text) to authenticated, service_role;

create or replace function comun_seguridad.seg_fn_listar_usuarios_negocio(
  p_negocio text,
  p_consulta text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_nivel integer := comun_seguridad.seg_fn_nivel_maximo(v_neg);
  v_q text := btrim(coalesce(p_consulta, ''));
  v_lista jsonb;
begin
  if v_nivel < 30 then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para consultar usuarios de este negocio.');
  end if;

  select coalesce(jsonb_agg(sub.item order by sub.creado_en desc), '[]'::jsonb)
    into v_lista
    from (
      select distinct on (u.usu_id)
        u.usu_creado_en as creado_en,
        jsonb_build_object(
          'usu_id', u.usu_id,
          'usu_nombres', coalesce(u.usu_detalle_usuario #>> array['registros_negocio', v_neg, 'nombres'], u.usu_nombres),
          'usu_apellidos', coalesce(u.usu_detalle_usuario #>> array['registros_negocio', v_neg, 'apellidos'], u.usu_apellidos),
          'usu_correo', u.usu_correo,
          'usu_superadmin_plataforma', u.usu_superadmin_plataforma,
          'roles_explicitos_tinkay', coalesce((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false),
          'mem_rol', m.mem_rol,
          'mem_estado', coalesce(m.mem_estado, 'ACTIVO'),
          'perfiles_db', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'clave', p.per_clave,
                'nivel', p.per_nivel
              ) order by p.per_nivel desc
            )
            from comun_seguridad.seg_membresia_perfil mp
            join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
            where mp.mpe_membresia_id = m.mem_id
              and p.per_activo = true
          ), '[]'::jsonb)
        ) as item
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
      where comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
        and (
          v_q = ''
          or coalesce(u.usu_nombres, '') ilike '%' || v_q || '%'
          or coalesce(u.usu_apellidos, '') ilike '%' || v_q || '%'
          or coalesce(u.usu_correo, '') ilike '%' || v_q || '%'
        )
      order by u.usu_id, (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
      limit 100
    ) sub;

  return jsonb_build_object('ok', true, 'usuarios', v_lista);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_listar_usuarios_negocio(text, text) from public;
grant execute on function comun_seguridad.seg_fn_listar_usuarios_negocio(text, text) to authenticated, service_role;

-- ==============================================================================
-- 8. Regularizar invitación enviada a familiammtg@gmail.com como VENTAS en Tinkay
-- ==============================================================================
do $$
declare
  v_usr record;
  v_mem_id uuid;
  v_per_ventas uuid;
  v_per_cliente uuid;
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_prev_inv jsonb;
  v_nueva_inv jsonb;
  v_nuevas_inv jsonb;
  v_ahora_iso text := to_jsonb(now())#>>'{}';
begin
  select per_id into v_per_ventas from comun_seguridad.seg_perfil where per_clave = 'VENTAS';
  select per_id into v_per_cliente from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  select usu_id, usu_nombres, usu_apellidos
    into v_usr
    from comun_seguridad.seg_usuario
   where lower(btrim(usu_correo)) = 'familiammtg@gmail.com'
   limit 1;

  if v_usr.usu_id is not null then
    select mem_id into v_mem_id
    from comun_seguridad.seg_membresia
    where mem_usuario_id = v_usr.usu_id
      and comun_seguridad.seg_fn_normalizar_negocio(mem_negocio) = 'tinkay'
    order by (mem_negocio = 'tinkay') desc, mem_creado_en asc
    limit 1;

    if v_mem_id is not null then
      update comun_seguridad.seg_membresia
         set mem_negocio = 'tinkay',
             mem_rol = 'VENTAS',
             mem_estado = 'ACTIVO',
             mem_actualizado_en = now()
       where mem_id = v_mem_id;

      delete from comun_seguridad.seg_membresia_perfil mp
      using comun_seguridad.seg_perfil p
      where mp.mpe_membresia_id = v_mem_id
        and mp.mpe_perfil_id = p.per_id
        and p.per_clave in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN');

      if v_per_cliente is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_cliente)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      if v_per_ventas is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_ventas)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      update comun_seguridad.seg_usuario
         set usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object('roles_explicitos_tinkay', true),
             usu_actualizado_en = now()
       where usu_id = v_usr.usu_id;

      select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
        into v_cfg_id, v_det_cfg
        from comun_configuracion.cfg_negocio
       where cfg_negocio = 'tinkay';

      if v_cfg_id is not null then
        v_prev_inv := case
          when jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then v_det_cfg->'invitaciones_equipo'
          else '[]'::jsonb
        end;

        v_nueva_inv := jsonb_build_object(
          'id', 'inv-familiammtg-ventas',
          'correo', 'familiammtg@gmail.com',
          'nombre', coalesce(nullif(btrim(coalesce(v_usr.usu_nombres, '') || ' ' || coalesce(v_usr.usu_apellidos, '')), ''), 'Matías'),
          'rol', 'VENTAS',
          'estado', 'ACEPTADA',
          'invitadoPorCorreo', 'tinkay.uio@gmail.com',
          'creadoEn', v_ahora_iso,
          'aceptadoEn', v_ahora_iso
        );

        select jsonb_build_array(v_nueva_inv) || coalesce(
          (
            select jsonb_agg(elem)
            from jsonb_array_elements(v_prev_inv) as elem
            where lower(btrim(coalesce(elem->>'correo', ''))) <> 'familiammtg@gmail.com'
          ),
          '[]'::jsonb
        )
        into v_nuevas_inv;

        update comun_configuracion.cfg_negocio
           set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
               cfg_actualizado_en = now()
         where cfg_id = v_cfg_id;
      end if;
    end if;
  end if;
end $$;
