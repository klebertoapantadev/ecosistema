-- Migración: 20260928000004_fix_satcomla_operador_revocar_superadmin.sql
-- Descripción: Revoca el flag y privilegios de SuperAdmin a satcomla.ti@gmail.com para que
--              opere estrictamente con su rol asignado de OPERADOR, sin privilegios globales de SuperAdmin.

-- 1. Actualizar seg_usuario: Quitar flag superadmin a satcomla.ti@gmail.com
UPDATE comun_seguridad.seg_usuario
SET usu_superadmin_plataforma = false,
    usu_actualizado_en = NOW()
WHERE lower(usu_correo) = 'satcomla.ti@gmail.com';

-- 2. Actualizar helper comun_seguridad.seg_fn_es_superadmin
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
        OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_es_superadmin() TO authenticated;

-- 3. Actualizar trigger comun_seguridad.seg_fn_provisionar_usuario
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_provisionar_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombres text;
  v_apellidos text;
  v_avatar text;
  v_es_superadmin boolean;
  v_email_clean text;
  v_nombre_completo text;
  v_terminos_version text;
BEGIN
  v_email_clean := lower(coalesce(new.email, ''));

  -- SuperAdmin de plataforma para emails fundadores
  v_es_superadmin := (v_email_clean IN ('familiammtg@gmail.com', 'jesus251296@gmail.com'));

  -- Extraer metadatos de Google OAuth o registro directo
  v_nombres := coalesce(
    new.raw_user_meta_data ->> 'given_name',
    new.raw_user_meta_data ->> 'nombres'
  );

  v_apellidos := coalesce(
    new.raw_user_meta_data ->> 'family_name',
    new.raw_user_meta_data ->> 'apellidos'
  );

  v_terminos_version := new.raw_user_meta_data ->> 'terminos_version';

  IF v_nombres IS NULL AND v_apellidos IS NULL THEN
    v_nombre_completo := trim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', v_email_clean));
    IF v_nombre_completo IS NOT NULL AND v_nombre_completo <> '' THEN
      v_nombres := split_part(v_nombre_completo, ' ', 1);
      v_apellidos := nullif(trim(substring(v_nombre_completo from length(v_nombres) + 1)), '');
    END IF;
  END IF;

  v_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    null
  );

  -- Upsert en seg_usuario
  INSERT INTO comun_seguridad.seg_usuario (
    usu_id,
    usu_correo,
    usu_nombres,
    usu_apellidos,
    usu_superadmin_plataforma,
    usu_terminos_aceptados_en,
    usu_terminos_version,
    usu_detalle_usuario
  )
  VALUES (
    new.id,
    new.email,
    v_nombres,
    v_apellidos,
    v_es_superadmin,
    CASE WHEN v_terminos_version IS NOT NULL THEN now() ELSE NULL END,
    v_terminos_version,
    jsonb_build_object(
      'nombres', v_nombres,
      'apellidos', v_apellidos,
      'foto', v_avatar,
      'avatar_url', v_avatar,
      'proveedor_auth', coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
      'creado_via', 'auth_trigger_provisionamiento',
      'email_confirmado_en', new.email_confirmed_at
    )
  )
  ON CONFLICT (usu_id) DO UPDATE SET
    usu_correo = EXCLUDED.usu_correo,
    usu_nombres = coalesce(EXCLUDED.usu_nombres, comun_seguridad.seg_usuario.usu_nombres),
    usu_apellidos = coalesce(EXCLUDED.usu_apellidos, comun_seguridad.seg_usuario.usu_apellidos),
    usu_superadmin_plataforma = CASE 
      WHEN lower(EXCLUDED.usu_correo) IN ('kleber.toapanta.ch@gmail.com', 'satcomla.ti@gmail.com') THEN false
      WHEN v_es_superadmin THEN true 
      ELSE comun_seguridad.seg_usuario.usu_superadmin_plataforma 
    END,
    usu_detalle_usuario = coalesce(comun_seguridad.seg_usuario.usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object(
      'foto', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'foto'),
      'avatar_url', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'avatar_url')
    ),
    usu_actualizado_en = now();

  RETURN new;
END;
$$;

-- 4. Actualizar seg_fn_obtener_staff_negocio
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
    OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com')
    OR m.mem_rol IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
    OR p.per_clave IN ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  GROUP BY u.usu_id, u.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text) TO authenticated, service_role, anon;

-- 5. Actualizar not_fn_notificar_staff
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
        OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com')
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
