-- Migration 20260811000003: RPCs de SuperAdmin para eliminar usuarios especificos y resetear el sistema de pruebas desde cero

-- 1. Eliminar usuario especifico con borrado en cascada (solicitudes, abogados, membresias, perfiles y auth.users)
create or replace function comun_seguridad.seg_fn_superadmin_eliminar_usuario(p_target_usuario_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_correo text;
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'Solo el SuperAdmin puede eliminar usuarios del sistema';
  end if;

  select usu_correo into v_target_correo from comun_seguridad.seg_usuario where usu_id = p_target_usuario_id;
  if v_target_correo = 'kleber.toapanta.ch@gmail.com' then
    raise exception 'No se puede eliminar la cuenta principal de SuperAdmin';
  end if;

  -- Borrar solicitudes de socio y datos en tranqui_legal
  delete from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id;
  delete from tranqui_legal.trq_abogado where abg_usuario_id = p_target_usuario_id;

  -- Borrar perfiles asignados y membresias en comun_seguridad
  delete from comun_seguridad.seg_membresia_perfil where mpe_membresia_id in (
    select mem_id from comun_seguridad.seg_membresia where mem_usuario_id = p_target_usuario_id
  );
  delete from comun_seguridad.seg_membresia where mem_usuario_id = p_target_usuario_id;

  -- Borrar registros de auditoria o notificaciones directas si aplican
  delete from comun_seguridad.seg_usuario where usu_id = p_target_usuario_id;

  -- Borrar usuario de auth.users si existe
  delete from auth.users where id = p_target_usuario_id;

  return 'usuario_eliminado';
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid) to authenticated;

-- 2. Resetear el sistema por completo (eliminar todos los usuarios y perfiles de prueba preservando la cuenta SuperAdmin)
create or replace function comun_seguridad.seg_fn_superadmin_resetear_sistema()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'Solo el SuperAdmin puede resetear el sistema';
  end if;

  -- Borrar todas las solicitudes y abogados
  delete from tranqui_legal.trq_solicitud_socio;
  delete from tranqui_legal.trq_abogado;

  -- Borrar membresias y perfiles de prueba (conservando unicamente SuperAdmin kleber.toapanta.ch@gmail.com)
  delete from comun_seguridad.seg_membresia_perfil
  where mpe_membresia_id in (
    select mem_id from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    where u.usu_superadmin_plataforma = false and u.usu_correo != 'kleber.toapanta.ch@gmail.com'
  );

  delete from comun_seguridad.seg_membresia
  where mem_usuario_id in (
    select usu_id from comun_seguridad.seg_usuario
    where usu_superadmin_plataforma = false and usu_correo != 'kleber.toapanta.ch@gmail.com'
  );

  delete from comun_seguridad.seg_usuario
  where usu_superadmin_plataforma = false and usu_correo != 'kleber.toapanta.ch@gmail.com';

  delete from auth.users
  where email != 'kleber.toapanta.ch@gmail.com';

  return 'sistema_reseteado';
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_resetear_sistema() to authenticated;
