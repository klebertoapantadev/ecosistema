-- Migration: 20260813000002_register_missing_widgets.sql
-- Registra los widgets faltantes en el inventario global de la base de datos (seg_widget)
-- Esto permite que aparezcan en la administración de perfiles y se asignen a los paneles.

-- 1. Insertar en seg_widget
INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo) VALUES
  ('tranqi', 'configuracion_contrato_abogado', 'Configuración de Contrato de Socios', true),
  ('tranqi', 'gestion_terminos_consentimientos', 'Términos, Consentimientos & LOPDP', true),
  ('tranqi', 'bitacora_notificaciones', 'Bitácora & Historial de Notificaciones', true)
ON CONFLICT (wdg_negocio, wdg_clave) DO NOTHING;

-- 2. Vincular automáticamente por defecto a ADMINISTRADOR y SUPERADMIN (puesto que son de administración)
INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
SELECT 'tranqi', 'ADMINISTRADOR', wdg_id 
FROM comun_seguridad.seg_widget 
WHERE wdg_clave IN ('configuracion_contrato_abogado', 'gestion_terminos_consentimientos', 'bitacora_notificaciones') AND wdg_negocio = 'tranqi'
ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
SELECT 'tranqi', 'SUPERADMIN', wdg_id 
FROM comun_seguridad.seg_widget 
WHERE wdg_clave IN ('configuracion_contrato_abogado', 'gestion_terminos_consentimientos', 'bitacora_notificaciones') AND wdg_negocio = 'tranqi'
ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;
