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

grant execute on function comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid) to authenticated;

-- 2. RPC para Reset Master del sistema con aislamiento estricto por Negocio (default 'TRANQ')
create or replace function comun_seguridad.seg_fn_superadmin_resetear_sistema(p_negocio text default 'TRANQ')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := upper(coalesce(p_negocio, 'TRANQ'));
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'Solo el SuperAdmin puede resetear el sistema';
  end if;

  -- Normalizar alias de negocio
  if v_negocio = 'TRANQI' then v_negocio := 'TRANQ'; end if;
  if v_negocio = 'FASTFIX' then v_negocio := 'FFH'; end if;
  if v_negocio = 'TINKAY' then v_negocio := 'TNK'; end if;
  if v_negocio = 'MARGARITAS' then v_negocio := 'MRG'; end if;

  -- 1. Purgar esquemas operacionales según el negocio especificado
  if v_negocio = 'TRANQ' or v_negocio = 'TODOS' then
    delete from tranqui_legal.trq_abogado where abg_id is not null or true;
    delete from tranqui_legal.trq_solicitud_materia where sma_id is not null or true;
    delete from tranqui_legal.trq_solicitud_provincia where spr_id is not null or true;
    delete from tranqui_legal.trq_experiencia_laboral where exp_id is not null or true;
    delete from tranqui_legal.trq_solicitud_socio where ssc_id is not null or true;
  end if;

  if (v_negocio = 'FFH' or v_negocio = 'TODOS') and to_regclass('fastfix_mantenimiento.ffh_tecnico') is not null then
    delete from fastfix_mantenimiento.ffh_tecnico where tec_id is not null or true;
  end if;

  if (v_negocio = 'TNK' or v_negocio = 'TODOS') and to_regclass('tinkay_floristeria.tnk_producto_flor') is not null then
    delete from tinkay_floristeria.tnk_producto_flor where pro_id is not null or true;
  end if;

  if (v_negocio = 'MRG' or v_negocio = 'TODOS') and to_regclass('margaritas_floristeria.mrg_producto_flor') is not null then
    delete from margaritas_floristeria.mrg_producto_flor where pro_id is not null or true;
  end if;

  -- 2. Borrar perfiles asignados a membresias del negocio especificado (excepto SuperAdmin)
  delete from comun_seguridad.seg_membresia_perfil
  where mpe_membresia_id in (
    select mem_id from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    where (
        v_negocio = 'TODOS' 
        or (v_negocio = 'TRANQ' and upper(m.mem_negocio) in ('TRANQ', 'TRANQI'))
        or (v_negocio = 'FFH' and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (v_negocio = 'TNK' and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (v_negocio = 'MRG' and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
        or upper(m.mem_negocio) = v_negocio
      )
      and u.usu_superadmin_plataforma = false 
      and u.usu_correo != 'kleber.toapanta.ch@gmail.com'
  );

  -- 3. Borrar membresias del negocio especificado (excepto SuperAdmin)
  delete from comun_seguridad.seg_membresia
  where (
      v_negocio = 'TODOS' 
      or (v_negocio = 'TRANQ' and upper(mem_negocio) in ('TRANQ', 'TRANQI'))
      or (v_negocio = 'FFH' and upper(mem_negocio) in ('FFH', 'FASTFIX'))
      or (v_negocio = 'TNK' and upper(mem_negocio) in ('TNK', 'TINKAY'))
      or (v_negocio = 'MRG' and upper(mem_negocio) in ('MRG', 'MARGARITAS'))
      or upper(mem_negocio) = v_negocio
    )
    and mem_usuario_id in (
      select usu_id from comun_seguridad.seg_usuario
      where usu_superadmin_plataforma = false and usu_correo != 'kleber.toapanta.ch@gmail.com'
    );

  -- 4. Borrar usuarios base (seg_usuario) que hayan quedado HUERFANOS (sin membresia en ningun negocio)
  delete from comun_seguridad.seg_usuario u
  where u.usu_superadmin_plataforma = false 
    and u.usu_correo != 'kleber.toapanta.ch@gmail.com'
    and not exists (
      select 1 from comun_seguridad.seg_membresia m where m.mem_usuario_id = u.usu_id
    );

  -- 5. Borrar en cascada en esquema auth UNICAMENTE los usuarios eliminados de seg_usuario (huerfanos)
  delete from auth.refresh_tokens where session_id in (
    select id from auth.sessions where user_id not in (select usu_id from comun_seguridad.seg_usuario)
  );
  delete from auth.sessions where user_id not in (select usu_id from comun_seguridad.seg_usuario);
  delete from auth.mfa_factors where user_id not in (select usu_id from comun_seguridad.seg_usuario);
  delete from auth.identities where user_id not in (select usu_id from comun_seguridad.seg_usuario);
  delete from auth.users where id not in (select usu_id from comun_seguridad.seg_usuario);

  return 'sistema_reseteado_por_negocio_' || v_negocio;
end;
$$;

grant execute on function comun_seguridad.seg_fn_superadmin_resetear_sistema(text) to authenticated;

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
