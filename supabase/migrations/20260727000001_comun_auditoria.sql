-- comun_auditoria: registro inmutable de cambios (aud_registro) y telemetria de
-- API (aud_log_api) + la funcion generica aud_fn_auditar_tabla() que cualquier
-- tabla de negocio del ecosistema debe usar como trigger AFTER INSERT/UPDATE/DELETE.
-- Ver gobernanza/estandares/00-nomenclatura-base-datos.md y politicas/seguridad-y-datos.md.

create schema if not exists comun_auditoria;

create table comun_auditoria.aud_registro (
  reg_id uuid primary key default gen_random_uuid(),
  reg_secuencial bigint generated always as identity,
  reg_esquema text not null,
  reg_tabla text not null,
  reg_operacion text not null check (reg_operacion in ('INSERT','UPDATE','DELETE')),
  reg_usuario_id uuid,
  reg_datos_anteriores jsonb,
  reg_datos_nuevos jsonb,
  reg_detalle_registro jsonb not null default '{}'::jsonb,
  reg_creado_en timestamptz not null default now()
);

create index idx_aud_registro_tabla on comun_auditoria.aud_registro (reg_esquema, reg_tabla, reg_creado_en desc);

create table comun_auditoria.aud_log_api (
  log_id uuid primary key default gen_random_uuid(),
  log_secuencial bigint generated always as identity,
  log_ruta text not null,
  log_metodo text not null,
  log_status_code int,
  log_usuario_id uuid,
  log_detalle_log jsonb not null default '{}'::jsonb,
  log_creado_en timestamptz not null default now()
);

alter table comun_auditoria.aud_registro enable row level security;
alter table comun_auditoria.aud_log_api enable row level security;
-- Sin politicas todavia = denegado por defecto para anon/authenticated.
-- Las politicas de lectura (solo SUPERADMIN de plataforma) se agregan en la
-- migracion de comun_seguridad, porque referencian seg_usuario.

create or replace function comun_auditoria.aud_fn_auditar_tabla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into comun_auditoria.aud_registro (reg_esquema, reg_tabla, reg_operacion, reg_usuario_id, reg_datos_nuevos)
    values (tg_table_schema, tg_table_name, tg_op, auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into comun_auditoria.aud_registro (reg_esquema, reg_tabla, reg_operacion, reg_usuario_id, reg_datos_anteriores, reg_datos_nuevos)
    values (tg_table_schema, tg_table_name, tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into comun_auditoria.aud_registro (reg_esquema, reg_tabla, reg_operacion, reg_usuario_id, reg_datos_anteriores)
    values (tg_table_schema, tg_table_name, tg_op, auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;
