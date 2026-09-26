-- Migración: 20260926000001_reorganizar_paneles_y_widgets_ecosistema.sql
-- Descripción: Reorganización modular de widgets en nuevos paneles especializados (Usuarios, Red Profesional, Términos & Condiciones, Agendamiento y Administrar).

-- ============================================================================
-- 1. Actualizar panel_defecto en seg_widget para todos los negocios
-- ============================================================================

-- PANEL: USUARIOS (panel_usuarios)
UPDATE comun_seguridad.seg_widget
SET wdg_detalle_widget = jsonb_set(COALESCE(wdg_detalle_widget, '{}'::jsonb), '{panel_defecto}', '"panel_usuarios"')
WHERE wdg_clave IN ('gestion_usuarios', 'consulta_usuarios', 'consulta_usuarios_perfiles', 'crm_clientes', 'monitoreo_notificaciones_usuarios');

-- PANEL: RED PROFESIONAL (panel_red_profesional)
UPDATE comun_seguridad.seg_widget
SET wdg_detalle_widget = jsonb_set(COALESCE(wdg_detalle_widget, '{}'::jsonb), '{panel_defecto}', '"panel_red_profesional"')
WHERE wdg_clave IN ('socios', 'solicitud_socio');

-- PANEL: TÉRMINOS & CONDICIONES (panel_terminos)
UPDATE comun_seguridad.seg_widget
SET wdg_detalle_widget = jsonb_set(COALESCE(wdg_detalle_widget, '{}'::jsonb), '{panel_defecto}', '"panel_terminos"')
WHERE wdg_clave IN ('gestion_terminos_consentimientos', 'terminos', 'configuracion_contrato_abogado');

-- PANEL: AGENDAMIENTO (panel_agendamiento)
UPDATE comun_seguridad.seg_widget
SET wdg_detalle_widget = jsonb_set(COALESCE(wdg_detalle_widget, '{}'::jsonb), '{panel_defecto}', '"panel_agendamiento"')
WHERE wdg_clave IN ('asignaciones_agenda', 'agendar_cita', 'mis_citas', 'citas_programadas', 'disponibilidad');

-- PANEL: ADMINISTRAR (panel_administrar) - El resto
UPDATE comun_seguridad.seg_widget
SET wdg_detalle_widget = jsonb_set(COALESCE(wdg_detalle_widget, '{}'::jsonb), '{panel_defecto}', '"panel_administrar"')
WHERE wdg_clave IN ('historial_pagos', 'emision_notificaciones', 'bitacora_notificaciones', 'auditoria', 'perfiles');

-- ============================================================================
-- 2. Asegurar asignaciones pre-configuradas en seg_rol_widget
-- ============================================================================

-- Roles: OPERADOR, ADMINISTRADOR, SUPERADMIN
DO $$
DECLARE
  v_negocio text;
  v_widget record;
BEGIN
  FOR v_negocio IN SELECT unnest(ARRAY['TRANQ', 'tranqi', 'FFH', 'fastfix', 'TNK', 'tinkay', 'MRG', 'margaritas']) LOOP
    -- Vincular widgets a OPERADOR, ADMINISTRADOR y SUPERADMIN
    FOR v_widget IN 
      SELECT wdg_id, wdg_clave 
      FROM comun_seguridad.seg_widget 
      WHERE upper(wdg_negocio) = upper(v_negocio) OR wdg_negocio IS NULL 
    LOOP
      -- OPERADOR
      IF v_widget.wdg_clave IN (
        'favoritos', 'ver_como', 'mi_cuenta', 'datos_facturacion', 'mfa_seguridad', 'historial_accesos',
        'consulta_usuarios_perfiles', 'consulta_usuarios', 'crm_clientes', 'monitoreo_notificaciones_usuarios',
        'socios', 'solicitud_socio',
        'gestion_terminos_consentimientos', 'configuracion_contrato_abogado',
        'asignaciones_agenda',
        'historial_pagos', 'emision_notificaciones', 'bitacora_notificaciones',
        'catalogo_productos', 'firma_documentos_pdf', 'billetera_documentos'
      ) THEN
        INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
        VALUES (v_negocio, 'OPERADOR', v_widget.wdg_id, true)
        ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;
      END IF;

      -- ADMINISTRADOR
      IF v_widget.wdg_clave NOT IN ('auditoria_superadmin_exclusiva') THEN
        INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
        VALUES (v_negocio, 'ADMINISTRADOR', v_widget.wdg_id, true)
        ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;
      END IF;

      -- SUPERADMIN
      INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      VALUES (v_negocio, 'SUPERADMIN', v_widget.wdg_id, true)
      ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;
    END LOOP;
  END LOOP;
END;
$$;
