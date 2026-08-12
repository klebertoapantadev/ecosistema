-- Migration 20260811000004: Correccion de Borrado Fisico de auth.users con limpieza en cascada FK y soporte de Baja Logica (LOPDP)

-- 1. RPC para eliminacion fisica completa de un usuario especifico
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
  delete from tranqui_legal.trq_solicitud_materia where sma_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_solicitud_provincia where spr_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_experiencia_laboral where exp_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id;
  delete from tranqui_legal.trq_abogado where abg_usuario_id = p_target_usuario_id;

  -- Borrar perfiles asignados y membresias en comun_seguridad
  delete from comun_seguridad.seg_membresia_perfil where mpe_membresia_id in (
    select mem_id from comun_seguridad.seg_membresia where mem_usuario_id = p_target_usuario_id
  );
  delete from comun_seguridad.seg_membresia where mem_usuario_id = p_target_usuario_id;
  delete from comun_seguridad.seg_usuario where usu_id = p_target_usuario_id;

  -- Borrar en cascada FK en el esquema auth (evita bloqueo por claves foraneas)
  delete from auth.refresh_tokens where session_id in (select id from auth.sessions where user_id = p_target_usuario_id);
  delete from auth.sessions where user_id = p_target_usuario_id;
  delete from auth.mfa_factors where user_id = p_target_usuario_id;
  delete from auth.identities where user_id = p_target_usuario_id;
  delete from auth.users where id = p_target_usuario_id;

  return 'usuario_eliminado_fisicamente';
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid) to authenticated;

-- 2. RPC para Reset Master del sistema (Borrado Fisico Masivo de Pruebas)
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
  delete from tranqui_legal.trq_solicitud_materia where sma_id is not null or true;
  delete from tranqui_legal.trq_solicitud_provincia where spr_id is not null or true;
  delete from tranqui_legal.trq_experiencia_laboral where exp_id is not null or true;
  delete from tranqui_legal.trq_solicitud_socio where ssc_id is not null or true;
  delete from tranqui_legal.trq_abogado where abg_id is not null or true;

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

  -- Borrar en cascada FK en esquema auth
  delete from auth.refresh_tokens where session_id in (
    select id from auth.sessions where user_id in (select id from auth.users where email != 'kleber.toapanta.ch@gmail.com')
  );
  delete from auth.sessions where user_id in (select id from auth.users where email != 'kleber.toapanta.ch@gmail.com');
  delete from auth.mfa_factors where user_id in (select id from auth.users where email != 'kleber.toapanta.ch@gmail.com');
  delete from auth.identities where user_id in (select id from auth.users where email != 'kleber.toapanta.ch@gmail.com');
  delete from auth.users where email != 'kleber.toapanta.ch@gmail.com';

  return 'sistema_reseteado_fisicamente';
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_resetear_sistema() to authenticated;

-- 3. RPC para Reactivacion de Cuenta dada de baja logicamente
create or replace function comun_seguridad.seg_fn_superadmin_reactivar_usuario(p_target_usuario_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'Solo el SuperAdmin puede reactivar usuarios';
  end if;

  update comun_seguridad.seg_usuario
  set usu_detalle_usuario = jsonb_set(coalesce(usu_detalle_usuario, '{}'::jsonb), '{estado}', '"ACTIVO"')
  where usu_id = p_target_usuario_id;

  update comun_seguridad.seg_membresia
  set mem_estado = 'ACTIVO'
  where mem_usuario_id = p_target_usuario_id;

  return 'usuario_reactivado';
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_reactivar_usuario(uuid) to authenticated;
