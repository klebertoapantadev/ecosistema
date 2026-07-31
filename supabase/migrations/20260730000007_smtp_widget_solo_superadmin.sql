-- PLT-008 / PLT-011: el servidor SMTP pasa a widget propio (`configuracion_correo`)
-- y su permiso se estrecha a SUPERADMIN de plataforma.
--
-- Motivo: hasta ahora la seccion vivia dentro del widget `configuracion_negocio`,
-- asignado a ADMINISTRADOR. Eso equiparaba dos capacidades que no son
-- comparables -- corregir la razon social y configurar el remitente de correo.
-- Quien controla el SMTP puede enviar correo EN NOMBRE del negocio: codigos de
-- verificacion y enlaces de restablecimiento de contrasena, a cualquier
-- direccion. Es una capacidad de suplantacion, no un ajuste de ficha.
--
-- Ojo con lo que NO basta: registrar el widget solo cambia lo que se ve en el
-- rail. La puerta real son la politica RLS y el RPC, y por eso esta migracion
-- toca los tres. Es la misma leccion de
-- 20260728000009_auditoria_widget_top_level_y_acceso_administrador.sql, donde
-- el widget necesito ademas su politica.

-- ═══════════ Helper: superadmin de plataforma, sin el OR de admin ═══════════
-- seg_fn_es_admin_negocio() no sirve aqui: devuelve true tambien para el
-- ADMINISTRADOR del negocio, que es justamente a quien queremos excluir.
create or replace function comun_seguridad.seg_fn_es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid() and u.usu_superadmin_plataforma
  );
$$;

revoke execute on function comun_seguridad.seg_fn_es_superadmin() from public;
grant execute on function comun_seguridad.seg_fn_es_superadmin() to authenticated;

-- ═══════════ Lectura de cfg_smtp: solo superadmin ═══════════
drop policy if exists cfg_smtp_admin_lectura on comun_configuracion.cfg_smtp;

create policy cfg_smtp_superadmin_lectura on comun_configuracion.cfg_smtp
  for select using (comun_seguridad.seg_fn_es_superadmin());

-- ═══════════ Escritura: mismo estrechamiento en los dos RPC ═══════════
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
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'No autorizado';
  end if;

  if p_puerto is null or p_puerto < 1 or p_puerto > 65535 then
    raise exception 'Puerto invalido';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if p_contrasena is not null and p_contrasena <> '' then
    if v_secreto_id is null then
      v_secreto_id := vault.create_secret(
        p_contrasena,
        'smtp_' || p_negocio,
        'Contrasena SMTP del negocio ' || p_negocio
      );
    else
      perform vault.update_secret(v_secreto_id, p_contrasena);
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

create or replace function comun_configuracion.cfg_fn_borrar_smtp_contrasena(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto_id uuid;
begin
  if not comun_seguridad.seg_fn_es_superadmin() then
    raise exception 'No autorizado';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if v_secreto_id is null then
    return;
  end if;

  update comun_configuracion.cfg_smtp
  set smt_secreto_id = null, smt_activo = false, smt_actualizado_en = now()
  where smt_negocio = p_negocio;

  delete from vault.secrets where id = v_secreto_id;
end;
$$;

-- ═══════════ Widget propio ═══════════
-- Sin filas en seg_rol_widget a proposito: obtenerWidgetsVisibles() devuelve
-- todos los widgets activos del negocio cuando el usuario es superadmin, y
-- solo los asignados a su rol cuando no lo es. Un widget sin asignaciones es,
-- por construccion, exclusivo de superadmin -- no hace falta un rol especial.
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo) values
  ('tranqi', 'configuracion_correo', 'Servidor de correo', true),
  ('fastfix', 'configuracion_correo', 'Servidor de correo', true),
  ('tinkay', 'configuracion_correo', 'Servidor de correo', true),
  ('margaritas', 'configuracion_correo', 'Servidor de correo', true)
on conflict (wdg_negocio, wdg_clave) do nothing;
