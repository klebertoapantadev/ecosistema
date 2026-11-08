-- ==============================================================================
-- Migración: 20261108000001_tranqui_legal_red_profesional_abogados.sql
-- Módulo: Gestión de Red Profesional de Abogados (Alta Manual desde Usuarios,
--         Conversión en Socio Abogado, Gestión de Especialidades, Cobertura y
--         Disponibilidad Presencial/Teleconsulta, y Purga de Solicitudes).
-- ==============================================================================

-- 1. Desacoplar trq_abogado de trq_solicitud_socio para permitir el registro
--    manual / conversión directa por parte del operador sin depender del
--    auto-registro (solicitud previa).
alter table tranqui_legal.trq_abogado
  alter column abg_solicitud_id drop not null;

alter table tranqui_legal.trq_abogado
  drop constraint if exists trq_abogado_abg_solicitud_id_fkey;

alter table tranqui_legal.trq_abogado
  add constraint trq_abogado_abg_solicitud_id_fkey
  foreign key (abg_solicitud_id)
  references tranqui_legal.trq_solicitud_socio(ssc_id)
  on delete set null;

-- 2. Añadir columnas de ficha profesional directamente en trq_abogado
alter table tranqui_legal.trq_abogado
  add column if not exists abg_cedula text,
  add column if not exists abg_matricula_profesional text,
  add column if not exists abg_telefono text,
  add column if not exists abg_universidad text,
  add column if not exists abg_anio_graduacion int,
  add column if not exists abg_anos_experiencia int not null default 0,
  add column if not exists abg_resumen_profesional text,
  add column if not exists abg_origen_registro text not null default 'manual_operador',
  add column if not exists abg_detalle_abogado jsonb not null default '{}'::jsonb;

alter table tranqui_legal.trq_abogado
  drop constraint if exists trq_abogado_origen_registro_check;

alter table tranqui_legal.trq_abogado
  add constraint trq_abogado_origen_registro_check
  check (abg_origen_registro in ('manual_operador', 'autogestion'));

-- 3. Eliminar por completo todas las solicitudes de socio abogado existentes
--    y cualquier registro previo dependiente de ellas.
delete from tranqui_legal.trq_honorario
where hon_abogado_id in (
  select abg_id from tranqui_legal.trq_abogado where abg_solicitud_id is not null
);

delete from tranqui_legal.trq_abogado
where abg_solicitud_id is not null;

delete from tranqui_legal.trq_version_contrato_socio;
delete from tranqui_legal.trq_revision_solicitud;
delete from tranqui_legal.trq_documento_socio;
delete from tranqui_legal.trq_experiencia_laboral;
delete from tranqui_legal.trq_solicitud_materia;
delete from tranqui_legal.trq_solicitud_provincia;
delete from tranqui_legal.trq_solicitud_socio;

-- 4. Actualizar políticas RLS de trq_abogado para que Operador, Administrador y
--    SuperAdmin puedan leer y gestionar la red profesional, y el abogado pueda
--    leer su propia ficha.
drop policy if exists trq_abogado_select on tranqui_legal.trq_abogado;
create policy trq_abogado_select on tranqui_legal.trq_abogado
  for select using (
    abg_usuario_id = auth.uid()
    or comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi')
    or abg_estado = 'verificado'
  );

drop policy if exists trq_abogado_staff_all on tranqui_legal.trq_abogado;
create policy trq_abogado_staff_all on tranqui_legal.trq_abogado
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi'))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi'));

drop policy if exists trq_abogado_propio_update on tranqui_legal.trq_abogado;
create policy trq_abogado_propio_update on tranqui_legal.trq_abogado
  for update using (abg_usuario_id = auth.uid())
  with check (abg_usuario_id = auth.uid());

grant select, insert, update, delete on tranqui_legal.trq_abogado to authenticated;
grant select, insert, update, delete on tranqui_legal.trq_abogado_materia to authenticated;
grant select, insert, update, delete on tranqui_legal.trq_abogado_provincia to authenticated;

-- Permitir al staff de tranqi configurar también la agenda/disponibilidad de un abogado
drop policy if exists age_profesional_staff_all on comun_agenda.age_profesional;
create policy age_profesional_staff_all on comun_agenda.age_profesional
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(agp_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(agp_negocio));

drop policy if exists age_franja_staff_all on comun_agenda.age_franja;
create policy age_franja_staff_all on comun_agenda.age_franja
  for all using (
    exists (
      select 1 from comun_agenda.age_profesional p
      where p.agp_id = fra_profesional_id
        and comun_seguridad.seg_fn_es_operador_o_admin_negocio(p.agp_negocio)
    )
  )
  with check (
    exists (
      select 1 from comun_agenda.age_profesional p
      where p.agp_id = fra_profesional_id
        and comun_seguridad.seg_fn_es_operador_o_admin_negocio(p.agp_negocio)
    )
  );

-- 5. RPC para purgar por completo todas las solicitudes de socio abogado
create or replace function tranqui_legal.trq_fn_purgar_solicitudes_socio()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminadas int := 0;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi') then
    raise exception 'No autorizado para eliminar solicitudes de socios.';
  end if;

  update tranqui_legal.trq_abogado
     set abg_solicitud_id = null
   where abg_solicitud_id is not null;

  delete from tranqui_legal.trq_version_contrato_socio;
  delete from tranqui_legal.trq_revision_solicitud;
  delete from tranqui_legal.trq_documento_socio;
  delete from tranqui_legal.trq_experiencia_laboral;
  delete from tranqui_legal.trq_solicitud_materia;
  delete from tranqui_legal.trq_solicitud_provincia;

  with borradas as (
    delete from tranqui_legal.trq_solicitud_socio
    returning ssc_id
  )
  select count(*)::int into v_eliminadas from borradas;

  return v_eliminadas;
end;
$$;

grant execute on function tranqui_legal.trq_fn_purgar_solicitudes_socio() to authenticated;

-- 6. Registro de nuevos widgets en comun_seguridad.seg_widget y seg_rol_widget
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi', 'gestion_red_abogados', 'Gestión de Red Profesional & Abogados'),
  ('tranqi', 'mi_perfil_abogado',    'Mi Perfil Profesional, Especialidades y Cobertura')
on conflict (wdg_negocio, wdg_clave) do update
  set wdg_nombre = excluded.wdg_nombre;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select 'tranqi', r.rol, w.wdg_id
from comun_seguridad.seg_widget w
cross join (values ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_negocio = 'tranqi'
  and w.wdg_clave = 'gestion_red_abogados'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select 'tranqi', r.rol, w.wdg_id
from comun_seguridad.seg_widget w
cross join (values ('ABOGADO'), ('SUPERADMIN')) as r(rol)
where w.wdg_negocio = 'tranqi'
  and w.wdg_clave = 'mi_perfil_abogado'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;

