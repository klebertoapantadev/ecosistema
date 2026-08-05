-- Migración: 20260805000001_comun_reclutamiento.sql
-- Descripción: Módulo común de Reclutamiento, Bolsa de Empleo y Únete al Equipo (PLT-019)
-- Esquema: comun_reclutamiento y tablas asociadas (rec_vacante, rec_postulacion)

CREATE SCHEMA IF NOT EXISTS comun_reclutamiento;

GRANT USAGE ON SCHEMA comun_reclutamiento TO authenticated, service_role, anon;

--------------------------------------------------------------------------------
-- 1. TABLA: comun_reclutamiento.rec_vacante (vac_)
-- Vacantes de empleo activas y convocatorias por negocio
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_reclutamiento.rec_vacante (
  vac_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vac_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  vac_negocio VARCHAR(10) NOT NULL CHECK (vac_negocio IN ('TRANQ', 'FFH', 'TNK', 'MRG')),
  vac_titulo VARCHAR(255) NOT NULL,
  vac_tipo_contrato VARCHAR(100) NOT NULL DEFAULT 'TIEMPO_COMPLETO',
  vac_estado VARCHAR(20) NOT NULL DEFAULT 'PUBLICADA' CHECK (vac_estado IN ('PUBLICADA', 'PAUSADA', 'CERRADA')),
  vac_notificar_email BOOLEAN NOT NULL DEFAULT TRUE,
  vac_notificar_push BOOLEAN NOT NULL DEFAULT TRUE,
  vac_detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  vac_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vac_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permisos RLS en rec_vacante
ALTER TABLE comun_reclutamiento.rec_vacante ENABLE ROW LEVEL SECURITY;

CREATE POLICY rec_vacante_select_publico ON comun_reclutamiento.rec_vacante
  FOR SELECT USING (vac_estado = 'PUBLICADA');

CREATE POLICY rec_vacante_select_admin ON comun_reclutamiento.rec_vacante
  FOR SELECT USING (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), vac_negocio)
  );

CREATE POLICY rec_vacante_insert_admin ON comun_reclutamiento.rec_vacante
  FOR INSERT WITH CHECK (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), vac_negocio)
  );

CREATE POLICY rec_vacante_update_admin ON comun_reclutamiento.rec_vacante
  FOR UPDATE USING (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), vac_negocio)
  );

--------------------------------------------------------------------------------
-- 2. TABLA: comun_reclutamiento.rec_postulacion (pos_)
-- Expedientes de postulantes y carga de Hoja de Vida / Adjuntos
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_reclutamiento.rec_postulacion (
  pos_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  pos_negocio VARCHAR(10) NOT NULL CHECK (pos_negocio IN ('TRANQ', 'FFH', 'TNK', 'MRG')),
  pos_vacante_id UUID REFERENCES comun_reclutamiento.rec_vacante(vac_id) ON DELETE SET NULL,
  pos_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(seg_id) ON DELETE CASCADE,
  pos_estado VARCHAR(30) NOT NULL DEFAULT 'NUEVO' CHECK (pos_estado IN ('NUEVO', 'EN_REVISION', 'ENTREVISTADO', 'APROBADO', 'RECHAZADO')),
  pos_cv_url TEXT NOT NULL,
  pos_documentos_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  pos_consentimiento_lopdp BOOLEAN NOT NULL DEFAULT TRUE,
  pos_detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  pos_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pos_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permisos RLS en rec_postulacion
ALTER TABLE comun_reclutamiento.rec_postulacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY rec_postulacion_select_propio ON comun_reclutamiento.rec_postulacion
  FOR SELECT USING (
    pos_usuario_id = auth.uid()
  );

CREATE POLICY rec_postulacion_insert_propio ON comun_reclutamiento.rec_postulacion
  FOR INSERT WITH CHECK (
    pos_usuario_id = auth.uid()
  );

CREATE POLICY rec_postulacion_select_admin ON comun_reclutamiento.rec_postulacion
  FOR SELECT USING (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), pos_negocio)
  );

CREATE POLICY rec_postulacion_update_admin ON comun_reclutamiento.rec_postulacion
  FOR UPDATE USING (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), pos_negocio)
  );

--------------------------------------------------------------------------------
-- 3. ASIGNACIÓN DE TRIGGERS DE AUDITORÍA AUTOMÁTICA (ANTES / DESPUÉS)
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aud_fn_auditar_tabla') THEN
    CREATE TRIGGER trg_auditar_rec_vacante
      AFTER INSERT OR UPDATE OR DELETE ON comun_reclutamiento.rec_vacante
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

    CREATE TRIGGER trg_auditar_rec_postulacion
      AFTER INSERT OR UPDATE OR DELETE ON comun_reclutamiento.rec_postulacion
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();
  END IF;
END $$;
