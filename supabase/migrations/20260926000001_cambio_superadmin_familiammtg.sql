-- Migración: 20260926000001_cambio_superadmin_familiammtg.sql
-- Descripción: Establece familiammtg@gmail.com como SuperAdmin de plataforma y revoca facultades de SuperAdmin a kleber.toapanta.ch@gmail.com

-- 1. Actualizar helper comun_seguridad.seg_fn_es_superadmin
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
        OR lower(u.usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_es_superadmin() TO authenticated;

-- 2. Actualizar trigger comun_seguridad.seg_fn_provisionar_usuario para nuevos registros
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
BEGIN
  v_email_clean := lower(coalesce(new.email, ''));

  -- SuperAdmin de plataforma para emails fundadores
  v_es_superadmin := (v_email_clean IN ('familiammtg@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com'));

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
      WHEN lower(EXCLUDED.usu_correo) = 'kleber.toapanta.ch@gmail.com' THEN false
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

-- 3. Actualizar flags de SuperAdmin en comun_seguridad.seg_usuario
UPDATE comun_seguridad.seg_usuario
SET usu_superadmin_plataforma = false, usu_actualizado_en = now()
WHERE lower(usu_correo) = 'kleber.toapanta.ch@gmail.com';

UPDATE comun_seguridad.seg_usuario
SET usu_superadmin_plataforma = true, usu_actualizado_en = now()
WHERE lower(usu_correo) IN ('familiammtg@gmail.com', 'jesus251296@gmail.com', 'satcomla.ti@gmail.com');

-- 4. Garantizar membresías y perfiles de SuperAdmin para familiammtg@gmail.com si el usuario ya existe
DO $$
DECLARE
  v_usu_id uuid;
  v_negocio text;
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_per_cliente_id uuid;
  v_negocios text[] := ARRAY['TRANQ', 'FASTF', 'TINKY', 'MARGA'];
BEGIN
  SELECT usu_id INTO v_usu_id
  FROM comun_seguridad.seg_usuario
  WHERE lower(usu_correo) = 'familiammtg@gmail.com';

  IF v_usu_id IS NOT NULL THEN
    SELECT per_id INTO v_per_superadmin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'SUPERADMIN';
    SELECT per_id INTO v_per_admin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'ADMINISTRADOR';
    SELECT per_id INTO v_per_cliente_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'CLIENTE';

    FOREACH v_negocio IN ARRAY v_negocios LOOP
      -- Upsert membresía
      INSERT INTO comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      VALUES (v_usu_id, v_negocio, 'SUPERADMIN', 'ACTIVO')
      ON CONFLICT (mem_usuario_id, mem_negocio) DO UPDATE SET
        mem_rol = 'SUPERADMIN',
        mem_estado = 'ACTIVO',
        mem_actualizado_en = now()
      RETURNING mem_id INTO v_mem_id;

      -- Asignar perfiles jerárquicos
      IF v_per_superadmin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_superadmin_id, v_usu_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_per_admin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_admin_id, v_usu_id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_per_cliente_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_cliente_id, v_usu_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;
