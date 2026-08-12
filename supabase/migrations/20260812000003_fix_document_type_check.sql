-- Migration: 20260812000003_fix_document_type_check.sql
-- Actualizar restricción dcs_tipo para soportar foto_perfil y cv
-- Añadir políticas DELETE para evitar duplicados en actualizaciones de solicitudes

alter table tranqui_legal.trq_documento_socio drop constraint if exists trq_documento_socio_dcs_tipo_check;
alter table tranqui_legal.trq_documento_socio add constraint trq_documento_socio_dcs_tipo_check check (dcs_tipo in ('foto_perfil', 'titulo', 'matricula', 'cedula', 'cv', 'otro'));

-- Crear políticas DELETE para trq_experiencia_laboral
drop policy if exists trq_experiencia_laboral_delete on tranqui_legal.trq_experiencia_laboral;
create policy trq_experiencia_laboral_delete on tranqui_legal.trq_experiencia_laboral
  for delete using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = exp_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Crear políticas DELETE para trq_solicitud_materia
drop policy if exists trq_solicitud_materia_delete on tranqui_legal.trq_solicitud_materia;
create policy trq_solicitud_materia_delete on tranqui_legal.trq_solicitud_materia
  for delete using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.sma_solicitud_id = ssc_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Crear políticas DELETE para trq_solicitud_provincia
drop policy if exists trq_solicitud_provincia_delete on tranqui_legal.trq_solicitud_provincia;
create policy trq_solicitud_provincia_delete on tranqui_legal.trq_solicitud_provincia
  for delete using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.spr_solicitud_id = ssc_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Crear políticas DELETE para trq_documento_socio
drop policy if exists trq_documento_socio_delete on tranqui_legal.trq_documento_socio;
create policy trq_documento_socio_delete on tranqui_legal.trq_documento_socio
  for delete using (
    exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id = dcs_solicitud_id
        and (s.ssc_usuario_id = auth.uid() or comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'))
    )
  );

-- Garantizar permisos a usuarios autenticados
grant delete, update on tranqui_legal.trq_experiencia_laboral to authenticated;
grant delete, update on tranqui_legal.trq_solicitud_materia to authenticated;
grant delete, update on tranqui_legal.trq_solicitud_provincia to authenticated;
grant delete, update on tranqui_legal.trq_documento_socio to authenticated;
