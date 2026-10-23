-- Migración: 20261023000002_trq_contacto_empresa.sql
-- Tabla para solicitudes de contacto e información corporativa B2B de Tranqi

CREATE TABLE IF NOT EXISTS tranqui_legal.trq_contacto_empresa (
  cte_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  cte_empresa TEXT NOT NULL,
  cte_ruc VARCHAR(13),
  cte_nombre_contacto TEXT NOT NULL,
  cte_cargo TEXT,
  cte_correo TEXT NOT NULL,
  cte_telefono TEXT NOT NULL,
  cte_empleados_rango TEXT,
  cte_interes TEXT,
  cte_mensaje TEXT,
  cte_estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  cte_detalles JSONB DEFAULT '{}'::jsonb,
  cte_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS obligatorio
ALTER TABLE tranqui_legal.trq_contacto_empresa ENABLE ROW LEVEL SECURITY;

-- Permitir inserción desde formulario público
DROP POLICY IF EXISTS trq_contacto_empresa_insert_public ON tranqui_legal.trq_contacto_empresa;
CREATE POLICY trq_contacto_empresa_insert_public ON tranqui_legal.trq_contacto_empresa
  FOR INSERT WITH CHECK (true);

-- Permitir lectura y gestión a staff y superadmin
DROP POLICY IF EXISTS trq_contacto_empresa_select_staff ON tranqui_legal.trq_contacto_empresa;
CREATE POLICY trq_contacto_empresa_select_staff ON tranqui_legal.trq_contacto_empresa
  FOR SELECT USING (
    comun_seguridad.seg_fn_es_superadmin()
    OR comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), 'TRANQ')
    OR comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), 'tranqi')
  );

-- Auditoría obligatoria
DROP TRIGGER IF EXISTS trg_aud_trq_contacto_empresa ON tranqui_legal.trq_contacto_empresa;
CREATE TRIGGER trg_aud_trq_contacto_empresa
  AFTER INSERT OR UPDATE OR DELETE ON tranqui_legal.trq_contacto_empresa
  FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

GRANT USAGE ON SCHEMA tranqui_legal TO anon, authenticated;
GRANT INSERT ON tranqui_legal.trq_contacto_empresa TO anon, authenticated;
GRANT SELECT, UPDATE ON tranqui_legal.trq_contacto_empresa TO authenticated;
