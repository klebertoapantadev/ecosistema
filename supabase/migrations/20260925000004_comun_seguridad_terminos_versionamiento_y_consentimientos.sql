-- Migración: 20260925000004_comun_seguridad_terminos_versionamiento_y_consentimientos.sql
-- Descripción: Tablas maestras para versionamiento de Términos, Cláusulas LOPDP, Contratos y Beneficios,
-- junto con la bitácora multi-negocio de consentimientos de usuarios (aceptación/rechazo).

-- 1. Tabla de Documentos / Cláusulas Maestras de Términos y Contratos
CREATE TABLE IF NOT EXISTS comun_seguridad.seg_termino_documento (
  ted_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ted_negocio TEXT NOT NULL,
  ted_clave TEXT NOT NULL,
  ted_titulo TEXT NOT NULL,
  ted_tipo TEXT NOT NULL DEFAULT 'terminos', -- 'terminos' | 'beneficios' | 'contratos'
  ted_version_actual TEXT NOT NULL DEFAULT 'v1.0.0',
  ted_fecha_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  ted_requiere_aceptacion BOOLEAN NOT NULL DEFAULT true,
  ted_contenido_markdown TEXT NOT NULL,
  ted_activo BOOLEAN NOT NULL DEFAULT true,
  ted_creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ted_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ted_detalle_documento JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_seg_termino_negocio_clave UNIQUE (ted_negocio, ted_clave)
);

-- 2. Tabla de Historial de Versiones de Términos y Contratos
CREATE TABLE IF NOT EXISTS comun_seguridad.seg_termino_historial_version (
  thv_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thv_documento_id UUID REFERENCES comun_seguridad.seg_termino_documento(ted_id) ON DELETE CASCADE,
  thv_negocio TEXT NOT NULL,
  thv_clave TEXT NOT NULL,
  thv_version TEXT NOT NULL,
  thv_titulo TEXT NOT NULL,
  thv_fecha_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  thv_requiere_aceptacion BOOLEAN NOT NULL DEFAULT true,
  thv_contenido_markdown TEXT NOT NULL,
  thv_notas_cambio TEXT,
  thv_creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  thv_creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  thv_detalle_version JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Tabla de Bitácora / Auditoría de Consentimientos de Usuarios por Negocio
CREATE TABLE IF NOT EXISTS comun_seguridad.seg_usuario_consentimiento (
  usc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usc_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usc_negocio TEXT NOT NULL,
  usc_clave_documento TEXT NOT NULL,
  usc_version TEXT NOT NULL,
  usc_estado TEXT NOT NULL DEFAULT 'ACEPTADO', -- 'ACEPTADO' | 'RECHAZADO' | 'REVOCADO'
  usc_fecha_accion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  usc_ip TEXT,
  usc_user_agent TEXT,
  usc_hash_contenido TEXT,
  usc_metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  usc_detalle_consentimiento JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_ted_negocio_clave ON comun_seguridad.seg_termino_documento(ted_negocio, ted_clave);
CREATE INDEX IF NOT EXISTS idx_thv_documento ON comun_seguridad.seg_termino_historial_version(thv_negocio, thv_clave, thv_creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_usc_usuario_negocio ON comun_seguridad.seg_usuario_consentimiento(usc_usuario_id, usc_negocio, usc_fecha_accion DESC);
CREATE INDEX IF NOT EXISTS idx_usc_negocio_clave ON comun_seguridad.seg_usuario_consentimiento(usc_negocio, usc_clave_documento, usc_fecha_accion DESC);

-- Habilitar RLS en el 100% de las tablas
ALTER TABLE comun_seguridad.seg_termino_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE comun_seguridad.seg_termino_historial_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE comun_seguridad.seg_usuario_consentimiento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para seg_termino_documento
DROP POLICY IF EXISTS p_ted_select_public ON comun_seguridad.seg_termino_documento;
CREATE POLICY p_ted_select_public ON comun_seguridad.seg_termino_documento
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS p_ted_manage_admin ON comun_seguridad.seg_termino_documento;
CREATE POLICY p_ted_manage_admin ON comun_seguridad.seg_termino_documento
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m
      JOIN comun_seguridad.seg_membresia_perfil mp ON mp.mpe_membresia_id = m.mem_id
      JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
      WHERE m.mem_usuario_id = auth.uid()
        AND (p.per_clave IN ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR') OR p.per_nivel >= 50)
    )
  );

-- Políticas RLS para seg_termino_historial_version
DROP POLICY IF EXISTS p_thv_select_auth ON comun_seguridad.seg_termino_historial_version;
CREATE POLICY p_thv_select_auth ON comun_seguridad.seg_termino_historial_version
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_thv_manage_admin ON comun_seguridad.seg_termino_historial_version;
CREATE POLICY p_thv_manage_admin ON comun_seguridad.seg_termino_historial_version
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m
      JOIN comun_seguridad.seg_membresia_perfil mp ON mp.mpe_membresia_id = m.mem_id
      JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
      WHERE m.mem_usuario_id = auth.uid()
        AND (p.per_clave IN ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR') OR p.per_nivel >= 50)
    )
  );

-- Políticas RLS para seg_usuario_consentimiento
DROP POLICY IF EXISTS p_usc_select_own ON comun_seguridad.seg_usuario_consentimiento;
CREATE POLICY p_usc_select_own ON comun_seguridad.seg_usuario_consentimiento
  FOR SELECT TO authenticated
  USING (
    usc_usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m
      JOIN comun_seguridad.seg_membresia_perfil mp ON mp.mpe_membresia_id = m.mem_id
      JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
      WHERE m.mem_usuario_id = auth.uid()
        AND (p.per_clave IN ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR') OR p.per_nivel >= 50)
    )
  );

DROP POLICY IF EXISTS p_usc_insert_own ON comun_seguridad.seg_usuario_consentimiento;
CREATE POLICY p_usc_insert_own ON comun_seguridad.seg_usuario_consentimiento
  FOR INSERT TO authenticated
  WITH CHECK (usc_usuario_id = auth.uid());

-- Triggers de auditoría obligatorios
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aud_fn_auditar_tabla') THEN
    DROP TRIGGER IF EXISTS trg_aud_seg_termino_documento ON comun_seguridad.seg_termino_documento;
    CREATE TRIGGER trg_aud_seg_termino_documento
      AFTER INSERT OR UPDATE OR DELETE ON comun_seguridad.seg_termino_documento
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

    DROP TRIGGER IF EXISTS trg_aud_seg_termino_historial_version ON comun_seguridad.seg_termino_historial_version;
    CREATE TRIGGER trg_aud_seg_termino_historial_version
      AFTER INSERT OR UPDATE OR DELETE ON comun_seguridad.seg_termino_historial_version
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

    DROP TRIGGER IF EXISTS trg_aud_seg_usuario_consentimiento ON comun_seguridad.seg_usuario_consentimiento;
    CREATE TRIGGER trg_aud_seg_usuario_consentimiento
      AFTER INSERT OR UPDATE OR DELETE ON comun_seguridad.seg_usuario_consentimiento
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();
  END IF;
END $$;
