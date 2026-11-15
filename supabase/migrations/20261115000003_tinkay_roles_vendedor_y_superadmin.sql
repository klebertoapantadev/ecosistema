-- Migración: Perfil Vendedor para Tinkay Floristería y blindaje de tinkay.uio@gmail.com como SuperAdmin/Administrador
-- Fecha: 2026-11-15

-- 1. Crear o asegurar perfil VENDEDOR en el catálogo transversal seg_perfil
insert into comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_asignable)
values ('VENDEDOR', 'Vendedor', 20, true)
on conflict (per_clave) do update
set per_nombre = excluded.per_nombre,
    per_nivel = excluded.per_nivel,
    per_asignable = excluded.per_asignable;

-- 2. Asegurar que tinkay.uio@gmail.com tenga membresía de ADMINISTRADOR / SUPERADMIN en Tinkay y esté protegido
do $$
declare
  v_usu_id uuid;
  v_mem_id uuid;
  v_per_admin_id uuid;
  v_per_super_id uuid;
  v_per_cliente_id uuid;
begin
  select usu_id into v_usu_id
  from comun_seguridad.seg_usuario
  where lower(usu_correo) = 'tinkay.uio@gmail.com';

  select per_id into v_per_admin_id from comun_seguridad.seg_perfil where per_clave = 'ADMINISTRADOR';
  select per_id into v_per_super_id from comun_seguridad.seg_perfil where per_clave = 'SUPERADMIN';
  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  if v_usu_id is not null then
    -- Asignar flag de superadmin de plataforma
    update comun_seguridad.seg_usuario
       set usu_superadmin_plataforma = true
     where usu_id = v_usu_id;

    -- Asegurar o actualizar membresía en Tinkay como ADMINISTRADOR
    insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    values (v_usu_id, 'tinkay', 'ADMINISTRADOR', 'ACTIVO')
    on conflict (mem_usuario_id, mem_negocio) do update
    set mem_rol = 'ADMINISTRADOR',
        mem_estado = 'ACTIVO'
    returning mem_id into v_mem_id;

    if v_mem_id is null then
      select mem_id into v_mem_id
      from comun_seguridad.seg_membresia
      where mem_usuario_id = v_usu_id and lower(mem_negocio) = 'tinkay';
    end if;

    if v_mem_id is not null then
      -- Asegurar perfiles asignados en la membresía
      if v_per_admin_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_admin_id)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      if v_per_super_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_super_id)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      if v_per_cliente_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_cliente_id)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;
    end if;
  end if;
end $$;

