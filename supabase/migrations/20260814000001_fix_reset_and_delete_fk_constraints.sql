-- ==============================================================================
-- CORRECCIÓN DEFINITIVA DE RESETEO Y ELIMINACIÓN DE USUARIOS EN SUPABASE
-- 1. Elimina sobrecargas anteriores en el esquema comun_seguridad
-- 2. Asegura columnas y actualiza claves foráneas en cascada
-- 3. Redefine seg_fn_superadmin_eliminar_usuario (compatible con p_target_usuario_id y p_target_usu_id)
-- 4. Redefine seg_fn_superadmin_resetear_sistema con orden estricto de borrado
-- 5. Fuerza la recarga del schema cache de PostgREST en Supabase
-- ==============================================================================

-- 1. Eliminar versiones previas para limpiar la caché de PostgREST
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid);
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid, uuid);
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_superadmin_resetear_sistema();
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_superadmin_resetear_sistema(text);

-- 2. Asegurar columnas de confirmación de contrato en trq_solicitud_socio
ALTER TABLE tranqui_legal.trq_solicitud_socio
  ADD COLUMN IF NOT EXISTS ssc_contrato_confirmado_en timestamptz,
  ADD COLUMN IF NOT EXISTS ssc_contrato_confirmado_por uuid REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;

-- 3. Eliminar dinámicamente cualquier clave foránea existente en trq_abogado -> trq_solicitud_socio y recrear con ON DELETE CASCADE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'tranqui_legal'
      AND tc.table_name = 'trq_abogado'
      AND ccu.table_name = 'trq_solicitud_socio'
  ) LOOP
    EXECUTE 'ALTER TABLE tranqui_legal.trq_abogado DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE tranqui_legal.trq_abogado
  ADD CONSTRAINT trq_abogado_abg_solicitud_id_fkey
  FOREIGN KEY (abg_solicitud_id)
  REFERENCES tranqui_legal.trq_solicitud_socio(ssc_id)
  ON DELETE CASCADE;

-- 4. Redefinir eliminación individual (acepta tanto p_target_usuario_id como p_target_usu_id)
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_superadmin_eliminar_usuario(
  p_target_usuario_id uuid DEFAULT NULL,
  p_target_usu_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_id uuid := COALESCE(p_target_usuario_id, p_target_usu_id);
  v_target_correo text;
BEGIN
  IF NOT comun_seguridad.seg_fn_es_superadmin() THEN
    RAISE EXCEPTION 'Solo el SuperAdmin puede eliminar usuarios del sistema';
  END IF;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificar el ID del usuario a eliminar';
  END IF;

  SELECT usu_correo INTO v_target_correo FROM comun_seguridad.seg_usuario WHERE usu_id = v_target_id;
  IF v_target_correo = 'kleber.toapanta.ch@gmail.com' THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta principal de SuperAdmin';
  END IF;

  -- 4.1. Purgar trq_abogado primero (evita violar FK hacia trq_solicitud_socio)
  DELETE FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id;
  DELETE FROM tranqui_legal.trq_abogado WHERE abg_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );

  -- 4.2. Purgar tablas dependientes de solicitudes
  DELETE FROM tranqui_legal.trq_revision_solicitud WHERE rev_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );
  DELETE FROM tranqui_legal.trq_documento_socio WHERE dcs_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );
  DELETE FROM tranqui_legal.trq_solicitud_materia WHERE sma_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );
  DELETE FROM tranqui_legal.trq_solicitud_provincia WHERE spr_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );
  DELETE FROM tranqui_legal.trq_experiencia_laboral WHERE exp_solicitud_id IN (
    SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id
  );

  -- 4.3. Purgar solicitud principal
  DELETE FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id;

  -- 4.4. Purgar perfiles asignados y membresías en comun_seguridad
  DELETE FROM comun_seguridad.seg_membresia_perfil WHERE mpe_membresia_id IN (
    SELECT mem_id FROM comun_seguridad.seg_membresia WHERE mem_usuario_id = v_target_id
  );
  DELETE FROM comun_seguridad.seg_membresia WHERE mem_usuario_id = v_target_id;
  DELETE FROM comun_seguridad.seg_usuario WHERE usu_id = v_target_id;

  -- 4.5. Purgar en esquema auth
  DELETE FROM auth.refresh_tokens WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = v_target_id);
  DELETE FROM auth.sessions WHERE user_id = v_target_id;
  DELETE FROM auth.mfa_factors WHERE user_id = v_target_id;
  DELETE FROM auth.identities WHERE user_id = v_target_id;
  DELETE FROM auth.users WHERE id = v_target_id;

  RETURN 'usuario_eliminado_fisicamente';
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid, uuid) TO authenticated;

-- 5. Redefinir Reset Master del sistema con orden de borrado estricto
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_superadmin_resetear_sistema(p_negocio text DEFAULT 'TRANQ')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio text := upper(coalesce(p_negocio, 'TRANQ'));
BEGIN
  IF NOT comun_seguridad.seg_fn_es_superadmin() THEN
    RAISE EXCEPTION 'Solo el SuperAdmin puede resetear el sistema';
  END IF;

  IF v_negocio = 'TRANQI' THEN v_negocio := 'TRANQ'; END IF;
  IF v_negocio = 'FASTFIX' THEN v_negocio := 'FFH'; END IF;
  IF v_negocio = 'TINKAY' THEN v_negocio := 'TNK'; END IF;
  IF v_negocio = 'MARGARITAS' THEN v_negocio := 'MRG'; END IF;

  -- 5.1. Purgar esquemas operacionales
  IF v_negocio = 'TRANQ' OR v_negocio = 'TODOS' THEN
    DELETE FROM tranqui_legal.trq_abogado WHERE abg_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_revision_solicitud WHERE rev_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_documento_socio WHERE dcs_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_solicitud_materia WHERE sma_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_solicitud_provincia WHERE spr_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_experiencia_laboral WHERE exp_id IS NOT NULL OR true;
    DELETE FROM tranqui_legal.trq_solicitud_socio WHERE ssc_id IS NOT NULL OR true;
  END IF;

  IF (v_negocio = 'FFH' OR v_negocio = 'TODOS') AND to_regclass('fastfix_mantenimiento.ffh_tecnico') IS NOT NULL THEN
    DELETE FROM fastfix_mantenimiento.ffh_tecnico WHERE tec_id IS NOT NULL OR true;
  END IF;

  IF (v_negocio = 'TNK' OR v_negocio = 'TODOS') AND to_regclass('tinkay_floristeria.tnk_producto_flor') IS NOT NULL THEN
    DELETE FROM tinkay_floristeria.tnk_producto_flor WHERE pro_id IS NOT NULL OR true;
  END IF;

  IF (v_negocio = 'MRG' OR v_negocio = 'TODOS') AND to_regclass('margaritas_floristeria.mrg_producto_flor') IS NOT NULL THEN
    DELETE FROM margaritas_floristeria.mrg_producto_flor WHERE pro_id IS NOT NULL OR true;
  END IF;

  -- 5.2. Purgar perfiles asignados a membresías (excepto SuperAdmin)
  DELETE FROM comun_seguridad.seg_membresia_perfil
  WHERE mpe_membresia_id IN (
    SELECT mem_id FROM comun_seguridad.seg_membresia m
    JOIN comun_seguridad.seg_usuario u ON u.usu_id = m.mem_usuario_id
    WHERE (
        v_negocio = 'TODOS' 
        OR (v_negocio = 'TRANQ' AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI'))
        OR (v_negocio = 'FFH' AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
        OR (v_negocio = 'TNK' AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
        OR (v_negocio = 'MRG' AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
        OR upper(m.mem_negocio) = v_negocio
      )
      AND u.usu_superadmin_plataforma = false 
      AND u.usu_correo != 'kleber.toapanta.ch@gmail.com'
  );

  -- 5.3. Purgar membresías (excepto SuperAdmin)
  DELETE FROM comun_seguridad.seg_membresia
  WHERE (
      v_negocio = 'TODOS' 
      OR (v_negocio = 'TRANQ' AND upper(mem_negocio) IN ('TRANQ', 'TRANQI'))
      OR (v_negocio = 'FFH' AND upper(mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (v_negocio = 'TNK' AND upper(mem_negocio) IN ('TNK', 'TINKAY'))
      OR (v_negocio = 'MRG' AND upper(mem_negocio) IN ('MRG', 'MARGARITAS'))
      OR upper(mem_negocio) = v_negocio
    )
    AND mem_usuario_id IN (
      SELECT usu_id FROM comun_seguridad.seg_usuario
      WHERE usu_superadmin_plataforma = false AND usu_correo != 'kleber.toapanta.ch@gmail.com'
    );

  -- 5.4. Purgar usuarios base huérfanos
  DELETE FROM comun_seguridad.seg_usuario u
  WHERE u.usu_superadmin_plataforma = false 
    AND u.usu_correo != 'kleber.toapanta.ch@gmail.com'
    AND NOT EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m WHERE m.mem_usuario_id = u.usu_id
    );

  -- 5.5. Purgar en esquema auth
  DELETE FROM auth.refresh_tokens WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario)
  );
  DELETE FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.mfa_factors WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.identities WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.users WHERE id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);

  RETURN 'sistema_reseteado_por_negocio_' || v_negocio;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_superadmin_resetear_sistema(text) TO authenticated;

-- 6. RECARGAR INMEDIATAMENTE LA CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
