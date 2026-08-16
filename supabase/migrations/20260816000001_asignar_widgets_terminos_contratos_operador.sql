-- Migration: 20260816000001_asignar_widgets_terminos_contratos_operador.sql
-- Registra el catálogo completo de widgets en comun_seguridad.seg_widget para todos los negocios
-- y asegura que estén disponibles para la configuración de perfiles y asignados a OPERADOR, ADMINISTRADOR y SUPERADMIN

DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- 1. Insertar o actualizar el catálogo completo de widgets modulares para cada negocio
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_creado_en) VALUES
      (v_negocio, 'gestion_usuarios', 'Gestión de Usuarios & Membresías', true, '2026-07-27T00:00:00Z'),
      (v_negocio, 'consulta_usuarios_perfiles', 'Consulta de Usuarios & Perfiles', true, '2026-07-31T00:00:00Z'),
      (v_negocio, 'perfiles', 'Administración de Perfiles & Permisos', true, '2026-07-31T00:00:00Z'),
      (v_negocio, 'socios', 'Aprobación de Socios Profesionales', true, '2026-07-28T00:00:00Z'),
      (v_negocio, 'solicitud_socio', 'Solicitudes de Socios', true, '2026-07-28T00:00:00Z'),
      (v_negocio, 'configuracion_correo', 'Servidor de Correo SMTP', true, '2026-07-30T00:00:00Z'),
      (v_negocio, 'configuracion_negocio', 'Configuración del Negocio', true, '2026-07-27T00:00:00Z'),
      (v_negocio, 'emision_notificaciones', 'Emisión de Notificaciones Multicanal', true, '2026-08-02T00:00:00Z'),
      (v_negocio, 'bitacora_notificaciones', 'Bitácora & Historial de Notificaciones', true, '2026-08-13T00:00:00Z'),
      (v_negocio, 'gestion_terminos_consentimientos', 'Configuración de Términos, Contratos & Beneficios', true, '2026-08-16T00:00:00Z'),
      (v_negocio, 'configuracion_contrato_abogado', 'Configuración de Contrato de Socios', true, '2026-08-13T00:00:00Z'),
      (v_negocio, 'auditoria', 'Auditoría por Triggers BDD', true, '2026-07-28T00:00:00Z'),
      (v_negocio, 'gestion_vacantes', 'Bolsa de Empleo & Vacantes', true, '2026-08-05T00:00:00Z'),
      (v_negocio, 'gestion_postulaciones', 'Gestión de Postulaciones & Candidatos', true, '2026-08-05T00:00:00Z')
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true;

    -- 2. Asignar widgets operativos a OPERADOR
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
    SELECT v_negocio, 'OPERADOR', wdg_id 
    FROM comun_seguridad.seg_widget 
    WHERE wdg_clave IN ('socios', 'configuracion_contrato_abogado', 'gestion_terminos_consentimientos', 'gestion_postulaciones', 'bitacora_notificaciones')
      AND wdg_negocio = v_negocio
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

    -- 3. Asignar todos los widgets a ADMINISTRADOR
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
    SELECT v_negocio, 'ADMINISTRADOR', wdg_id 
    FROM comun_seguridad.seg_widget 
    WHERE wdg_negocio = v_negocio
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

    -- 4. Asignar todos los widgets a SUPERADMIN
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
    SELECT v_negocio, 'SUPERADMIN', wdg_id 
    FROM comun_seguridad.seg_widget 
    WHERE wdg_negocio = v_negocio
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

  END LOOP;
END $$;
