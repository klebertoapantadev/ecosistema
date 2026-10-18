-- Migración: 20261016000001_corregir_widgets_tinkay_y_catalogo_comercial.sql
-- Descripción: Limpia widgets de Tranqi indebidamente propagados a Tinkay,
--              asegura el acceso pleno al Catálogo Comercial & Portafolio en Tinkay,
--              y restablece facultades de SuperAdmin y Administrador para kleber.toapanta.ch@gmail.com.

DO $$
DECLARE
  v_negocio text;
  v_negocios_tinkay text[] := ARRAY['tinkay', 'tnk', 'TNK', 'TINKAY'];
  v_widgets_tranqi text[] := ARRAY[
    'solicitud_socio',
    'firma_documentos_pdf',
    'billetera_documentos',
    'crm_clientes',
    'alta_cliente_crm',
    'configuracion_contrato_abogado',
    'agendar_cita',
    'mis_citas',
    'citas_programadas',
    'disponibilidad',
    'asignaciones_agenda',
    'compliance_score',
    'legal_hr_laboral',
    'banners_juridicos',
    'campanas_informativas'
  ];
  v_usu_kleber_id uuid;
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_per_cliente_id uuid;
  v_negocio_global text;
BEGIN
  -- ============================================================================
  -- 1. PURGAR ASIGNACIONES Y DESACTIVAR WIDGETS DE TRANQI EN TINKAY
  -- ============================================================================

  DELETE FROM comun_seguridad.seg_rol_widget
  WHERE rlw_negocio = ANY(v_negocios_tinkay)
    AND rlw_widget_id IN (
      SELECT wdg_id
      FROM comun_seguridad.seg_widget
      WHERE wdg_clave = ANY(v_widgets_tranqi)
    );

  UPDATE comun_seguridad.seg_widget
  SET wdg_activo = false,
      wdg_actualizado_en = NOW()
  WHERE wdg_negocio = ANY(v_negocios_tinkay)
    AND wdg_clave = ANY(v_widgets_tranqi);

  -- ============================================================================
  -- 2. REGISTRAR Y ASEGURAR WIDGETS LEGÍTIMOS DE TINKAY FLORISTERÍA
  -- ============================================================================

  FOREACH v_negocio IN ARRAY ARRAY['tinkay', 'TNK']
  LOOP
    -- 2.1 Catálogo Comercial & Portafolio (Núcleo de Tinkay)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'catalogo_productos',
      'Catálogo Comercial & Portafolio',
      true,
      jsonb_build_object(
        'descripcion', 'Arreglos florales, bouquets coreanos, mix de temporada, complementos y precios SRI (IVA 15%).',
        'categoria', 'Comercio y Ventas',
        'ruta', '/panel/catalogo-productos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'ShoppingBag'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.2 Vitrina Comercial (alias visual hacia el catálogo)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'vitrina_comercial',
      'Catálogo Comercial & Portafolio',
      true,
      jsonb_build_object(
        'descripcion', 'Arreglos florales, bouquets coreanos, mix de temporada, complementos y precios SRI (IVA 15%).',
        'categoria', 'Comercio y Ventas',
        'ruta', '/panel/catalogo-productos',
        'panel_defecto', 'panel_herramientas',
        'icono', 'ShoppingBag'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.3 Gestión de Usuarios & Roles
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'gestion_usuarios',
      'Gestión de Usuarios & Roles',
      true,
      jsonb_build_object(
        'descripcion', 'Asignación de membresías, roles de asesoras de ventas y permisos del taller floral.',
        'categoria', 'Administración',
        'ruta', '/panel/usuarios',
        'panel_defecto', 'panel_usuarios',
        'icono', 'Users'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.4 Tokens & Servidor MCP (WhatsApp ARIA / n8n)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'tokens_mcp',
      'Tokens & Servidor MCP',
      true,
      jsonb_build_object(
        'descripcion', 'Emisión de credenciales API y tokens para conectar el catálogo con bots de WhatsApp y n8n.',
        'categoria', 'Integraciones',
        'ruta', '/panel/tokens-mcp',
        'panel_defecto', 'panel_configuracion',
        'icono', 'KeyRound'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.5 Configuración de la Floristería
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'configuracion_negocio',
      'Configuración de la Floristería',
      true,
      jsonb_build_object(
        'descripcion', 'Políticas de entrega, franjas horarias, teléfonos de contacto y redes oficiales.',
        'categoria', 'Configuración',
        'ruta', '/panel/configuracion',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Settings'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.6 Servidor de Correo (SMTP)
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'configuracion_correo',
      'Servidor de Correo (SMTP)',
      true,
      jsonb_build_object(
        'descripcion', 'Credenciales de envío para confirmaciones de compra y alertas de despacho.',
        'categoria', 'Configuración',
        'ruta', '/panel/correo',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Mail'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.7 Datos de Facturación SRI
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'datos_facturacion',
      'Datos de Facturación SRI & Comprobantes',
      true,
      jsonb_build_object(
        'descripcion', 'Razón Social, RUC/Cédula, dirección fiscal y correo SRI para emisión electrónica.',
        'categoria', 'Facturación',
        'ruta', '/panel/cuenta',
        'panel_defecto', 'panel_cuenta',
        'icono', 'Receipt'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- 2.8 Mi cuenta
    INSERT INTO comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget, wdg_creado_en)
    VALUES (
      v_negocio,
      'mi_cuenta',
      'Mi cuenta',
      true,
      jsonb_build_object(
        'descripcion', 'Perfil personal, historial de accesos y preferencias de seguridad.',
        'categoria', 'Cuenta',
        'ruta', '/panel/cuenta',
        'panel_defecto', 'panel_cuenta',
        'icono', 'User'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget,
        wdg_actualizado_en = NOW();

    -- ============================================================================
    -- 3. ASIGNACIONES PRE-CONFIGURADAS POR DEFECTO EN seg_rol_widget PARA TINKAY
    -- ============================================================================

    -- 3.1 Rol CLIENTE: Acceso inmediato a Catálogo Comercial, Facturación y Cuenta
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'CLIENTE', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio
      AND wdg_clave IN ('catalogo_productos', 'vitrina_comercial', 'datos_facturacion', 'mi_cuenta')
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    -- 3.2 Rol OPERADOR (Vendedoras / Taller): Catálogo, Tokens MCP, Facturación y Cuenta
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, 'OPERADOR', wdg_id, true
    FROM comun_seguridad.seg_widget
    WHERE wdg_negocio = v_negocio
      AND wdg_clave IN ('catalogo_productos', 'vitrina_comercial', 'tokens_mcp', 'datos_facturacion', 'mi_cuenta')
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

    -- 3.3 Roles ADMINISTRADOR y SUPERADMIN: Acceso total a todos los módulos
    INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    SELECT v_negocio, r.rol, w.wdg_id, true
    FROM comun_seguridad.seg_widget w
    CROSS JOIN (VALUES ('ADMINISTRADOR'), ('SUPERADMIN')) AS r(rol)
    WHERE w.wdg_negocio = v_negocio
      AND w.wdg_clave IN (
        'catalogo_productos',
        'vitrina_comercial',
        'gestion_usuarios',
        'tokens_mcp',
        'configuracion_negocio',
        'configuracion_correo',
        'datos_facturacion',
        'mi_cuenta'
      )
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

  END LOOP;

  -- ============================================================================
  -- 4. RESTABLECER PRIVILEGIOS DE SUPERADMIN Y ADMINISTRADOR PARA kleber.toapanta.ch@gmail.com
  -- ============================================================================

  UPDATE comun_seguridad.seg_usuario
  SET usu_superadmin_plataforma = true,
      usu_actualizado_en = NOW()
  WHERE lower(usu_correo) = 'kleber.toapanta.ch@gmail.com';

  SELECT usu_id INTO v_usu_kleber_id
  FROM comun_seguridad.seg_usuario
  WHERE lower(usu_correo) = 'kleber.toapanta.ch@gmail.com';

  IF v_usu_kleber_id IS NOT NULL THEN
    SELECT per_id INTO v_per_superadmin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'SUPERADMIN';
    SELECT per_id INTO v_per_admin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'ADMINISTRADOR';
    SELECT per_id INTO v_per_cliente_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'CLIENTE';

    FOREACH v_negocio_global IN ARRAY ARRAY['tinkay', 'TNK', 'tranqi', 'TRANQ', 'fastfix', 'FFH', 'margaritas', 'MRG'] LOOP
      INSERT INTO comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      VALUES (v_usu_kleber_id, v_negocio_global, 'SUPERADMIN', 'ACTIVO')
      ON CONFLICT (mem_usuario_id, mem_negocio) DO UPDATE SET
        mem_rol = 'SUPERADMIN',
        mem_estado = 'ACTIVO',
        mem_actualizado_en = NOW()
      RETURNING mem_id INTO v_mem_id;

      IF v_per_superadmin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_superadmin_id, v_usu_kleber_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_per_admin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_admin_id, v_usu_kleber_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_per_cliente_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_cliente_id, v_usu_kleber_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

END $$;

-- 5. Actualizar función helper comun_seguridad.seg_fn_es_superadmin
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_es_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM comun_seguridad.seg_usuario u
    WHERE u.usu_id = auth.uid() 
      AND (
        u.usu_superadmin_plataforma = true
        OR lower(u.usu_correo) IN (
          'kleber.toapanta.ch@gmail.com',
          'familiammtg@gmail.com',
          'jesus251296@gmail.com'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_es_superadmin() TO authenticated, anon;
