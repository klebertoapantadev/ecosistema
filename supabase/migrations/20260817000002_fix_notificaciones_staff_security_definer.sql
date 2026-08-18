-- Migration: 20260817000002_fix_notificaciones_staff_security_definer.sql
-- Provee funciones RPC SECURITY DEFINER para consultar y notificar a todo el staff
-- (Operadores, Administradores, SuperAdmins) saltando las restricciones de RLS
-- cuando un cliente/postulante envía solicitudes, sube contratos o propone modificaciones.

-- 1. Función para obtener todo el personal de staff de un negocio
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
    ARRAY_AGG(DISTINCT COALESCE(p.per_clave, 'OPERADOR')) AS perfiles
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
    OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  GROUP BY u.usu_id, u.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text) TO authenticated, anon;

-- 2. Función para despachar notificaciones IN_APP y PUSH a todo el personal de staff
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

GRANT EXECUTE ON FUNCTION comun_notificacion.not_fn_notificar_staff(text, text, text, text, uuid) TO authenticated, anon;
