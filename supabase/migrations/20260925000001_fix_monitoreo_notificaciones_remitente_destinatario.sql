-- Migración: 20260925000001_fix_monitoreo_notificaciones_remitente_destinatario.sql
-- 1. Elimina 'satcomla.ti@gmail.com' de funciones de staff para evitar que cuentas de prueba/clientes reciban alertas de postulantes.
-- 2. Habilita lectura y actualización en RLS de comun_notificacion.not_registro para SuperAdmin y miembros staff.
-- 3. Crea RPC en comun_seguridad (esquema expuesto en PostgREST) para auditoría completa de notificaciones (Quién Envía, Quién Recibe).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Corregir seg_fn_obtener_staff_negocio (Eliminar satcomla.ti@gmail.com)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(p_negocio text DEFAULT 'TRANQ')
RETURNS TABLE (
  usu_id uuid,
  usu_correo text,
  perfiles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.usu_id,
    u.usu_correo,
    ARRAY_AGG(DISTINCT COALESCE(m.mem_rol, p.per_clave, 'OPERADOR')) AS perfiles
  FROM comun_seguridad.seg_usuario u
  LEFT JOIN comun_seguridad.seg_membresia m 
    ON m.mem_usuario_id = u.usu_id 
    AND (m.mem_negocio ILIKE p_negocio OR m.mem_negocio ILIKE CONCAT(p_negocio, 'I'))
  LEFT JOIN comun_seguridad.seg_membresia_perfil mp 
    ON mp.mpe_membresia_id = m.mem_id
  LEFT JOIN comun_seguridad.seg_perfil p 
    ON p.per_id = mp.mpe_perfil_id
  WHERE 
    u.usu_superadmin_plataforma = true
    OR u.usu_correo IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com')
    OR m.mem_rol IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
    OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  GROUP BY u.usu_id, u.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text) TO authenticated, service_role, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Corregir not_fn_notificar_staff (Eliminar satcomla.ti@gmail.com)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_notificar_staff(
  p_negocio text,
  p_titulo text,
  p_contenido_html text,
  p_url_accion text DEFAULT NULL,
  p_excluir_usuario_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_contador integer := 0;
BEGIN
  FOR r IN (
    SELECT DISTINCT u.usu_id
    FROM comun_seguridad.seg_usuario u
    LEFT JOIN comun_seguridad.seg_membresia m 
      ON m.mem_usuario_id = u.usu_id 
      AND (m.mem_negocio ILIKE p_negocio OR m.mem_negocio ILIKE CONCAT(p_negocio, 'I'))
    LEFT JOIN comun_seguridad.seg_membresia_perfil mp 
      ON mp.mpe_membresia_id = m.mem_id
    LEFT JOIN comun_seguridad.seg_perfil p 
      ON p.per_id = mp.mpe_perfil_id
    WHERE 
      (p_excluir_usuario_id IS NULL OR u.usu_id <> p_excluir_usuario_id)
      AND (
        u.usu_superadmin_plataforma = true
        OR u.usu_correo IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com')
        OR m.mem_rol IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
        OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
      )
  ) LOOP
    INSERT INTO comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html, not_url_accion, not_creado_en
    ) VALUES 
      (r.usu_id, p_negocio, 'IN_APP', p_titulo, p_contenido_html, p_url_accion, NOW()),
      (r.usu_id, p_negocio, 'PUSH', p_titulo, p_contenido_html, p_url_accion, NOW());
    v_contador := v_contador + 1;
  END LOOP;

  RETURN v_contador;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_notificacion.not_fn_notificar_staff(text, text, text, text, uuid) TO authenticated, service_role, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS en comun_notificacion.not_registro para SuperAdmin y Administradores
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS not_registro_select_propio ON comun_notificacion.not_registro;
DROP POLICY IF EXISTS not_registro_select_admin ON comun_notificacion.not_registro;
CREATE POLICY not_registro_select_admin ON comun_notificacion.not_registro
  FOR SELECT USING (
    not_usuario_id = auth.uid()
    OR comun_seguridad.seg_fn_es_superadmin()
    OR comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), not_negocio)
  );

DROP POLICY IF EXISTS not_registro_update_propio ON comun_notificacion.not_registro;
DROP POLICY IF EXISTS not_registro_update_admin ON comun_notificacion.not_registro;
CREATE POLICY not_registro_update_admin ON comun_notificacion.not_registro
  FOR UPDATE USING (
    not_usuario_id = auth.uid()
    OR comun_seguridad.seg_fn_es_superadmin()
    OR comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), not_negocio)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC en comun_seguridad para Monitoreo de Notificaciones (Quién Envía, Quién Recibe)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_monitoreo_notificaciones(
  p_negocio text DEFAULT 'TRANQ',
  p_usuario_id uuid DEFAULT NULL
)
RETURNS TABLE (
  not_id uuid,
  usuario_id uuid,
  usuario_nombre text,
  usuario_correo text,
  emisor_id uuid,
  emisor_nombre text,
  emisor_correo text,
  emisor_tipo text,
  not_negocio varchar,
  not_canal varchar,
  not_titulo text,
  not_contenido_html text,
  not_url_accion text,
  not_leido_en timestamptz,
  not_pospuesta_hasta text,
  not_pospuesta_horas integer,
  not_eliminada boolean,
  not_eliminada_en text,
  not_creado_en timestamptz,
  not_detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_es_superadmin boolean;
  v_es_staff boolean;
BEGIN
  -- 1. Validar que el invocador sea SuperAdmin o Staff del negocio
  v_es_superadmin := comun_seguridad.seg_fn_es_superadmin();
  v_es_staff := comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), p_negocio);

  IF NOT (v_es_superadmin OR v_es_staff) THEN
    RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Administrador o SuperAdmin para auditar notificaciones.';
  END IF;

  RETURN QUERY
  SELECT 
    r.not_id,
    r.not_usuario_id AS usuario_id,
    COALESCE(TRIM(CONCAT(u_dest.usu_nombres, ' ', u_dest.usu_apellidos)), u_dest.usu_correo, 'Usuario') AS usuario_nombre,
    COALESCE(u_dest.usu_correo, '—') AS usuario_correo,
    COALESCE(
      (r.not_detalles->'emisor'->>'id')::uuid,
      c.cmp_emisor_id,
      NULL
    ) AS emisor_id,
    COALESCE(
      r.not_detalles->'emisor'->>'nombre',
      TRIM(CONCAT(u_emisor.usu_nombres, ' ', u_emisor.usu_apellidos)),
      u_emisor.usu_correo,
      'Sistema ' || p_negocio
    ) AS emisor_nombre,
    COALESCE(
      r.not_detalles->'emisor'->>'correo',
      u_emisor.usu_correo,
      'notificaciones@' || LOWER(p_negocio) || '24.com'
    ) AS emisor_correo,
    COALESCE(
      r.not_detalles->'emisor'->>'tipo',
      CASE WHEN c.cmp_emisor_id IS NOT NULL THEN 'ADMINISTRADOR' ELSE 'SISTEMA' END
    ) AS emisor_tipo,
    r.not_negocio,
    r.not_canal,
    r.not_titulo,
    r.not_contenido_html,
    r.not_url_accion,
    r.not_leido_en,
    r.not_detalles->>'pospuesta_hasta' AS not_pospuesta_hasta,
    (r.not_detalles->>'pospuesta_horas')::integer AS not_pospuesta_horas,
    COALESCE((r.not_detalles->>'eliminada')::boolean, false) AS not_eliminada,
    r.not_detalles->>'eliminada_en' AS not_eliminada_en,
    r.not_creado_en,
    r.not_detalles
  FROM comun_notificacion.not_registro r
  LEFT JOIN comun_seguridad.seg_usuario u_dest ON u_dest.usu_id = r.not_usuario_id
  LEFT JOIN comun_notificacion.not_campana c ON c.cmp_id = r.not_campana_id
  LEFT JOIN comun_seguridad.seg_usuario u_emisor ON u_emisor.usu_id = c.cmp_emisor_id
  WHERE 
    (p_negocio IS NULL OR r.not_negocio ILIKE p_negocio OR r.not_negocio ILIKE CONCAT(p_negocio, '%'))
    AND (
      p_usuario_id IS NULL 
      OR r.not_usuario_id = p_usuario_id 
      OR (r.not_detalles->'emisor'->>'id')::uuid = p_usuario_id
      OR c.cmp_emisor_id = p_usuario_id
    )
  ORDER BY r.not_creado_en DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_monitoreo_notificaciones(text, uuid) TO authenticated, service_role;
