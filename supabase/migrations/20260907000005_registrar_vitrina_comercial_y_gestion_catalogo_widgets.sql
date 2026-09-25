-- Migration: 20260907000005_registrar_vitrina_comercial_y_gestion_catalogo_widgets.sql
-- Registra e independiza los widgets:
-- 1. vitrina_comercial (Storefront visual con recursos multimedia para Clientes) -> panel_herramientas
-- 2. gestion_catalogo / catalogo_productos (Consola técnica de gestión para Operadores/Admin) -> panel_configuracion

DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- 1. REGISTRAR EN comun_seguridad.seg_widget
    -- ====================================================================

    -- 1.1 Vitrina Comercial Visual (Cliente)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'vitrina_comercial',
      'Oferta de Servicios & Tarifario',
      true,
      jsonb_build_object(
        'descripcion', 'Vitrina visual interactiva de servicios, planes familiares y corporativos con imágenes, videos explicativos y pago Payphone',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/catalogo-productos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'Sparkles'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- 1.2 Consola de Gestión de Catálogo (Operador / Admin)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'gestion_catalogo',
      'Gestión del Catálogo Comercial',
      true,
      jsonb_build_object(
        'descripcion', 'Consola administrativa para crear honorarios, editar tarifas SRI IVA 15%, variantes y vincular recursos digitales',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/configuracion?widget=gestion_catalogo',
        'panel_defecto', 'panel_configuracion',
        'icono', 'ShoppingBag'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- Actualizar también catalogo_productos para retrocompatibilidad
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'catalogo_productos',
      'Catálogo Comercial & Honorarios',
      true,
      jsonb_build_object(
        'descripcion', 'Catálogo unificado de servicios, liquidación de honorarios y suscripciones con IVA 15%',
        'categoria', 'Comercio y Pagos',
        'ruta', '/panel/configuracion?widget=gestion_catalogo',
        'panel_defecto', 'panel_configuracion',
        'icono', 'ShoppingBag'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre, wdg_activo = true, wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;


    -- 2. PRE-CONFIGURACIÓN POR DEFECTO EN comun_seguridad.seg_rol_widget
    -- ====================================================================

    -- 2.1 Rol CLIENTE: Acceso a vitrina_comercial
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'CLIENTE', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio AND wdg_clave = 'vitrina_comercial'
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    -- 2.2 Rol SOCIO: Acceso a vitrina_comercial
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'SOCIO', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio AND wdg_clave = 'vitrina_comercial'
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    -- 2.3 Rol OPERADOR: Vitrina y Gestión de Catálogo
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'OPERADOR', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio AND wdg_clave IN ('vitrina_comercial', 'gestion_catalogo', 'catalogo_productos')
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    -- 2.4 Rol ADMINISTRADOR / SUPERADMIN: Acceso pleno
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'ADMINISTRADOR', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio AND wdg_clave IN ('vitrina_comercial', 'gestion_catalogo', 'catalogo_productos')
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'SUPERADMIN', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio AND wdg_clave IN ('vitrina_comercial', 'gestion_catalogo', 'catalogo_productos')
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

  END LOOP;
END $$;

