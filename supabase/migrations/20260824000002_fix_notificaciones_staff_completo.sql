-- Migration: 20260824000002_fix_notificaciones_staff_completo.sql
-- Garantiza que TODAS las notificaciones dirigidas al personal del negocio (Operadores, Administradores, SuperAdmins)
-- lleguen efectivamente a TODOS los miembros con rol activo en seg_membresia o seg_perfil.
-- Incluye trigger automático en tranqui_legal.trq_solicitud_socio para despachar alertas ante nuevas postulaciones.

-- 1. Actualizar función para obtener el personal de staff de un negocio
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
    OR u.usu_correo IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com')
    OR m.mem_rol IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
    OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  GROUP BY u.usu_id, u.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text) TO authenticated, service_role, anon;

-- 2. Actualizar función para despachar notificaciones IN_APP y PUSH a todo el personal de staff
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
        OR u.usu_correo IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com')
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

-- 3. Trigger en base de datos para notificar automáticamente cuando se crea o reingresa una solicitud de socio
CREATE OR REPLACE FUNCTION tranqui_legal.trq_fn_trg_notificar_solicitud_socio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_postulante_nombre text;
  v_postulante_correo text;
  v_titulo text;
  v_cuerpo text;
  v_url text;
BEGIN
  -- Solo disparar ante nuevas solicitudes o cambios de estado a enviada
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.ssc_estado = 'enviada' AND (OLD.ssc_estado IS NULL OR OLD.ssc_estado <> 'enviada')) THEN
    SELECT 
      COALESCE(NULLIF(CONCAT_WS(' ', usu_nombres, usu_apellidos), ''), usu_correo, 'Postulante'),
      COALESCE(usu_correo, '')
    INTO v_postulante_nombre, v_postulante_correo
    FROM comun_seguridad.seg_usuario
    WHERE usu_id = NEW.ssc_usuario_id;

    v_titulo := '📢 Nueva Postulación de Socio Abogado: ' || v_postulante_nombre;
    v_url := '/panel/socios/' || NEW.ssc_id::text;
    v_cuerpo := '<p>El profesional <strong>' || v_postulante_nombre || '</strong> (' || v_postulante_correo || ') ha registrado una postulación como Socio Abogado. Haz clic en <a href="' || v_url || '" style="color: #5000BA; font-weight: 700;">Evaluar Solicitud de Socio</a> para revisar su expediente.</p>';

    PERFORM comun_notificacion.not_fn_notificar_staff(
      'TRANQ',
      v_titulo,
      v_cuerpo,
      v_url,
      NEW.ssc_usuario_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_solicitud_socio ON tranqui_legal.trq_solicitud_socio;
CREATE TRIGGER trg_notificar_solicitud_socio
  AFTER INSERT OR UPDATE ON tranqui_legal.trq_solicitud_socio
  FOR EACH ROW
  EXECUTE FUNCTION tranqui_legal.trq_fn_trg_notificar_solicitud_socio();
