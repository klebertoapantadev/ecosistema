-- Migración: 20260928000003_fix_staff_notificaciones_y_vitrina_cliente.sql
-- Descripción: 1. Actualiza seg_fn_obtener_staff_negocio y not_fn_notificar_staff para reemplazar
--                 kleber.toapanta.ch@gmail.com por familiammtg@gmail.com.
--              2. Corrige comun_seguridad.seg_rol_widget para remover catalogo_productos del rol CLIENTE
--                 y asegurar que solo tenga vitrina_comercial.
--              3. Limpia notificaciones de staff indebidas asociadas a clientes.

-- 1. Actualizar seg_fn_obtener_staff_negocio
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_obtener_staff_negocio(text);
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
    OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com')
    OR m.mem_rol IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
    OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  GROUP BY u.usu_id, u.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text) TO authenticated, service_role, anon;

-- 2. Actualizar not_fn_notificar_staff
DROP FUNCTION IF EXISTS comun_notificacion.not_fn_notificar_staff(text, text, text, text, uuid);
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_notificar_staff(
  p_negocio text,
  p_titulo text,
  p_contenido_html text,
  p_url_accion text,
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
    SELECT DISTINCT u.usu_id, u.usu_correo
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
        OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com')
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

-- 3. Quitar asignación de catalogo_productos y gestion_catalogo al rol CLIENTE en seg_rol_widget
DELETE FROM comun_seguridad.seg_rol_widget
WHERE rlw_rol = 'CLIENTE'
  AND rlw_widget_id IN (
    SELECT wdg_id FROM comun_seguridad.seg_widget WHERE wdg_clave IN ('catalogo_productos', 'gestion_catalogo')
  );

-- Asegurar que el rol CLIENTE tenga vitrina_comercial visible
INSERT INTO comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
SELECT wdg_negocio, 'CLIENTE', wdg_id, true
FROM comun_seguridad.seg_widget
WHERE wdg_clave = 'vitrina_comercial'
ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE SET rlw_visible = true;

-- 4. Limpiar notificaciones de staff asignadas a usuarios que no son staff
DELETE FROM comun_notificacion.not_registro
WHERE not_usuario_id IN (
  SELECT usu_id FROM comun_seguridad.seg_usuario
  WHERE lower(usu_correo) = 'kleber.toapanta.ch@gmail.com'
) AND (
  not_titulo ILIKE '%Postulación de Socio%'
  OR not_titulo ILIKE '%Contrato Firmado Recibido%'
  OR not_titulo ILIKE '%Propuesta de Modificación%'
);
