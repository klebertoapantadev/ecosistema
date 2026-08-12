-- Migration: 20260812000004_create_contract_template.sql
-- Creación de la tabla de plantilla de contrato e inclusión del tipo de documento contrato_socio

CREATE TABLE IF NOT EXISTS tranqui_legal.trq_plantilla_contrato (
  pct_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pct_titulo TEXT NOT NULL DEFAULT 'Contrato de Prestación de Servicios de Socio Abogado',
  pct_contenido TEXT NOT NULL,
  pct_creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  pct_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tranqui_legal.trq_plantilla_contrato ENABLE ROW LEVEL SECURITY;

-- Política de lectura para todos los autenticados
CREATE POLICY trq_plantilla_contrato_select ON tranqui_legal.trq_plantilla_contrato
  FOR SELECT USING (true);

-- Política de escritura para operadores y admins de Tranqi
CREATE POLICY trq_plantilla_contrato_write ON tranqui_legal.trq_plantilla_contrato
  FOR ALL USING (comun_seguridad.seg_fn_es_operador_o_admin_negocio('TRANQ'));

-- Insertar plantilla por defecto si no existe
INSERT INTO tranqui_legal.trq_plantilla_contrato (pct_titulo, pct_contenido)
VALUES (
  'Contrato de Prestación de Servicios Profesionales y Sociedad',
  E'# CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES Y SOCIEDAD\n\nPor medio del presente documento, se celebra el Contrato de Prestación de Servicios y Acreditación de Socio Abogado entre **tranqi** y el profesional **{{nombre_completo}}**, portador de la cédula de identidad Nro. **{{cedula}}**.\n\n## ANTECEDENTES Y OBJETO\nEl Socio Abogado declara ser un profesional del derecho debidamente registrado y verificado en la SENESCYT y el Foro de Abogados del Ecuador. tranqi provee al Socio Abogado de una cuenta digital para acceder a solicitudes de asesoría jurídica.\n\n## CLÁUSULAS\n1. **Confidencialidad:** Las partes se obligan a mantener absoluta confidencialidad sobre toda la información y casos de clientes tratados a través del portal.\n2. **Veracidad:** El Socio Abogado garantiza que toda la información académica y matrículas cargadas son reales y vigentes.\n3. **Firma:** El Socio Abogado acepta descargar este contrato, firmarlo de forma manuscrita o digital en formato PDF y subirlo al portal de tranqi.\n\nEn Quito, a la fecha de aceptación de la solicitud.'
) ON CONFLICT DO NOTHING;

-- Modificar la restricción de dcs_tipo para permitir 'contrato_socio'
ALTER TABLE tranqui_legal.trq_documento_socio DROP CONSTRAINT IF EXISTS trq_documento_socio_dcs_tipo_check;
ALTER TABLE tranqui_legal.trq_documento_socio ADD CONSTRAINT trq_documento_socio_dcs_tipo_check CHECK (dcs_tipo IN ('foto_perfil', 'titulo', 'matricula', 'cedula', 'cv', 'contrato_socio', 'otro'));

-- Conceder privilegios
GRANT SELECT, INSERT, UPDATE, DELETE ON tranqui_legal.trq_plantilla_contrato TO authenticated;
