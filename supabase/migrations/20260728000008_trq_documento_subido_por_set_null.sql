-- Fix: mismo patron que 20260728000004 (trq_revision_solicitud.rev_admin_id)
-- -- trq_documento_socio.dcs_subido_por quedo NOT NULL con FK sin ON DELETE
-- (RESTRICT por defecto), bloqueando la baja de cuenta (PLT-012) de
-- cualquiera que haya subido un documento (solicitante o admin).
alter table tranqui_legal.trq_documento_socio alter column dcs_subido_por drop not null;
alter table tranqui_legal.trq_documento_socio drop constraint trq_documento_socio_dcs_subido_por_fkey;
alter table tranqui_legal.trq_documento_socio
  add constraint trq_documento_socio_dcs_subido_por_fkey
  foreign key (dcs_subido_por) references comun_seguridad.seg_usuario(usu_id) on delete set null;
