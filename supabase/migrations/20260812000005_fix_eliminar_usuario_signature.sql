-- Migration 20260812000005: Corrección de firma del parámetro en la función RPC de eliminación física de usuario
-- Resuelve la discrepancia entre el parámetro p_target_usu_id y p_target_usuario_id esperado por el cliente JS

-- 1. Eliminar la función con cualquier firma anterior para evitar conflictos de sobrecarga y limpiar la caché de PostgREST
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid);

-- 2. Crear la función con el nombre de parámetro correcto p_target_usuario_id
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
  delete from tranqui_legal.trq_abogado where abg_usuario_id = p_target_usuario_id;
  delete from tranqui_legal.trq_solicitud_materia where sma_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_solicitud_provincia where spr_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_experiencia_laboral where exp_solicitud_id in (select ssc_id from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id);
  delete from tranqui_legal.trq_solicitud_socio where ssc_usuario_id = p_target_usuario_id;

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

-- 3. Otorgar privilegios de ejecución a usuarios autenticados
grant execute on function comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid) to authenticated;
