-- Migración: 20260823000001_trq_billetera_documentos_ttl.sql
-- Descripción: TRQ-COM-001 - Billetera Digital de Documentos Seguros, Extracción OCR y Enlaces Efímeros (TTL)
-- Esquema: tranqui_legal

CREATE SCHEMA IF NOT EXISTS tranqui_legal;

GRANT USAGE ON SCHEMA tranqui_legal TO authenticated, service_role, anon;

--------------------------------------------------------------------------------
-- 1. TABLA: tranqui_legal.trq_billetera_documento (doc_)
-- Bóveda digital de documentos personales, vehiculares, contratos y profesionales
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tranqui_legal.trq_billetera_documento (
  doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  doc_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE,
  doc_negocio VARCHAR(10) NOT NULL DEFAULT 'TRANQ',
  doc_categoria VARCHAR(30) NOT NULL CHECK (doc_categoria IN ('identidad', 'vehicular', 'contratos', 'profesional', 'otros')),
  doc_tipo VARCHAR(40) NOT NULL,
  doc_titulo TEXT NOT NULL,
  doc_archivo_url TEXT,
  doc_archivo_nombre TEXT NOT NULL,
  doc_archivo_tamano BIGINT NOT NULL DEFAULT 0,
  doc_archivo_mimetype VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  doc_archivo_base64 TEXT,
  doc_entidad_emisora TEXT,
  doc_numero_documento TEXT,
  doc_fecha_emision TIMESTAMPTZ,
  doc_fecha_caducidad TIMESTAMPTZ,
  doc_titular_nombre TEXT,
  doc_titular_identificacion TEXT,
  doc_metadatos_ocr JSONB DEFAULT '{}'::jsonb,
  doc_detalles JSONB DEFAULT '{}'::jsonb,
  doc_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  doc_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  doc_eliminado_en TIMESTAMPTZ
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_trq_billetera_usuario 
  ON tranqui_legal.trq_billetera_documento(doc_usuario_id, doc_categoria, doc_eliminado_en);

CREATE INDEX IF NOT EXISTS idx_trq_billetera_caducidad 
  ON tranqui_legal.trq_billetera_documento(doc_fecha_caducidad) 
  WHERE doc_eliminado_en IS NULL;

-- RLS en trq_billetera_documento
ALTER TABLE tranqui_legal.trq_billetera_documento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trq_billetera_select_propio ON tranqui_legal.trq_billetera_documento;
CREATE POLICY trq_billetera_select_propio ON tranqui_legal.trq_billetera_documento
  FOR SELECT USING (
    doc_usuario_id = auth.uid()
    OR comun_seguridad.seg_fn_es_operador_o_admin_negocio(doc_negocio)
  );

DROP POLICY IF EXISTS trq_billetera_insert_propio ON tranqui_legal.trq_billetera_documento;
CREATE POLICY trq_billetera_insert_propio ON tranqui_legal.trq_billetera_documento
  FOR INSERT WITH CHECK (
    doc_usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS trq_billetera_update_propio ON tranqui_legal.trq_billetera_documento;
CREATE POLICY trq_billetera_update_propio ON tranqui_legal.trq_billetera_documento
  FOR UPDATE USING (
    doc_usuario_id = auth.uid()
    OR comun_seguridad.seg_fn_es_operador_o_admin_negocio(doc_negocio)
  );

DROP POLICY IF EXISTS trq_billetera_delete_propio ON tranqui_legal.trq_billetera_documento;
CREATE POLICY trq_billetera_delete_propio ON tranqui_legal.trq_billetera_documento
  FOR DELETE USING (
    doc_usuario_id = auth.uid()
  );

--------------------------------------------------------------------------------
-- 2. TABLA: tranqui_legal.trq_enlace_compartido_ttl (ttl_)
-- Tokens y enlaces efímeros protegidos con tiempo de expiración
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tranqui_legal.trq_enlace_compartido_ttl (
  ttl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ttl_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  ttl_documento_id UUID NOT NULL REFERENCES tranqui_legal.trq_billetera_documento(doc_id) ON DELETE CASCADE,
  ttl_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE,
  ttl_token TEXT NOT NULL UNIQUE,
  ttl_modo_expiracion VARCHAR(20) NOT NULL DEFAULT '24h' CHECK (ttl_modo_expiracion IN ('1h', '3h', '6h', '12h', '24h', '3d', '7d', '30d', 'una_vista', 'fecha_fija')),
  ttl_expira_en TIMESTAMPTZ NOT NULL,
  ttl_una_sola_vista BOOLEAN NOT NULL DEFAULT FALSE,
  ttl_visto_en TIMESTAMPTZ,
  ttl_visitas_conteo INT NOT NULL DEFAULT 0,
  ttl_pin_hash TEXT,
  ttl_activo BOOLEAN NOT NULL DEFAULT TRUE,
  ttl_detalles JSONB DEFAULT '{}'::jsonb,
  ttl_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trq_enlace_ttl_token 
  ON tranqui_legal.trq_enlace_compartido_ttl(ttl_token) 
  WHERE ttl_activo = TRUE;

-- RLS en trq_enlace_compartido_ttl
ALTER TABLE tranqui_legal.trq_enlace_compartido_ttl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trq_enlace_ttl_select_propio ON tranqui_legal.trq_enlace_compartido_ttl;
CREATE POLICY trq_enlace_ttl_select_propio ON tranqui_legal.trq_enlace_compartido_ttl
  FOR SELECT USING (
    ttl_usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS trq_enlace_ttl_insert_propio ON tranqui_legal.trq_enlace_compartido_ttl;
CREATE POLICY trq_enlace_ttl_insert_propio ON tranqui_legal.trq_enlace_compartido_ttl
  FOR INSERT WITH CHECK (
    ttl_usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS trq_enlace_ttl_update_propio ON tranqui_legal.trq_enlace_compartido_ttl;
CREATE POLICY trq_enlace_ttl_update_propio ON tranqui_legal.trq_enlace_compartido_ttl
  FOR UPDATE USING (
    ttl_usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS trq_enlace_ttl_delete_propio ON tranqui_legal.trq_enlace_compartido_ttl;
CREATE POLICY trq_enlace_ttl_delete_propio ON tranqui_legal.trq_enlace_compartido_ttl
  FOR DELETE USING (
    ttl_usuario_id = auth.uid()
  );

--------------------------------------------------------------------------------
-- 3. AUDITORÍA VÍA TRIGGERS (aud_fn_auditar_tabla)
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aud_fn_auditar_tabla') THEN
    DROP TRIGGER IF EXISTS trg_aud_trq_billetera_documento ON tranqui_legal.trq_billetera_documento;
    CREATE TRIGGER trg_aud_trq_billetera_documento
      AFTER INSERT OR UPDATE OR DELETE ON tranqui_legal.trq_billetera_documento
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

    DROP TRIGGER IF EXISTS trg_aud_trq_enlace_compartido_ttl ON tranqui_legal.trq_enlace_compartido_ttl;
    CREATE TRIGGER trg_aud_trq_enlace_compartido_ttl
      AFTER INSERT OR UPDATE OR DELETE ON tranqui_legal.trq_enlace_compartido_ttl
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 4. REGISTRO DEL WIDGET EN comun_seguridad.seg_widget
--------------------------------------------------------------------------------
DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    INSERT INTO comun_seguridad.seg_widget (
      wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en
    ) VALUES (
      v_negocio,
      'billetera_documentos',
      'Billetera Digital de Documentos Seguros',
      true,
      jsonb_build_object(
        'descripcion', 'Bóveda digital de documentos personales, vehiculares, contratos y profesionales con OCR y TTL',
        'categoria', 'Herramientas Digitales',
        'ruta', '/panel/billetera-documentos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'Folder'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, rol_nombre, wdg_id, true
    FROM comun_seguridad.seg_widget
    CROSS JOIN (
      VALUES ('CLIENTE'), ('ABOGADO'), ('OPERADOR'), ('AUXILIAR'), ('TECNICO'), ('ADMINISTRADOR'), ('SUPERADMIN')
    ) AS roles(rol_nombre)
    WHERE wdg_clave = 'billetera_documentos'
      AND wdg_negocio = v_negocio
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;
  END LOOP;
END $$;

-- Permisos generales
GRANT ALL ON ALL TABLES IN SCHEMA tranqui_legal TO authenticated, service_role;
GRANT SELECT ON tranqui_legal.trq_enlace_compartido_ttl TO anon;
