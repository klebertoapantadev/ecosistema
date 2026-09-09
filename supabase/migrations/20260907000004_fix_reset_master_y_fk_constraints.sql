-- ==============================================================================
-- CORRECCIÓN DEFINITIVA DE RESETEO Y ELIMINACIÓN DE USUARIOS / DATOS DE PRUEBA
-- 1. Ajusta Foreign Keys críticas hacia seg_usuario con ON DELETE CASCADE / SET NULL
-- 2. Actualiza seg_fn_superadmin_resetear_sistema con orden de purga exhaustivo de
--    tranqui_legal, comun_agenda, comun_comercio y comun_seguridad
-- 3. Actualiza seg_fn_superadmin_eliminar_usuario para limpieza atómica por usuario
-- ==============================================================================

-- 1. Ajuste de Claves Foráneas en tranqui_legal y comun_agenda hacia seg_usuario

-- 1.1 trq_cita
ALTER TABLE IF EXISTS tranqui_legal.trq_cita
  DROP CONSTRAINT IF EXISTS trq_cita_cit_cliente_id_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_cita
  ADD CONSTRAINT trq_cita_cit_cliente_id_fkey
  FOREIGN KEY (cit_cliente_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS tranqui_legal.trq_cita
  DROP CONSTRAINT IF EXISTS trq_cita_cit_cancelada_por_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_cita
  ADD CONSTRAINT trq_cita_cit_cancelada_por_fkey
  FOREIGN KEY (cit_cancelada_por) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;

-- 1.2 trq_caso_judicial
ALTER TABLE IF EXISTS tranqui_legal.trq_caso_judicial
  DROP CONSTRAINT IF EXISTS trq_caso_judicial_cas_cliente_id_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_caso_judicial
  ADD CONSTRAINT trq_caso_judicial_cas_cliente_id_fkey
  FOREIGN KEY (cas_cliente_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

-- 1.3 trq_cliente_perfil
ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_usuario_id_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  ADD CONSTRAINT trq_cliente_perfil_clp_usuario_id_fkey
  FOREIGN KEY (clp_usuario_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_representante_legal_id_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  ADD CONSTRAINT trq_cliente_perfil_clp_representante_legal_id_fkey
  FOREIGN KEY (clp_representante_legal_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_creado_por_fkey;
ALTER TABLE IF EXISTS tranqui_legal.trq_cliente_perfil
  ADD CONSTRAINT trq_cliente_perfil_clp_creado_por_fkey
  FOREIGN KEY (clp_creado_por) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;

-- 1.4 comun_agenda.age_reserva
ALTER TABLE IF EXISTS comun_agenda.age_reserva
  DROP CONSTRAINT IF EXISTS age_reserva_res_usuario_id_fkey;
ALTER TABLE IF EXISTS comun_agenda.age_reserva
  ADD CONSTRAINT age_reserva_res_usuario_id_fkey
  FOREIGN KEY (res_usuario_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS comun_agenda.age_reserva
  DROP CONSTRAINT IF EXISTS age_reserva_res_cliente_id_fkey;
ALTER TABLE IF EXISTS comun_agenda.age_reserva
  ADD CONSTRAINT age_reserva_res_cliente_id_fkey
  FOREIGN KEY (res_cliente_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;


-- 2. Redefinir la función Master de Reseteo del Sistema
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
      v_negocio = 'TODOS'
      OR (v_negocio = 'TRANQ' AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI'))
      OR (v_negocio = 'FFH' AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (v_negocio = 'TNK' AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
      OR (v_negocio = 'MRG' AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
      OR upper(m.mem_negocio) = v_negocio
    )
    AND u.usu_superadmin_plataforma = false
    AND u.usu_correo NOT IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com');

  -- 3. Limpieza de datos operacionales según el negocio especificado
  IF v_negocio IN ('TRANQ', 'TODOS') THEN
    -- 3.1 Purgar bitácoras y actuaciones de casos
    IF to_regclass('tranqui_legal.trq_caso_actuacion') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_caso_actuacion WHERE act_id IS NOT NULL;
    END IF;

    -- 3.2 Purgar documentos de caso y carpetas
    IF to_regclass('tranqui_legal.trq_documento_caso') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_documento_caso WHERE dcc_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_caso_carpeta') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_caso_carpeta WHERE ccr_id IS NOT NULL;
    END IF;

    -- 3.3 Purgar asignaciones de equipo y honorarios
    IF to_regclass('tranqui_legal.trq_caso_abogado_equipo') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_caso_abogado_equipo WHERE cae_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_honorario') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_honorario WHERE hon_id IS NOT NULL;
    END IF;

    -- 3.4 Purgar citas y consultas rápidas
    IF to_regclass('tranqui_legal.trq_consulta_rapida') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_consulta_rapida WHERE crp_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_cita') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_cita WHERE cit_id IS NOT NULL;
    END IF;

    -- 3.5 Purgar mensajes y conversaciones del asistente
    IF to_regclass('tranqui_legal.trq_mensaje') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_mensaje WHERE msg_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_conversacion') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_conversacion WHERE cnv_id IS NOT NULL;
    END IF;

    -- 3.6 Purgar casos judiciales y expedientes
    IF to_regclass('tranqui_legal.trq_caso_judicial') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_caso_judicial WHERE cas_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_archivo_digitalizacion_lote') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_archivo_digitalizacion_lote WHERE adl_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_cliente_perfil') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_cliente_perfil WHERE clp_id IS NOT NULL;
    END IF;

    -- 3.7 Purgar tablas heredadas o billetera
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
    IF to_regclass('tranqui_legal.trq_documento') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_documento WHERE doc_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_lead_crm') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_lead_crm WHERE lead_id IS NOT NULL;
    END IF;

    -- 3.8 Purgar abogados y especialidades
    IF to_regclass('tranqui_legal.trq_abogado_materia') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_abogado_materia WHERE amt_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_abogado_provincia') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_abogado_provincia WHERE apr_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_abogado') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_abogado WHERE abg_id IS NOT NULL;
    END IF;

    -- 3.9 Purgar solicitudes de socios
    IF to_regclass('tranqui_legal.trq_revision_solicitud') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_revision_solicitud WHERE rev_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_documento_socio') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_documento_socio WHERE dcs_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_solicitud_materia') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_solicitud_materia WHERE sma_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_solicitud_provincia') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_solicitud_provincia WHERE spr_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_experiencia_laboral') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_experiencia_laboral WHERE exp_id IS NOT NULL;
    END IF;
    IF to_regclass('tranqui_legal.trq_solicitud_socio') IS NOT NULL THEN
      DELETE FROM tranqui_legal.trq_solicitud_socio WHERE ssc_id IS NOT NULL;
    END IF;
  END IF;

  -- 4. Purgar Agenda transversal (comun_agenda) para el negocio o usuarios a purgar
  IF to_regclass('comun_agenda.age_reserva') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_reserva
    WHERE (v_negocio = 'TODOS' OR res_negocio ILIKE v_negocio || '%' OR res_negocio = 'tranqi')
       OR res_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
       OR res_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  IF to_regclass('comun_agenda.age_bloqueo') IS NOT NULL AND to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_bloqueo
    WHERE blq_profesional_id IN (
      SELECT agp_id FROM comun_agenda.age_profesional 
      WHERE (v_negocio = 'TODOS' OR agp_negocio ILIKE v_negocio || '%' OR agp_negocio = 'tranqi')
         OR agp_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    );
  END IF;

  IF to_regclass('comun_agenda.age_franja') IS NOT NULL AND to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_franja
    WHERE fra_profesional_id IN (
      SELECT agp_id FROM comun_agenda.age_profesional 
      WHERE (v_negocio = 'TODOS' OR agp_negocio ILIKE v_negocio || '%' OR agp_negocio = 'tranqi')
         OR agp_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    );
  END IF;

  IF to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_profesional
    WHERE (v_negocio = 'TODOS' OR agp_negocio ILIKE v_negocio || '%' OR agp_negocio = 'tranqi')
       OR agp_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  -- 5. Purgar transacciones, billeteras y suscripciones en comun_comercio de usuarios de prueba
  IF to_regclass('comun_comercio.com_derecho_consumo') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_derecho_consumo
    WHERE der_suscripcion_id IN (
      SELECT sub_id FROM comun_comercio.com_suscripcion WHERE sub_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    );
  END IF;

  IF to_regclass('comun_comercio.com_suscripcion') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_suscripcion
    WHERE sub_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
       OR (v_negocio != 'TODOS' AND sub_negocio ILIKE v_negocio || '%');
  END IF;

  IF to_regclass('comun_comercio.com_billetera_movimiento') IS NOT NULL AND to_regclass('comun_comercio.com_billetera') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_billetera_movimiento
    WHERE wlm_billetera_id IN (
      SELECT wlt_id FROM comun_comercio.com_billetera WHERE wlt_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    );
  END IF;

  IF to_regclass('comun_comercio.com_billetera') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_billetera
    WHERE wlt_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  IF to_regclass('comun_comercio.com_cupon_uso') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_cupon_uso
    WHERE cpu_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  IF to_regclass('comun_comercio.com_transaccion_pago') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_transaccion_pago
    WHERE pag_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  IF to_regclass('comun_comercio.com_proforma_item') IS NOT NULL AND to_regclass('comun_comercio.com_proforma') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_proforma_item
    WHERE pfi_proforma_id IN (
      SELECT prf_id FROM comun_comercio.com_proforma WHERE prf_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    );
  END IF;

  IF to_regclass('comun_comercio.com_proforma') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_proforma
    WHERE prf_cliente_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

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

  -- 6. Purgar notificaciones dirigidas a usuarios de prueba
  IF to_regclass('comun_notificacion.not_destinatario') IS NOT NULL THEN
    DELETE FROM comun_notificacion.not_destinatario 
    WHERE des_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;
  IF to_regclass('comun_notificacion.not_preferencia') IS NOT NULL THEN
    DELETE FROM comun_notificacion.not_preferencia 
    WHERE prf_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  -- 7. Purgar accesos y OTPs de usuarios de prueba en comun_seguridad
  IF to_regclass('comun_seguridad.seg_historial_acceso') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_historial_acceso
    WHERE hac_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;
  IF to_regclass('comun_seguridad.seg_otp_verificacion') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_otp_verificacion
    WHERE otp_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;
  IF to_regclass('comun_seguridad.seg_usuario_terminos') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_usuario_terminos
    WHERE ust_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);
  END IF;

  -- 8. Purgar perfiles ASIGNADOS a usuarios de prueba en este negocio (NO elimina seg_perfil maestro)
  DELETE FROM comun_seguridad.seg_membresia_perfil
  WHERE mpe_membresia_id IN (
    SELECT mem_id FROM comun_seguridad.seg_membresia
    WHERE (
        v_negocio = 'TODOS'
        OR (v_negocio = 'TRANQ' AND upper(mem_negocio) IN ('TRANQ', 'TRANQI'))
        OR (v_negocio = 'FFH' AND upper(mem_negocio) IN ('FFH', 'FASTFIX'))
        OR (v_negocio = 'TNK' AND upper(mem_negocio) IN ('TNK', 'TINKAY'))
        OR (v_negocio = 'MRG' AND upper(mem_negocio) IN ('MRG', 'MARGARITAS'))
        OR upper(mem_negocio) = v_negocio
      )
      AND mem_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
  );

  -- 9. Purgar membresías de los usuarios de prueba en este negocio
  DELETE FROM comun_seguridad.seg_membresia
  WHERE (
      v_negocio = 'TODOS'
      OR (v_negocio = 'TRANQ' AND upper(mem_negocio) IN ('TRANQ', 'TRANQI'))
      OR (v_negocio = 'FFH' AND upper(mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (v_negocio = 'TNK' AND upper(mem_negocio) IN ('TNK', 'TINKAY'))
      OR (v_negocio = 'MRG' AND upper(mem_negocio) IN ('MRG', 'MARGARITAS'))
      OR upper(mem_negocio) = v_negocio
    )
    AND mem_usuario_id IN (SELECT usu_id FROM tmp_usuarios_purgar);

  -- 10. Purgar registros de seg_usuario solo si el usuario no tiene ninguna otra membresía en otro negocio
  DELETE FROM comun_seguridad.seg_usuario u
  WHERE u.usu_id IN (SELECT usu_id FROM tmp_usuarios_purgar)
    AND u.usu_superadmin_plataforma = false
    AND u.usu_correo NOT IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com')
    AND NOT EXISTS (
      SELECT 1 FROM comun_seguridad.seg_membresia m WHERE m.mem_usuario_id = u.usu_id
    );

  -- 11. Purgar en esquema auth los usuarios huérfanos que ya no están en seg_usuario
  DELETE FROM auth.refresh_tokens WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario)
  );
  DELETE FROM auth.sessions WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.mfa_factors WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.identities WHERE user_id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);
  DELETE FROM auth.users WHERE id NOT IN (SELECT usu_id FROM comun_seguridad.seg_usuario);

  -- 12. Recarga inmediata de caché de PostgREST en Supabase
  NOTIFY pgrst, 'reload schema';

  RETURN 'reset_exitoso_negocio_' || v_negocio || '_preservando_configuraciones';
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_superadmin_resetear_sistema(text) TO authenticated;


-- 3. Redefinir seg_fn_superadmin_eliminar_usuario para limpieza atómica individual
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
  IF v_target_correo IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com') THEN
    RAISE EXCEPTION 'No se puede eliminar una cuenta protegida de Administrador/SuperAdmin';
  END IF;

  -- 3.1 Purgar datos de tranqui_legal vinculados al usuario
  IF to_regclass('tranqui_legal.trq_caso_actuacion') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_caso_actuacion WHERE act_autor_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_documento_caso') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_documento_caso WHERE dcc_subido_por = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_caso_abogado_equipo') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_caso_abogado_equipo 
    WHERE cae_abogado_id IN (SELECT abg_id FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_honorario') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_honorario 
    WHERE hon_abogado_id IN (SELECT abg_id FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_consulta_rapida') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_consulta_rapida WHERE crp_usuario_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_cita') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_cita 
    WHERE cit_cliente_id = v_target_id 
       OR cit_abogado_id IN (SELECT abg_id FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_mensaje') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_mensaje 
    WHERE msg_conversacion_id IN (SELECT cnv_id FROM tranqui_legal.trq_conversacion WHERE cnv_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_conversacion') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_conversacion WHERE cnv_usuario_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_caso_judicial') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_caso_judicial WHERE cas_cliente_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_cliente_perfil') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_cliente_perfil WHERE clp_usuario_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_abogado_materia') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_abogado_materia 
    WHERE amt_abogado_id IN (SELECT abg_id FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_abogado_provincia') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_abogado_provincia 
    WHERE apr_abogado_id IN (SELECT abg_id FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_abogado') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_abogado WHERE abg_usuario_id = v_target_id;
  END IF;
  IF to_regclass('tranqui_legal.trq_revision_solicitud') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_revision_solicitud 
    WHERE rev_solicitud_id IN (SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_documento_socio') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_documento_socio 
    WHERE dcs_solicitud_id IN (SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_solicitud_materia') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_solicitud_materia 
    WHERE sma_solicitud_id IN (SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_solicitud_provincia') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_solicitud_provincia 
    WHERE spr_solicitud_id IN (SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_experiencia_laboral') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_experiencia_laboral 
    WHERE exp_solicitud_id IN (SELECT ssc_id FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id);
  END IF;
  IF to_regclass('tranqui_legal.trq_solicitud_socio') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_solicitud_socio WHERE ssc_usuario_id = v_target_id;
  END IF;

  -- 3.2 Purgar datos de comun_agenda
  IF to_regclass('comun_agenda.age_reserva') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_reserva WHERE res_usuario_id = v_target_id OR res_cliente_id = v_target_id;
  END IF;
  IF to_regclass('comun_agenda.age_bloqueo') IS NOT NULL AND to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_bloqueo 
    WHERE blq_profesional_id IN (SELECT agp_id FROM comun_agenda.age_profesional WHERE agp_usuario_id = v_target_id);
  END IF;
  IF to_regclass('comun_agenda.age_franja') IS NOT NULL AND to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_franja 
    WHERE fra_profesional_id IN (SELECT agp_id FROM comun_agenda.age_profesional WHERE agp_usuario_id = v_target_id);
  END IF;
  IF to_regclass('comun_agenda.age_profesional') IS NOT NULL THEN
    DELETE FROM comun_agenda.age_profesional WHERE agp_usuario_id = v_target_id;
  END IF;

  -- 3.3 Purgar datos de comun_comercio
  IF to_regclass('comun_comercio.com_derecho_consumo') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_derecho_consumo 
    WHERE der_suscripcion_id IN (SELECT sub_id FROM comun_comercio.com_suscripcion WHERE sub_cliente_id = v_target_id);
  END IF;
  IF to_regclass('comun_comercio.com_suscripcion') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_suscripcion WHERE sub_cliente_id = v_target_id;
  END IF;
  IF to_regclass('comun_comercio.com_billetera_movimiento') IS NOT NULL AND to_regclass('comun_comercio.com_billetera') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_billetera_movimiento 
    WHERE wlm_billetera_id IN (SELECT wlt_id FROM comun_comercio.com_billetera WHERE wlt_usuario_id = v_target_id);
  END IF;
  IF to_regclass('comun_comercio.com_billetera') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_billetera WHERE wlt_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_comercio.com_cupon_uso') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_cupon_uso WHERE cpu_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_comercio.com_transaccion_pago') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_transaccion_pago WHERE pag_cliente_id = v_target_id;
  END IF;
  IF to_regclass('comun_comercio.com_proforma_item') IS NOT NULL AND to_regclass('comun_comercio.com_proforma') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_proforma_item 
    WHERE pfi_proforma_id IN (SELECT prf_id FROM comun_comercio.com_proforma WHERE prf_cliente_id = v_target_id);
  END IF;
  IF to_regclass('comun_comercio.com_proforma') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_proforma WHERE prf_cliente_id = v_target_id;
  END IF;
  IF to_regclass('comun_comercio.com_transaccion') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_transaccion WHERE tra_usuario_id = v_target_id;
  END IF;

  -- 3.4 Purgar notificaciones y accesos
  IF to_regclass('comun_notificacion.not_destinatario') IS NOT NULL THEN
    DELETE FROM comun_notificacion.not_destinatario WHERE des_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_notificacion.not_preferencia') IS NOT NULL THEN
    DELETE FROM comun_notificacion.not_preferencia WHERE prf_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_seguridad.seg_historial_acceso') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_historial_acceso WHERE hac_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_seguridad.seg_otp_verificacion') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_otp_verificacion WHERE otp_usuario_id = v_target_id;
  END IF;
  IF to_regclass('comun_seguridad.seg_usuario_terminos') IS NOT NULL THEN
    DELETE FROM comun_seguridad.seg_usuario_terminos WHERE ust_usuario_id = v_target_id;
  END IF;

  -- 3.5 Purgar membresías y usuario
  DELETE FROM comun_seguridad.seg_membresia_perfil 
  WHERE mpe_membresia_id IN (SELECT mem_id FROM comun_seguridad.seg_membresia WHERE mem_usuario_id = v_target_id);
  DELETE FROM comun_seguridad.seg_membresia WHERE mem_usuario_id = v_target_id;
  DELETE FROM comun_seguridad.seg_usuario WHERE usu_id = v_target_id;

  -- 3.6 Purgar en esquema auth
  DELETE FROM auth.refresh_tokens WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = v_target_id);
  DELETE FROM auth.sessions WHERE user_id = v_target_id;
  DELETE FROM auth.mfa_factors WHERE user_id = v_target_id;
  DELETE FROM auth.identities WHERE user_id = v_target_id;
  DELETE FROM auth.users WHERE id = v_target_id;

  NOTIFY pgrst, 'reload schema';

  RETURN 'usuario_eliminado_fisicamente';
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_superadmin_eliminar_usuario(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
