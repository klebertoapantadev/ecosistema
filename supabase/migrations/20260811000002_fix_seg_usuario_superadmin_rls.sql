-- Migration 20260811000002: Permitir a SuperAdmin consultar todos los usuarios de seg_usuario sin exigir membresia previa

drop policy if exists seg_usuario_admin_select on comun_seguridad.seg_usuario;
create policy seg_usuario_admin_select on comun_seguridad.seg_usuario
  for select using (
    comun_seguridad.seg_fn_es_superadmin()
    or exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = seg_usuario.usu_id
        and comun_seguridad.seg_fn_es_admin_negocio(m.mem_negocio)
    )
  );

-- RPC SECURITY DEFINER para consultar la lista completa de usuarios del ecosistema
create or replace function comun_seguridad.seg_fn_listar_usuarios_directorio()
returns table (
  usu_id uuid,
  usu_nombres text,
  usu_apellidos text,
  usu_correo text,
  usu_whatsapp text,
  usu_creado_en timestamptz,
  usu_superadmin_plataforma boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.usu_id, u.usu_nombres, u.usu_apellidos, u.usu_correo, u.usu_whatsapp, u.usu_creado_en, u.usu_superadmin_plataforma
  from comun_seguridad.seg_usuario u
  order by u.usu_creado_en desc;
$$;

grant execute on function comun_seguridad.seg_fn_listar_usuarios_directorio() to authenticated;
