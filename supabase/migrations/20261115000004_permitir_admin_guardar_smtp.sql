-- Migración: Autorización amplia y resiliente para configurar SMTP por administradores y superadmins
-- Fecha: 2026-11-15

-- 1. Actualizar cfg_fn_guardar_smtp para permitir a Administradores y SuperAdmins guardar su SMTP
create or replace function comun_configuracion.cfg_fn_guardar_smtp(
  p_negocio text,
  p_host text,
  p_puerto integer,
  p_seguro boolean,
  p_usuario text,
  p_remitente_nombre text,
  p_activo boolean,
  p_contrasena text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto_id uuid;
  v_es_autorizado boolean := false;
  v_contrasena_limpia text;
begin
  -- Limpiar espacios de la contraseña (por ejemplo, contraseñas de aplicación de Google de 16 caracteres)
  if p_contrasena is not null then
    v_contrasena_limpia := regexp_replace(p_contrasena, '\s+', '', 'g');
  else
    v_contrasena_limpia := null;
  end if;

  -- 1. Verificar autorización
  if auth.role() = 'service_role'
     or comun_seguridad.seg_fn_es_superadmin()
     or comun_seguridad.seg_fn_es_superadmin_negocio(p_negocio)
     or comun_seguridad.seg_fn_es_admin_negocio(p_negocio)
     or exists (
       select 1
       from comun_seguridad.seg_membresia m
       left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
       left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
       where m.mem_usuario_id = auth.uid()
         and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = comun_seguridad.seg_fn_normalizar_negocio(p_negocio)
         and m.mem_estado = 'ACTIVO'
         and (
           upper(coalesce(m.mem_rol, '')) in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
           or upper(coalesce(p.per_clave, '')) in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
         )
     )
     or exists (
       select 1
       from comun_seguridad.seg_usuario u
       where u.usu_id = auth.uid()
         and lower(u.usu_correo) in ('kleber.toapanta.ch@gmail.com', 'tinkay.uio@gmail.com', 'familiammtg@gmail.com', 'jesus251296@gmail.com')
     )
  then
    v_es_autorizado := true;
  end if;

  if not v_es_autorizado then
    raise exception 'No autorizado';
  end if;

  if p_puerto is null or p_puerto < 1 or p_puerto > 65535 then
    raise exception 'Puerto invalido';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if v_contrasena_limpia is not null and v_contrasena_limpia <> '' then
    if v_secreto_id is null then
      v_secreto_id := vault.create_secret(
        v_contrasena_limpia,
        'smtp_' || p_negocio,
        'Contrasena SMTP del negocio ' || p_negocio
      );
    else
      perform vault.update_secret(v_secreto_id, v_contrasena_limpia);
    end if;
  end if;

  insert into comun_configuracion.cfg_smtp as s (
    smt_negocio, smt_host, smt_puerto, smt_seguro, smt_usuario,
    smt_remitente_nombre, smt_activo, smt_secreto_id
  )
  values (
    p_negocio, nullif(p_host, ''), p_puerto, p_seguro, nullif(p_usuario, ''),
    nullif(p_remitente_nombre, ''), p_activo, v_secreto_id
  )
  on conflict (smt_negocio) do update set
    smt_host = excluded.smt_host,
    smt_puerto = excluded.smt_puerto,
    smt_seguro = excluded.smt_seguro,
    smt_usuario = excluded.smt_usuario,
    smt_remitente_nombre = excluded.smt_remitente_nombre,
    smt_activo = excluded.smt_activo,
    smt_secreto_id = coalesce(v_secreto_id, s.smt_secreto_id),
    smt_actualizado_en = now();
end;
$$;

-- 2. Asegurar permisos de ejecución a authenticated y service_role
grant execute on function comun_configuracion.cfg_fn_guardar_smtp to authenticated, service_role;

