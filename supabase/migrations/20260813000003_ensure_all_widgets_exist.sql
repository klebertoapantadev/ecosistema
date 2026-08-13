-- Migration: 20260813000003_ensure_all_widgets_exist.sql
-- Garantiza que todos los widgets existentes físicamente en el ecosistema estén creados y registrados en la base de datos

-- 1. Insertar o actualizar todos los widgets modulares
INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_creado_en) VALUES
  ('tranqi', 'gestion_usuarios', 'Gestión de Usuarios & Membresías', true, '2026-07-27T00:00:00Z'),
  ('tranqi', 'consulta_usuarios_perfiles', 'Consulta de Usuarios & Perfiles', true, '2026-07-31T00:00:00Z'),
  ('tranqi', 'socios', 'Aprobación de Socios Abogados', true, '2026-07-28T00:00:00Z'),
  ('tranqi', 'solicitud_socio', 'Solicitudes de Socios', true, '2026-07-28T00:00:00Z'),
  ('tranqi', 'configuracion_correo', 'Servidor de Correo SMTP', true, '2026-07-30T00:00:00Z'),
  ('tranqi', 'perfiles', 'Administración de Perfiles & Permisos', true, '2026-07-31T00:00:00Z'),
  ('tranqi', 'emision_notificaciones', 'Emisión de Notificaciones Multicanal', true, '2026-08-02T00:00:00Z'),
  ('tranqi', 'bitacora_notificaciones', 'Bitácora & Historial de Notificaciones', true, '2026-08-13T00:00:00Z'),
  ('tranqi', 'gestion_terminos_consentimientos', 'Términos, Consentimientos & LOPDP', true, '2026-08-13T00:00:00Z'),
  ('tranqi', 'auditoria', 'Auditoría por Triggers BDD', true, '2026-07-28T00:00:00Z'),
  ('tranqi', 'configuracion_contrato_abogado', 'Configuración de Contrato de Socios', true, '2026-08-13T00:00:00Z'),
  ('tranqi', 'configuracion_negocio', 'Configuración del Negocio', true, '2026-07-27T00:00:00Z')
ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_creado_en = EXCLUDED.wdg_creado_en;

-- 2. Asegurar que ADMINISTRADOR tengan acceso a los nuevos widgets por defecto
INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
SELECT 'tranqi', 'ADMINISTRADOR', wdg_id 
FROM comun_seguridad.seg_widget 
WHERE wdg_clave IN ('configuracion_contrato_abogado', 'gestion_terminos_consentimientos', 'bitacora_notificaciones', 'solicitud_socio') AND wdg_negocio = 'tranqi'
ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

-- 3. Asegurar que SUPERADMIN tengan acceso a los nuevos widgets por defecto
INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
SELECT 'tranqi', 'SUPERADMIN', wdg_id 
FROM comun_seguridad.seg_widget 
WHERE wdg_clave IN ('configuracion_contrato_abogado', 'gestion_terminos_consentimientos', 'bitacora_notificaciones', 'solicitud_socio') AND wdg_negocio = 'tranqi'
ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;
