-- Migration: 20260907000001_sincronizar_catalogo_widgets_y_roles_defecto.sql
-- Registra e inicializa TODOS los widgets del ecosistema en comun_seguridad.seg_widget
-- y pre-configura sus accesos por defecto en comun_seguridad.seg_rol_widget para todos los roles y negocios.

DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- 1. REGISTRAR CATÁLOGO MAESTRO COMPLETO EN comun_seguridad.seg_widget
    -- ====================================================================

    -- 1.1 Catálogo Comercial & Honorarios (común a todos los negocios)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'catalogo_productos',
      'Catálogo Comercial & Honorarios',
      true,
      jsonb_build_object(
        'descripcion', 'Catálogo unificado de servicios, liquidación de honorarios y suscripciones con IVA 15%',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/catalogo-productos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'ShoppingBag'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.2 Pasarela Payphone (Botón de Pago)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'pasarela_payphone',
      'Pasarela Payphone (Botón de Pago)',
      true,
      jsonb_build_object(
        'descripcion', 'Configuración de credenciales API Payphone, StoreID y simulador de cobro con tarjeta',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/configuracion?widget=pasarela_payphone',
        'panel_defecto', 'panel_configuracion',
        'icono', 'CreditCard'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.3 Historial de Transacciones & Pagos
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'historial_pagos',
      'Historial de Transacciones & Pagos',
      true,
      jsonb_build_object(
        'descripcion', 'Auditoría contable inmutable de cobros bancarios y transacciones autorizadas Payphone',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/administrar?widget=historial_pagos',
        'panel_defecto', 'panel_administrar',
        'icono', 'Receipt'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.4 CRM de Clientes & Directorio 360
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'crm_clientes',
      'CRM Jurídico & Gestión de Clientes',
      true,
      jsonb_build_object(
        'descripcion', 'Directorio 360°, KPIs, validación de cédula/RUC y conflict check en vivo',
        'categoria', 'Gestión Operativa',
        'ruta', '/panel/clientes',
        'panel_defecto', 'panel_administrar',
        'icono', 'Users'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.5 Alta Asistida de Clientes CRM
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'alta_cliente_crm',
      'Alta Asistida & Recepción Multicanal',
      true,
      jsonb_build_object(
        'descripcion', 'Registro asistido de clientes con OCR ARIA de cédula/nombramiento y verificación de conflictos',
        'categoria', 'Gestión Operativa',
        'ruta', '/panel/clientes?accion=alta',
        'panel_defecto', 'panel_administrar',
        'icono', 'UserCheck'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.6 Monitoreo de Notificaciones por Usuario
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'monitoreo_notificaciones_usuarios',
      'Monitoreo de Notificaciones por Usuario',
      true,
      jsonb_build_object(
        'descripcion', 'Auditoría en tiempo real de notificaciones, fechas de confirmación, tiempo de pospuesto y eliminados',
        'categoria', 'Comunicación',
        'ruta', '/panel/administrar?widget=monitoreo_notificaciones_usuarios',
        'panel_defecto', 'panel_administrar',
        'icono', 'Bell'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.7 Agentes de Inteligencia Artificial (Aria)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'agentes_ia',
      'Agentes de IA (Aria)',
      true,
      jsonb_build_object(
        'descripcion', 'Configuración de asistentes Aria: prompts de sistema, modelos y herramientas integradas',
        'categoria', 'Configuración',
        'ruta', '/panel/agentes',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Bot'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.8 Billetera Digital de Documentos Seguros
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
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
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.9 Firma Electrónica PDF
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'firma_documentos_pdf',
      'Firma Electrónica de Documentos PDF',
      true,
      jsonb_build_object(
        'descripcion', 'Firmado digital con certificado .p12 / .pfx, estampa visual y código QR oficial',
        'categoria', 'Herramientas Digitales',
        'ruta', '/panel/firma-documentos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'FileCheck'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.10 Preferencias de Alertas y Notificaciones
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'notificaciones',
      'Preferencias de Alertas & Notificaciones',
      true,
      jsonb_build_object(
        'descripcion', 'Canales de recepción de correo saliente, WhatsApp y notificaciones Push',
        'categoria', 'Comunicación',
        'ruta', '/panel/configuracion?widget=notificaciones',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Bell'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.11 Datos de Facturación SRI
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'datos_facturacion',
      'Datos de Facturación SRI & Comprobantes',
      true,
      jsonb_build_object(
        'descripcion', 'Razón Social, RUC/Cédula, dirección fiscal y correo SRI para emisión electrónica',
        'categoria', 'Facturación',
        'ruta', '/panel/cuenta?widget=datos_facturacion',
        'panel_defecto', 'panel_cuenta',
        'icono', 'Receipt'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.12 Solicitud de Socios Postulantes
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'solicitud_socio',
      'Solicitudes de Socios & Postulaciones',
      true,
      jsonb_build_object(
        'descripcion', 'Formulario de postulación y revisión de antecedentes para ser socio profesional',
        'categoria', 'Operación Legal',
        'ruta', '/panel/solicitud-socio',
        'panel_defecto', 'panel_herramientas',
        'icono', 'Briefcase'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;


    -- ====================================================================
    -- 2. PRE-CONFIGURACIÓN DE ASIGNACIONES POR DEFECTO EN seg_rol_widget
    -- ====================================================================

    -- 2.1 Rol CLIENTE
    -- Tienen acceso inmediato a herramientas personales, compras, facturación y postulaciones
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'CLIENTE', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio
      AND wdg_clave IN (
        'billetera_documentos',
        'firma_documentos_pdf',
        'catalogo_productos',
        'solicitud_socio',
        'notificaciones',
        'datos_facturacion',
        'mi_cuenta',
        'mfa_seguridad',
        'historial_accesos',
        'ver_como',
        'favoritos'
      )
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

    -- 2.2 Rol ABOGADO / PROFESIONAL
    -- Acceso a herramientas, CRM de clientes, honorarios, catálogo y expediente
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'ABOGADO', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio
      AND wdg_clave IN (
        'crm_clientes',
        'catalogo_productos',
        'billetera_documentos',
        'firma_documentos_pdf',
        'notificaciones',
        'datos_facturacion',
        'mi_cuenta',
        'mfa_seguridad',
        'historial_accesos',
        'ver_como',
        'favoritos'
      )
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

    -- 2.3 Rol OPERADOR / AUXILIAR / TECNICO
    -- Acceso a CRM, altas asistidas, aprobación de socios, emisión y monitoreo de notificaciones, pagos y términos
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, r.rol, w.wdg_id, true
    FROM comun_seguridad.seg_widget w
    CROSS JOIN (VALUES ('OPERADOR'), ('AUXILIAR'), ('TECNICO')) AS r(rol)
    WHERE w.wdg_negocio = v_negocio
      AND w.wdg_clave IN (
        'crm_clientes',
        'alta_cliente_crm',
        'socios',
        'solicitud_socio',
        'historial_pagos',
        'catalogo_productos',
        'billetera_documentos',
        'firma_documentos_pdf',
        'emision_notificaciones',
        'bitacora_notificaciones',
        'monitoreo_notificaciones_usuarios',
        'gestion_terminos_consentimientos',
        'configuracion_contrato_abogado',
        'consulta_usuarios_perfiles',
        'notificaciones',
        'datos_facturacion',
        'mi_cuenta',
        'mfa_seguridad',
        'historial_accesos',
        'ver_como',
        'favoritos'
      )
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

    -- 2.4 Rol ADMINISTRADOR & SUPERADMIN
    -- Acceso completo a gobernanza, perfiles, parámetros de negocio, SMTP, pasarela Payphone, agentes y auditoría
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, r.rol, w.wdg_id, true
    FROM comun_seguridad.seg_widget w
    CROSS JOIN (VALUES ('ADMINISTRADOR'), ('SUPERADMIN')) AS r(rol)
    WHERE w.wdg_negocio = v_negocio
      AND w.wdg_clave IN (
        'catalogo_productos',
        'pasarela_payphone',
        'historial_pagos',
        'crm_clientes',
        'alta_cliente_crm',
        'monitoreo_notificaciones_usuarios',
        'agentes_ia',
        'billetera_documentos',
        'firma_documentos_pdf',
        'gestion_usuarios',
        'perfiles',
        'socios',
        'solicitud_socio',
        'consulta_usuarios_perfiles',
        'configuracion_negocio',
        'configuracion_correo',
        'gestion_terminos_consentimientos',
        'configuracion_contrato_abogado',
        'auditoria',
        'emision_notificaciones',
        'bitacora_notificaciones',
        'notificaciones',
        'datos_facturacion',
        'mi_cuenta',
        'mfa_seguridad',
        'historial_accesos',
        'ver_como',
        'favoritos'
      )
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO NOTHING;

  END LOOP;
END $$;
