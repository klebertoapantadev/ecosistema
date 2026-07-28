-- Fix: trq_revision_solicitud.rev_admin_id referenciaba seg_usuario sin
-- ON DELETE, es decir RESTRICT por defecto -- cualquier administrador que
-- alguna vez acepto/rechazo una solicitud no podia dar de baja su cuenta
-- (PLT-012, seg_fn_eliminar_cuenta) sin violar esta FK. Se preserva el
-- registro de revision (auditoria real), pero se permite null en
-- rev_admin_id para no bloquear la baja de cuenta de un admin.
alter table tranqui_legal.trq_revision_solicitud alter column rev_admin_id drop not null;
alter table tranqui_legal.trq_revision_solicitud drop constraint trq_revision_solicitud_rev_admin_id_fkey;
alter table tranqui_legal.trq_revision_solicitud
  add constraint trq_revision_solicitud_rev_admin_id_fkey
  foreign key (rev_admin_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;
