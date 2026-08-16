-- Migración: Actualización de restricciones y políticas RLS para trq_documento_socio y Storage de documentos estructurados
-- Esquema: tranqui_legal, storage

-- 1. Actualizar la restricción de tipos de documento en trq_documento_socio
ALTER TABLE tranqui_legal.trq_documento_socio DROP CONSTRAINT IF EXISTS trq_documento_socio_dcs_tipo_check;
ALTER TABLE tranqui_legal.trq_documento_socio ADD CONSTRAINT trq_documento_socio_dcs_tipo_check 
  CHECK (dcs_tipo IN ('foto_perfil', 'titulo', 'matricula', 'cedula', 'identificacion', 'cv', 'contrato_socio', 'otro', 'respaldo_revision'));

-- 2. Asegurar que dcs_subido_por tenga default auth.uid()
ALTER TABLE tranqui_legal.trq_documento_socio ALTER COLUMN dcs_subido_por SET DEFAULT auth.uid();

-- 3. Actualizar políticas RLS de trq_documento_socio
DROP POLICY IF EXISTS trq_documento_socio_insert ON tranqui_legal.trq_documento_socio;
CREATE POLICY trq_documento_socio_insert ON tranqui_legal.trq_documento_socio
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tranqui_legal.trq_solicitud_socio s 
      WHERE s.ssc_id = dcs_solicitud_id 
        AND (s.ssc_usuario_id = auth.uid() OR auth.uid() IS NOT NULL)
    )
    OR tranqui_legal.trq_fn_es_admin_mfa_verificado()
  );

DROP POLICY IF EXISTS trq_documento_socio_delete ON tranqui_legal.trq_documento_socio;
CREATE POLICY trq_documento_socio_delete ON tranqui_legal.trq_documento_socio
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tranqui_legal.trq_solicitud_socio s 
      WHERE s.ssc_id = dcs_solicitud_id 
        AND s.ssc_usuario_id = auth.uid()
    )
    OR dcs_subido_por = auth.uid()
    OR tranqui_legal.trq_fn_es_admin_mfa_verificado()
  );

DROP POLICY IF EXISTS trq_documento_socio_select ON tranqui_legal.trq_documento_socio;
CREATE POLICY trq_documento_socio_select ON tranqui_legal.trq_documento_socio
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tranqui_legal.trq_solicitud_socio s 
      WHERE s.ssc_id = dcs_solicitud_id 
        AND s.ssc_usuario_id = auth.uid()
    )
    OR dcs_subido_por = auth.uid()
    OR tranqui_legal.trq_fn_es_admin_mfa_verificado()
  );

-- 4. Actualizar políticas de Supabase Storage para el bucket 'socios-documentos'
-- Soporta tanto rutas antiguas {solicitud_id}/... como nuevas rutas estructuradas {negocio}/{usuario_id}/...
DROP POLICY IF EXISTS socios_documentos_insert ON storage.objects;
DROP POLICY IF EXISTS socios_documentos_propio_insert ON storage.objects;

CREATE POLICY socios_documentos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'socios-documentos'
    AND (
      -- Ruta nueva estructurada: TRANQ/{usuarioId}/...
      (storage.foldername(name))[2] = auth.uid()::text
      -- Ruta directa de usuario: {usuarioId}/...
      OR (storage.foldername(name))[1] = auth.uid()::text
      -- Ruta por solicitud_id: {solicitudId}/...
      OR EXISTS (
        SELECT 1 FROM tranqui_legal.trq_solicitud_socio s
        WHERE s.ssc_id::text = (storage.foldername(name))[1]
          AND s.ssc_usuario_id = auth.uid()
      )
      -- Permiso para administradores u operadores
      OR tranqui_legal.trq_fn_es_admin_mfa_verificado()
    )
  );

DROP POLICY IF EXISTS socios_documentos_select ON storage.objects;
CREATE POLICY socios_documentos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'socios-documentos'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM tranqui_legal.trq_solicitud_socio s
        WHERE s.ssc_id::text = (storage.foldername(name))[1]
          AND s.ssc_usuario_id = auth.uid()
      )
      OR tranqui_legal.trq_fn_es_admin_mfa_verificado()
    )
  );
