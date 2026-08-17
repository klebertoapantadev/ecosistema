-- Ampliar constraint trq_documento_socio_dcs_tipo_check para incluir contrato_socio, foto_perfil, cv e identificacion
alter table tranqui_legal.trq_documento_socio drop constraint if exists trq_documento_socio_dcs_tipo_check;

alter table tranqui_legal.trq_documento_socio
  add constraint trq_documento_socio_dcs_tipo_check
  check (dcs_tipo in ('titulo', 'matricula', 'cedula', 'identificacion', 'cv', 'foto_perfil', 'contrato_socio', 'otro', 'respaldo_revision'));
