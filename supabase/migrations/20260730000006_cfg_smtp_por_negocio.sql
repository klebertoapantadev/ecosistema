-- PLT-008: servidor SMTP configurable por negocio, desde la pantalla de
-- Configuracion del Negocio. Hasta ahora el remitente vivia en variables de
-- entorno SMTP_* de cada proyecto de Vercel: eso ataba el correo al despliegue
-- (cambiar de proveedor exigia un redeploy) y lo dejaba fuera del alcance del
-- ADMINISTRADOR del negocio, que es quien conoce su propio buzon.
--
-- Por que una tabla nueva y no cfg_negocio: esa tabla tiene
-- `cfg_negocio_lectura_publica ... using (true)` con grant select a anon --
-- es informacion de vitrina, publica a proposito. Meter ahi credenciales SMTP
-- las dejaria legibles desde internet.
--
-- Por que la contrasena no esta en esta tabla: va a Supabase Vault, y aqui
-- solo queda su uuid. Asi el admin puede ver y editar host/puerto/usuario sin
-- que la contrasena sea legible por nadie con sesion -- ni siquiera por el.
-- Solo service_role la descifra, y solo dentro de la Edge Function
-- enviar-correo (misma frontera que ya usa restablecer-contrasena; ver
-- gobernanza/politicas/gestion-credenciales.md §3).

create extension if not exists supabase_vault with schema vault;

create table comun_configuracion.cfg_smtp (
  smt_id uuid primary key default gen_random_uuid(),
  smt_secuencial bigint generated always as identity,
  smt_negocio text not null unique references comun_configuracion.cfg_negocio(cfg_negocio) on delete cascade,
  smt_host text,
  smt_puerto integer not null default 465,
  -- true = TLS implicito (puerto 465). false = STARTTLS (587). Se guarda
  -- explicito en vez de deducirlo del puerto: hay proveedores que usan
  -- puertos no estandar y adivinar terminaria fallando en silencio.
  smt_seguro boolean not null default true,
  smt_usuario text,
  smt_remitente_nombre text,
  -- uuid del secreto en vault.secrets. Null = todavia no se ha guardado
  -- ninguna contrasena para este negocio.
  smt_secreto_id uuid,
  -- El envio real solo ocurre si esta en true Y hay host/usuario/secreto.
  -- Separar "configurado" de "activo" permite dejar los datos cargados y
  -- probar antes de que empiece a salir correo de produccion por ahi.
  smt_activo boolean not null default false,
  smt_detalle_smtp jsonb not null default '{}'::jsonb,
  smt_creado_en timestamptz not null default now(),
  smt_actualizado_en timestamptz not null default now()
);

alter table comun_configuracion.cfg_smtp enable row level security;

-- Sin lectura publica, al reves que cfg_negocio: esto no es vitrina. Solo el
-- ADMINISTRADOR del propio negocio ve la configuracion, y aun asi lo que ve
-- no incluye la contrasena (no esta en la tabla).
create policy cfg_smtp_admin_lectura on comun_configuracion.cfg_smtp
  for select using (comun_seguridad.seg_fn_es_admin_negocio(smt_negocio));

-- La escritura NO se hace por update directo sino por cfg_fn_guardar_smtp():
-- guardar la contrasena en Vault y la fila en la tabla tiene que ser una sola
-- operacion. Sin politica de update/insert, la tabla es de solo lectura para
-- cualquier sesion.

create trigger trg_auditoria_cfg_smtp after insert or update or delete on comun_configuracion.cfg_smtp for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_configuracion.cfg_smtp to authenticated;

-- ═══════════ Guardar (admin del negocio) ═══════════
-- p_contrasena null = "no la cambies", para que el admin pueda corregir el
-- puerto sin volver a teclear la clave. Cadena vacia tampoco borra el
-- secreto: para eso esta cfg_fn_borrar_smtp_contrasena().
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
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio) then
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
      -- El nombre del secreto es unico en vault.secrets, por eso lleva el slug.
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
    -- Si no vino contrasena nueva, v_secreto_id trae la que ya estaba.
    smt_secreto_id = coalesce(v_secreto_id, s.smt_secreto_id),
    smt_actualizado_en = now();
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_guardar_smtp(text, text, integer, boolean, text, text, boolean, text) from public;
grant execute on function comun_configuracion.cfg_fn_guardar_smtp(text, text, integer, boolean, text, text, boolean, text) to authenticated;

-- ═══════════ Borrar solo la contrasena ═══════════
create or replace function comun_configuracion.cfg_fn_borrar_smtp_contrasena(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto_id uuid;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio) then
    raise exception 'No autorizado';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if v_secreto_id is null then
    return;
  end if;

  -- Se desactiva junto con la contrasena: sin credencial no hay envio
  -- posible, y dejar smt_activo en true haria fallar cada correo en silencio.
  update comun_configuracion.cfg_smtp
  set smt_secreto_id = null, smt_activo = false, smt_actualizado_en = now()
  where smt_negocio = p_negocio;

  delete from vault.secrets where id = v_secreto_id;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_borrar_smtp_contrasena(text) from public;
grant execute on function comun_configuracion.cfg_fn_borrar_smtp_contrasena(text) to authenticated;

-- ═══════════ Leer credenciales (solo service_role) ═══════════
-- Esta es la unica funcion del ecosistema que devuelve la contrasena en
-- claro. No la puede ejecutar anon ni authenticated: solo service_role, que
-- vive exclusivamente dentro de una Edge Function.
create or replace function comun_configuracion.cfg_fn_obtener_smtp_credenciales(p_negocio text)
returns table (
  host text,
  puerto integer,
  seguro boolean,
  usuario text,
  remitente_nombre text,
  contrasena text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    s.smt_host,
    s.smt_puerto,
    s.smt_seguro,
    s.smt_usuario,
    s.smt_remitente_nombre,
    d.decrypted_secret
  from comun_configuracion.cfg_smtp s
  join vault.decrypted_secrets d on d.id = s.smt_secreto_id
  where s.smt_negocio = p_negocio
    and s.smt_activo
    and s.smt_host is not null
    and s.smt_usuario is not null;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_obtener_smtp_credenciales(text) from public;
revoke execute on function comun_configuracion.cfg_fn_obtener_smtp_credenciales(text) from anon, authenticated;
grant execute on function comun_configuracion.cfg_fn_obtener_smtp_credenciales(text) to service_role;
