-- comun_seguridad: identidad unica de usuario (seg_usuario), membresia/rol por
-- negocio (seg_membresia) y el sistema de widgets configurables por rol
-- (seg_widget, seg_rol_widget) que implementa PLT-001/002/003. Ver
-- gobernanza/productos/plataforma/especificacion-{funcional,tecnica}.md.

create schema if not exists comun_seguridad;

create table comun_seguridad.seg_usuario (
  usu_id uuid primary key references auth.users(id) on delete cascade,
  usu_secuencial bigint generated always as identity,
  usu_nombres text,
  usu_apellidos text,
  usu_correo text not null,
  usu_whatsapp text,
  usu_cedula text,
  usu_provincia_id uuid,
  usu_ciudad_id uuid,
  usu_superadmin_plataforma boolean not null default false,
  usu_detalle_usuario jsonb not null default '{}'::jsonb,
  usu_creado_en timestamptz not null default now(),
  usu_actualizado_en timestamptz not null default now()
);

create table comun_seguridad.seg_membresia (
  mem_id uuid primary key default gen_random_uuid(),
  mem_secuencial bigint generated always as identity,
  mem_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  mem_negocio text not null, -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'
  mem_rol text not null default 'CLIENTE', -- 'CLIENTE' | 'ADMINISTRADOR' | 'OPERADOR' | 'ABOGADO' | 'TECNICO' ...
  mem_estado text not null default 'ACTIVO', -- 'ACTIVO' | 'PENDIENTE' | 'SUSPENDIDO' | 'INACTIVO'
  mem_fecha_registro timestamptz not null default now(),
  mem_detalle_membresia jsonb not null default '{}'::jsonb,
  mem_creado_en timestamptz not null default now(),
  mem_actualizado_en timestamptz not null default now(),
  unique (mem_usuario_id, mem_negocio)
);

-- Catalogo de widgets (funcionalidades) por negocio, y su asignacion dinamica
-- por rol -- editable desde consola, no fijo en codigo.
create table comun_seguridad.seg_widget (
  wdg_id uuid primary key default gen_random_uuid(),
  wdg_secuencial bigint generated always as identity,
  wdg_negocio text not null,
  wdg_clave text not null,
  wdg_nombre text not null,
  wdg_activo boolean not null default true,
  wdg_detalle_widget jsonb not null default '{}'::jsonb,
  wdg_creado_en timestamptz not null default now(),
  wdg_actualizado_en timestamptz not null default now(),
  unique (wdg_negocio, wdg_clave)
);

create table comun_seguridad.seg_rol_widget (
  rlw_id uuid primary key default gen_random_uuid(),
  rlw_secuencial bigint generated always as identity,
  rlw_negocio text not null,
  rlw_rol text not null,
  rlw_widget_id uuid not null references comun_seguridad.seg_widget(wdg_id) on delete cascade,
  rlw_visible boolean not null default true,
  rlw_creado_en timestamptz not null default now(),
  rlw_actualizado_en timestamptz not null default now(),
  unique (rlw_negocio, rlw_rol, rlw_widget_id)
);

-- Aprovisionamiento automatico: toda alta en auth.users crea su fila en seg_usuario.
-- Bootstrap: el correo del SuperAdmin de plataforma queda marcado desde el primer login real.
create or replace function comun_seguridad.seg_fn_provisionar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_superadmin boolean;
begin
  v_es_superadmin := (new.email = 'kleber.toapanta.ch@gmail.com');

  insert into comun_seguridad.seg_usuario (usu_id, usu_correo, usu_superadmin_plataforma, usu_detalle_usuario)
  values (
    new.id,
    new.email,
    v_es_superadmin,
    jsonb_build_object(
      'nombres', new.raw_user_meta_data ->> 'given_name',
      'apellidos', new.raw_user_meta_data ->> 'family_name',
      'foto', new.raw_user_meta_data ->> 'avatar_url'
    )
  )
  on conflict (usu_id) do nothing;

  return new;
end;
$$;

create trigger trg_provisionar_usuario
  after insert on auth.users
  for each row execute function comun_seguridad.seg_fn_provisionar_usuario();

-- Helper de autorizacion reutilizado en las politicas RLS de todo el ecosistema:
-- SUPERADMIN de plataforma, o ADMINISTRADOR activo del negocio dado.
create or replace function comun_seguridad.seg_fn_es_admin_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid() and u.usu_superadmin_plataforma
  ) or exists (
    select 1 from comun_seguridad.seg_membresia m
    where m.mem_usuario_id = auth.uid()
      and m.mem_negocio = p_negocio
      and m.mem_rol = 'ADMINISTRADOR'
      and m.mem_estado = 'ACTIVO'
  );
$$;

alter table comun_seguridad.seg_usuario enable row level security;
alter table comun_seguridad.seg_membresia enable row level security;
alter table comun_seguridad.seg_widget enable row level security;
alter table comun_seguridad.seg_rol_widget enable row level security;

create policy seg_usuario_propio_select on comun_seguridad.seg_usuario
  for select using (usu_id = auth.uid());

create policy seg_usuario_admin_select on comun_seguridad.seg_usuario
  for select using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = seg_usuario.usu_id
        and comun_seguridad.seg_fn_es_admin_negocio(m.mem_negocio)
    )
  );

create policy seg_usuario_propio_update on comun_seguridad.seg_usuario
  for update using (usu_id = auth.uid()) with check (usu_id = auth.uid());

create policy seg_membresia_propia_select on comun_seguridad.seg_membresia
  for select using (mem_usuario_id = auth.uid());

create policy seg_membresia_admin_select on comun_seguridad.seg_membresia
  for select using (comun_seguridad.seg_fn_es_admin_negocio(mem_negocio));

create policy seg_membresia_admin_todo on comun_seguridad.seg_membresia
  for all using (comun_seguridad.seg_fn_es_admin_negocio(mem_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio(mem_negocio));

create policy seg_widget_select on comun_seguridad.seg_widget
  for select using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid() and m.mem_negocio = seg_widget.wdg_negocio and m.mem_estado = 'ACTIVO'
    ) or comun_seguridad.seg_fn_es_admin_negocio(wdg_negocio)
  );

create policy seg_widget_admin_todo on comun_seguridad.seg_widget
  for all using (comun_seguridad.seg_fn_es_admin_negocio(wdg_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio(wdg_negocio));

create policy seg_rol_widget_select on comun_seguridad.seg_rol_widget
  for select using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid() and m.mem_negocio = seg_rol_widget.rlw_negocio and m.mem_estado = 'ACTIVO'
    ) or comun_seguridad.seg_fn_es_admin_negocio(rlw_negocio)
  );

create policy seg_rol_widget_admin_todo on comun_seguridad.seg_rol_widget
  for all using (comun_seguridad.seg_fn_es_admin_negocio(rlw_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio(rlw_negocio));

create trigger trg_auditoria_seg_usuario after insert or update or delete on comun_seguridad.seg_usuario for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_seg_membresia after insert or update or delete on comun_seguridad.seg_membresia for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_seg_widget after insert or update or delete on comun_seguridad.seg_widget for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_seg_rol_widget after insert or update or delete on comun_seguridad.seg_rol_widget for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- Politicas de lectura de auditoria (diferidas desde 001, dependian de seg_usuario)
create policy aud_registro_superadmin_select on comun_auditoria.aud_registro
  for select using (
    exists (select 1 from comun_seguridad.seg_usuario u where u.usu_id = auth.uid() and u.usu_superadmin_plataforma)
  );

create policy aud_log_api_superadmin_select on comun_auditoria.aud_log_api
  for select using (
    exists (select 1 from comun_seguridad.seg_usuario u where u.usu_id = auth.uid() and u.usu_superadmin_plataforma)
  );

-- Seed: widget obligatorio de gestion de usuarios en los 4 negocios, visible para ADMINISTRADOR.
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi', 'gestion_usuarios', 'Gestión de usuarios'),
  ('fastfix', 'gestion_usuarios', 'Gestión de usuarios'),
  ('tinkay', 'gestion_usuarios', 'Gestión de usuarios'),
  ('margaritas', 'gestion_usuarios', 'Gestión de usuarios')
on conflict (wdg_negocio, wdg_clave) do nothing;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select wdg_negocio, 'ADMINISTRADOR', wdg_id from comun_seguridad.seg_widget where wdg_clave = 'gestion_usuarios'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;

grant usage on schema comun_seguridad to authenticated;
grant select, insert, update on comun_seguridad.seg_usuario to authenticated;
grant select, insert, update, delete on comun_seguridad.seg_membresia to authenticated;
grant select, insert, update, delete on comun_seguridad.seg_widget to authenticated;
grant select, insert, update, delete on comun_seguridad.seg_rol_widget to authenticated;
