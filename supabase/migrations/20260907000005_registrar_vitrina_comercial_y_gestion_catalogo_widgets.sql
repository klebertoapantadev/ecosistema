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

    -- 2.1 Rol CLIENTE: Acceso a vitrina_comercial en panel_herramientas
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel, rlw_activo, rlw_orden)
    VALUES
      (v_negocio, 'CLIENTE', 'vitrina_comercial', 'panel_herramientas', true, 1)
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel) DO UPDATE
    SET rlw_activo = true;

    -- 2.2 Rol SOCIO: Acceso a vitrina_comercial en panel_herramientas
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel, rlw_activo, rlw_orden)
    VALUES
      (v_negocio, 'SOCIO', 'vitrina_comercial', 'panel_herramientas', true, 2)
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel) DO UPDATE
    SET rlw_activo = true;

    -- 2.3 Rol OPERADOR: Vitrina en herramientas y Gestión en configuración
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel, rlw_activo, rlw_orden)
    VALUES
      (v_negocio, 'OPERADOR', 'vitrina_comercial', 'panel_herramientas', true, 1),
      (v_negocio, 'OPERADOR', 'gestion_catalogo', 'panel_configuracion', true, 3),
      (v_negocio, 'OPERADOR', 'catalogo_productos', 'panel_configuracion', true, 4)
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel) DO UPDATE
    SET rlw_activo = true;

    -- 2.4 Rol ADMINISTRADOR / SUPERADMIN: Acceso pleno
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel, rlw_activo, rlw_orden)
    VALUES
      (v_negocio, 'ADMINISTRADOR', 'vitrina_comercial', 'panel_herramientas', true, 1),
      (v_negocio, 'ADMINISTRADOR', 'gestion_catalogo', 'panel_configuracion', true, 3),
      (v_negocio, 'SUPERADMIN', 'vitrina_comercial', 'panel_herramientas', true, 1),
      (v_negocio, 'SUPERADMIN', 'gestion_catalogo', 'panel_configuracion', true, 3)
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_clave, rlw_panel) DO UPDATE
    SET rlw_activo = true;

  END LOOP;
END $$;
