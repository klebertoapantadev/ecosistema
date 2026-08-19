-- Migration: 20260819000001_registrar_widget_firma_documentos_pdf.sql
-- Registra el widget modular 'firma_documentos_pdf' para todos los negocios en comun_seguridad.seg_widget
-- y lo deja disponible para cualquier rol del ecosistema (CLIENTE, ABOGADO, OPERADOR, ADMINISTRADOR, SUPERADMIN).

DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- 1. Insertar o actualizar el widget en el catálogo global
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_creado_en) VALUES
      (v_negocio, 'firma_documentos_pdf', 'Firma Electrónica de Documentos PDF', true, NOW())
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true;

    -- 2. Asignar el widget a todos los roles del ecosistema
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
    SELECT v_negocio, rol_nombre, wdg_id
    FROM comun_seguridad.seg_widget
    CROSS JOIN (
      VALUES ('CLIENTE'), ('ABOGADO'), ('OPERADOR'), ('AUXILIAR'), ('TECNICO'), ('ADMINISTRADOR'), ('SUPERADMIN')
    ) AS roles(rol_nombre)
    WHERE wdg_clave = 'firma_documentos_pdf'
      AND wdg_negocio = v_negocio
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

  END LOOP;
END $$;
