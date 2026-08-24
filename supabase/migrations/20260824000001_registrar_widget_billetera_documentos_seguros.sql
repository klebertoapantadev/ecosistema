-- Migration: 20260824000001_registrar_widget_billetera_documentos_seguros.sql
-- Registra el widget modular 'billetera_documentos' para todos los negocios en comun_seguridad.seg_widget
-- y lo deja disponible para asignar a los perfiles del ecosistema (CLIENTE, ABOGADO, OPERADOR, ADMINISTRADOR, SUPERADMIN).

DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- 1. Insertar o actualizar el widget en el catálogo global
    INSERT INTO comun_seguridad.seg_widget (
      wdg_negocio, 
      wdg_clave, 
      wdg_nombre, 
      wdg_activo, 
      wdg_detalle_widget,
      wdg_creado_en
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
    SET 
      wdg_nombre = EXCLUDED.wdg_nombre, 
      wdg_activo = true,
      wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 2. Asignar el widget a todos los roles del ecosistema en seg_rol_widget
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
