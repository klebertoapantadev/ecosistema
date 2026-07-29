-- TRQ-001 correccion de UX: Auditoria salia de /panel/socios (nav de la app,
-- migracion aparte) hacia el rail top-level, visible para ADMINISTRADOR y
-- SuperAdmin. SuperAdmin ya veia todo (comun_* + tranqui_legal, sin fila en
-- seg_rol_widget). ADMINISTRADOR necesita: (1) el widget asignado, (2) una
-- politica RLS nueva -- la existente solo dejaba pasar a SuperAdmin.
-- Se acota a reg_esquema = 'tranqui_legal' (el negocio propio del admin):
-- un ADMINISTRADOR de tranqi no debe ver auditoria de otros negocios ni de
-- esquemas comun_* (esos siguen siendo solo-SuperAdmin).

create policy aud_registro_administrador_tranqi_select on comun_auditoria.aud_registro
  for select using (
    reg_esquema = 'tranqui_legal'
    and exists (
      select 1 from comun_seguridad.seg_membresia m
      where m.mem_usuario_id = auth.uid()
        and m.mem_negocio = 'tranqi'
        and m.mem_rol = 'ADMINISTRADOR'
        and m.mem_estado = 'ACTIVO'
    )
  );

insert into comun_seguridad.seg_widget (wdg_clave, wdg_nombre, wdg_negocio, wdg_activo)
values ('auditoria', 'Auditoría', 'tranqi', true);

insert into comun_seguridad.seg_rol_widget (rlw_widget_id, rlw_negocio, rlw_rol, rlw_visible)
select wdg_id, 'tranqi', 'ADMINISTRADOR', true
from comun_seguridad.seg_widget
where wdg_clave = 'auditoria' and wdg_negocio = 'tranqi';
