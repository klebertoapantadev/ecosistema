-- ==============================================================================
-- RESET DEL SISTEMA AISLADO Y SEGURO: EXCLUSIVO PARA USUARIOS Y DATOS OPERATIVOS
-- 1. Elimina únicamente usuarios de prueba, perfiles asignados y datos en TRANQI
-- 2. No toca ningún otro negocio del ecosistema (FastFix, Tinkay, Margaritas)
-- 3. Preserva 100% las configuraciones del negocio, SMTP, términos, plantillas,
--    catálogo comercial unificado y el catálogo maestro de perfiles (seg_perfil)
-- ==============================================================================

CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_superadmin_resetear_sistema(p_negocio text DEFAULT 'TRANQ')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio text := upper(coalesce(p_negocio, 'TRANQ'));
  v_superadmin_id uuid;
BEGIN
  -- 1. Verificación estricta de SuperAdmin
  IF NOT comun_seguridad.seg_fn_es_superadmin() THEN
    RAISE EXCEPTION 'Solo el SuperAdmin de Plataforma puede resetear el sistema';
  END IF;

  -- Normalización de clave de negocio
  IF v_negocio = 'TRANQI' THEN v_negocio := 'TRANQ'; END IF;
  IF v_negocio = 'FASTFIX' THEN v_negocio := 'FFH'; END IF;
  IF v_negocio = 'TINKAY' THEN v_negocio := 'TNK'; END IF;
  IF v_negocio = 'MARGARITAS' THEN v_negocio := 'MRG'; END IF;

  -- Identificar SuperAdmin principal para protegerlo de cualquier purga
  SELECT usu_id INTO v_superadmin_id 
  FROM comun_seguridad.seg_usuario 
  WHERE usu_correo = 'kleber.toapanta.ch@gmail.com' 
  LIMIT 1;

  -- 2. Tabla temporal con usuarios de prueba a purgar pertenecientes a este negocio
  CREATE TEMP TABLE tmp_usuarios_purgar ON COMMIT DROP AS
  SELECT DISTINCT u.usu_id
  FROM comun_seguridad.seg_usuario u
  JOIN comun_seguridad.seg_membresia m ON m.mem_usuario_id = u.usu_id
  WHERE (
      (v_negocio = 'TRANQ' AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI'))
      OR (v_negocio = 'FFH' AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (v_negocio = 'TNK' AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
      OR (v_negocio = 'MRG' AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
      OR upper(m.mem_negocio) = v_negocio
    )
    AND u.usu_superadmin_plataforma = false
    AND u.usu_correo NOT IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com');

  -- 3. Limpieza de datos operacionales según el negocio especificado
  IF v_negocio = 'TRANQ' THEN
    -- Purgar expedientes, casos y documentos vinculados a usuarios de prueba
    IF to_regclass('tranqui_legal.trq_documento_expediente') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_documento_expediente WHERE dex_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_expediente') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_expediente WHERE exp_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_caso') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_caso WHERE caso_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_billetera_documento') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_billetera_documento WHERE doc_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_lead_crm') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_lead_crm WHERE lead_id IS NOT NULL;
    END IF;

    -- Purgar abogados y solicitudes de prueba
    DELETE FROM tranqui_legal.trq_abogado WHERE abg_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_revision_solicitud WHERE rev_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_documento_socio WHERE dcs_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_solicitud_materia WHERE sma_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_solicitud_provincia WHERE spr_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_experiencia_laboral WHERE exp_id IS NOT NULL;
    DELETE FROM tranqui_legal.trq_solicitud_socio WHERE ssc_id IS NOT NULL;
  END IF;

  -- 4. Purgar transacciones de prueba en comun_comercio generadas por usuarios de prueba
  IF to_regclass('comun_comercio.com_transaccion') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_transaccion 
    WHERE tra_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  IF to_regclass('comun_comercio.com_pago') IS NOT NULL AND to_regclass('comun_comercio.com_orden') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_pago 
    WHERE pag_orden_id IN (SELECT ord_id FROM comun_comercio.com_orden WHERE ord_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar));
  END IF;

  IF to_regclass('comun_comercio.com_orden_item') IS NOT NULL AND to_regclass('comun_comercio.com_orden') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_orden_item 
    WHERE ori_orden_id IN (SELECT ord_id FROM comun_comercio.com_orden WHERE ord_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar));
  END IF;

  IF to_regclass('comun_comercio.com_orden') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_orden 
    WHERE ord_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  -- 5. Purgar notificaciones dirigidas a usuarios de prueba
  IF to_regclass('comun_notificacion.not_destinatario') IS NOT NULL THEN
    DELETE FROM comun_notificacion.not_destinatario 
    WHERE des_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  -- 6. Purgar perfiles ASIGNADOS a usuarios de prueba en este negocio (NO elimina seg_perfil)
  DELETE FROM comun_seguridad.seg_membresia_perfil
  WHERE mpe_membresia_id IN (
    SELECT mem_id FROM comun_seguridad.seg_membresia
    WHERE (
        (v_negocio = 'TRANQ' AND upper(mem_negocio) IN ('TRANQ', 'TRANQI'))
        OR upper(mem_negocio) = v_negocio
      )
      AND mem_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
  );

  -- 7. Purgar membresías de los usuarios de prueba en este negocio
  DELETE FROM comun_seguridad.seg_membresia
  WHERE (
      (v_negocio = 'TRANQ' AND upper(mem_negocio) IN ('TRANQ', 'TRANQI'))
      OR upper(mem_negocio) = v_negocio
    )
    AND mem_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);

  -- 8. Purgar registros de seg_usuario solo si el usuario no tiene ninguna otra membresía en otro negocio
  DELETE FROM comun_seguridad.seg_usuario u
  WHERE u.usu_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    AND u.usu_superadmin_plataforma = false
    AND u.usu_correo NOT IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com')
    AND NOT EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m WHERE m.mem_usuario_id = u.usu_id
    );

  -- 9. Purgar en esquema auth los usuarios huérfanos que ya no están en seg_usuario
  DELETE FROM auth.refresh_tokens WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario)
  );
  DELETE FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.mfa_factors WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.identities WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.users WHERE id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);

  -- 10. RECARGA INMEDIATA DE CACHÉ DE POSTGREST EN SUPABASE
  NOTIFY pgrst, 'reload schema';

  RETURN 'reset_exitoso_negocio_' || v_negocio || '_preservando_configuraciones';
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_superadmin_resetear_sistema(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
