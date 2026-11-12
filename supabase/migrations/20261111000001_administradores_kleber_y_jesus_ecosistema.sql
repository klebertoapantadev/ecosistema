-- ============================================================================
-- Migración: 20261111000001_administradores_kleber_y_jesus_ecosistema.sql
-- Descripción: Asegura facultades de Administrador y SuperAdmin en todos los
--              negocios del ecosistema para kleber.toapanta.ch@gmail.com y
--              jesus251296@gmail.com, tanto en usuarios existentes como en el
--              trigger de aprovisionamiento automático.
-- ============================================================================

DO $$
DECLARE
  v_correo text;
  v_usu_id uuid;
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_per_cliente_id uuid;
  v_negocio text;
BEGIN
  SELECT per_id INTO v_per_superadmin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'SUPERADMIN';
  SELECT per_id INTO v_per_admin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'ADMINISTRADOR';
  SELECT per_id INTO v_per_cliente_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'CLIENTE';

  FOREACH v_correo IN ARRAY ARRAY['kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com'] LOOP
    v_usu_id := NULL;

    SELECT usu_id INTO v_usu_id
    FROM comun_seguridad.seg_usuario
    WHERE lower(usu_correo) = v_correo;

    IF v_usu_id IS NULL THEN
      SELECT id INTO v_usu_id
      FROM auth.users
      WHERE lower(email) = v_correo;

      IF v_usu_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_usuario (
          usu_id,
          usu_correo,
          usu_superadmin_plataforma,
          usu_detalle_usuario
        )
        VALUES (
          v_usu_id,
          v_correo,
          true,
          jsonb_build_object('creado_via', 'migracion_administradores_ecosistema')
        )
        ON CONFLICT (usu_id) DO UPDATE SET
          usu_superadmin_plataforma = true,
          usu_actualizado_en = NOW();
      END IF;
    ELSE
      UPDATE comun_seguridad.seg_usuario
      SET usu_superadmin_plataforma = true,
          usu_actualizado_en = NOW()
      WHERE usu_id = v_usu_id;
    END IF;

    IF v_usu_id IS NOT NULL THEN
      FOREACH v_negocio IN ARRAY ARRAY['tinkay', 'TNK', 'tranqi', 'TRANQ', 'fastfix', 'FFH', 'margaritas', 'MRG'] LOOP
        INSERT INTO comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
        VALUES (v_usu_id, v_negocio, 'SUPERADMIN', 'ACTIVO')
        ON CONFLICT (mem_usuario_id, mem_negocio) DO UPDATE SET
          mem_rol = 'SUPERADMIN',
          mem_estado = 'ACTIVO',
          mem_actualizado_en = NOW()
        RETURNING mem_id INTO v_mem_id;

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
  END LOOP;
END $$;

-- Actualizar trigger de aprovisionamiento para asignar membresías ADMINISTRADOR / SUPERADMIN
-- automáticamente cuando kleber.toapanta.ch@gmail.com o jesus251296@gmail.com se autentiquen
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
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_negocio text;
  v_negocios_objetivo text[];
BEGIN
  v_email_clean := lower(coalesce(new.email, ''));

  v_es_superadmin := (v_email_clean IN (
    'familiammtg@gmail.com',
    'jesus251296@gmail.com',
    'kleber.toapanta.ch@gmail.com',
    'tinkay.uio@gmail.com'
  ));

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
      WHEN lower(EXCLUDED.usu_correo) IN ('satcomla.ti@gmail.com') THEN false
      WHEN v_es_superadmin THEN true
      ELSE comun_seguridad.seg_usuario.usu_superadmin_plataforma
    END,
    usu_detalle_usuario = coalesce(comun_seguridad.seg_usuario.usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object(
      'foto', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'foto'),
      'avatar_url', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'avatar_url')
    ),
    usu_actualizado_en = now();

  IF v_email_clean IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com', 'tinkay.uio@gmail.com') THEN
    SELECT per_id INTO v_per_superadmin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'SUPERADMIN';
    SELECT per_id INTO v_per_admin_id FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = 'ADMINISTRADOR';

    IF v_email_clean = 'tinkay.uio@gmail.com' THEN
      v_negocios_objetivo := ARRAY['tinkay', 'TNK'];
    ELSE
      v_negocios_objetivo := ARRAY['tinkay', 'TNK', 'tranqi', 'TRANQ', 'fastfix', 'FFH', 'margaritas', 'MRG'];
    END IF;

    FOREACH v_negocio IN ARRAY v_negocios_objetivo LOOP
      INSERT INTO comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      VALUES (new.id, v_negocio, 'SUPERADMIN', 'ACTIVO')
      ON CONFLICT (mem_usuario_id, mem_negocio) DO UPDATE SET
        mem_rol = 'SUPERADMIN',
        mem_estado = 'ACTIVO',
        mem_actualizado_en = now()
      RETURNING mem_id INTO v_mem_id;

      IF v_per_superadmin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_superadmin_id, new.id)
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_per_admin_id IS NOT NULL THEN
        INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        VALUES (v_mem_id, v_per_admin_id, new.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new;
END;
$$;

