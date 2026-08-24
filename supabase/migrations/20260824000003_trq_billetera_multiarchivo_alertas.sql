-- Migration: 20260824000003_trq_billetera_multiarchivo_alertas.sql
-- Amplía la tabla tranqui_legal.trq_billetera_documento para soporte de:
-- 1. Múltiples archivos por documento (doc_archivos JSONB)
-- 2. Fecha de nacimiento (doc_fecha_nacimiento TIMESTAMPTZ)
-- 3. Alertas de caducidad configurables (doc_alertar_caducidad BOOLEAN, doc_meses_anticipacion_alerta INTEGER)

DO $$
BEGIN
  -- doc_archivos: Lista estructurada de archivos adjuntos al documento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'tranqui_legal' 
    AND table_name = 'trq_billetera_documento' 
    AND column_name = 'doc_archivos'
  ) THEN
    ALTER TABLE tranqui_legal.trq_billetera_documento 
    ADD COLUMN doc_archivos JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- doc_fecha_nacimiento: Fecha de nacimiento del titular
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'tranqui_legal' 
    AND table_name = 'trq_billetera_documento' 
    AND column_name = 'doc_fecha_nacimiento'
  ) THEN
    ALTER TABLE tranqui_legal.trq_billetera_documento 
    ADD COLUMN doc_fecha_nacimiento TIMESTAMPTZ NULL;
  END IF;

  -- doc_alertar_caducidad: Indica si se deben disparar alertas de vencimiento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'tranqui_legal' 
    AND table_name = 'trq_billetera_documento' 
    AND column_name = 'doc_alertar_caducidad'
  ) THEN
    ALTER TABLE tranqui_legal.trq_billetera_documento 
    ADD COLUMN doc_alertar_caducidad BOOLEAN DEFAULT TRUE;
  END IF;

  -- doc_meses_anticipacion_alerta: Tiempo previo para alertar (por defecto 3 meses)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'tranqui_legal' 
    AND table_name = 'trq_billetera_documento' 
    AND column_name = 'doc_meses_anticipacion_alerta'
  ) THEN
    ALTER TABLE tranqui_legal.trq_billetera_documento 
    ADD COLUMN doc_meses_anticipacion_alerta INTEGER DEFAULT 3;
  END IF;
END $$;
