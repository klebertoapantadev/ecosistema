-- Migración: 20260928000001_fix_baja_cuenta_fk_cascade_trq_cliente.sql
-- Descripción: Corrige restricciones de clave foránea (FK) en tranqui_legal.trq_cliente_perfil
--              y actualiza comun_seguridad.seg_fn_eliminar_cuenta() para garantizar la baja
--              de cuenta (derecho al olvido LOPDP / PLT-012) sin violaciones de integridad referencial.

-- 1. Actualizar FKs en tranqui_legal.trq_cliente_perfil
DO $$
BEGIN
  IF to_regclass('tranqui_legal.trq_cliente_perfil') IS NOT NULL THEN
    -- FK usuario titular -> CASCADE al eliminar usuario
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_usuario_id_fkey;
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      ADD CONSTRAINT trq_cliente_perfil_clp_usuario_id_fkey
      FOREIGN KEY (clp_usuario_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

    -- FK representante legal -> SET NULL
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_representante_legal_id_fkey;
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      ADD CONSTRAINT trq_cliente_perfil_clp_representante_legal_id_fkey
      FOREIGN KEY (clp_representante_legal_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;

    -- FK creado por -> SET NULL
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      DROP CONSTRAINT IF EXISTS trq_cliente_perfil_clp_creado_por_fkey;
    ALTER TABLE tranqui_legal.trq_cliente_perfil
      ADD CONSTRAINT trq_cliente_perfil_clp_creado_por_fkey
      FOREIGN KEY (clp_creado_por) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Asegurar FKs de Casos, Citas y Asistente en tranqui_legal
DO $$
BEGIN
  IF to_regclass('tranqui_legal.trq_caso_judicial') IS NOT NULL THEN
    ALTER TABLE tranqui_legal.trq_caso_judicial
      DROP CONSTRAINT IF EXISTS trq_caso_judicial_cas_cliente_id_fkey;
    ALTER TABLE tranqui_legal.trq_caso_judicial
      ADD CONSTRAINT trq_caso_judicial_cas_cliente_id_fkey
      FOREIGN KEY (cas_cliente_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('tranqui_legal.trq_cita') IS NOT NULL THEN
    ALTER TABLE tranqui_legal.trq_cita
      DROP CONSTRAINT IF EXISTS trq_cita_cit_cliente_id_fkey;
    ALTER TABLE tranqui_legal.trq_cita
      ADD CONSTRAINT trq_cita_cit_cliente_id_fkey
      FOREIGN KEY (cit_cliente_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;

    ALTER TABLE tranqui_legal.trq_cita
      DROP CONSTRAINT IF EXISTS trq_cita_cit_cancelada_por_fkey;
    ALTER TABLE tranqui_legal.trq_cita
      ADD CONSTRAINT trq_cita_cit_cancelada_por_fkey
      FOREIGN KEY (cit_cancelada_por) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('tranqui_legal.trq_asistente_conversacion') IS NOT NULL THEN
    ALTER TABLE tranqui_legal.trq_asistente_conversacion
      DROP CONSTRAINT IF EXISTS trq_asistente_conversacion_cnv_usuario_id_fkey;
    ALTER TABLE tranqui_legal.trq_asistente_conversacion
      ADD CONSTRAINT trq_asistente_conversacion_cnv_usuario_id_fkey
      FOREIGN KEY (cnv_usuario_id) REFERENCES comun_seguridad.seg_usuario(usu_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Actualizar función RPC comun_seguridad.seg_fn_eliminar_cuenta()
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_eliminar_cuenta()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_historial boolean;
  v_saldo_real numeric(12,4);
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no encontrada';
  END IF;

  -- 1. Validar si existe comun_facturacion
  IF to_regclass('comun_facturacion.fac_transaccion_pago') IS NOT NULL THEN
    RAISE EXCEPTION 'Existe comun_facturacion y seg_fn_eliminar_cuenta() todavía no la consulta -- contactar a soporte para procesar la baja manualmente.';
  END IF;

  -- 2. Historial transaccional comercial real
  SELECT
       EXISTS (SELECT 1 FROM comun_comercio.com_transaccion_pago
               WHERE pag_cliente_id = v_usuario_id
                 AND pag_estado IN ('APROBADO','REVERSADO'))
    OR EXISTS (SELECT 1 FROM comun_comercio.com_suscripcion
               WHERE sub_cliente_id = v_usuario_id
                 AND sub_estado IN ('ACTIVA','PAUSADA','EN_MORA'))
    OR EXISTS (SELECT 1 FROM comun_comercio.com_proforma
               WHERE prf_cliente_id = v_usuario_id)
    OR EXISTS (SELECT 1 FROM comun_comercio.com_billetera b
               JOIN comun_comercio.com_billetera_movimiento m ON m.wlm_billetera_id = b.wlt_id
               WHERE b.wlt_usuario_id = v_usuario_id)
  INTO v_historial;

  -- 3. Saldo real en billetera
  SELECT coalesce(SUM(wlt_saldo_recarga), 0) INTO v_saldo_real
  FROM comun_comercio.com_billetera
  WHERE wlt_usuario_id = v_usuario_id AND wlt_activo;

  IF v_saldo_real > 0 THEN
    RAISE EXCEPTION 'Tu billetera conserva saldo recargado. Solicita su devolución a soporte antes de dar de baja la cuenta.';
  END IF;

  -- 4. Si tiene historial transaccional, anonimizar conforme a LOPDP
  IF v_historial THEN
    UPDATE comun_seguridad.seg_usuario SET
      usu_nombres         = 'Cuenta',
      usu_apellidos       = 'dada de baja',
      usu_correo          = 'anonimo+' || v_usuario_id::text || '@invalido.local',
      usu_whatsapp        = NULL,
      usu_cedula          = NULL,
      usu_detalle_usuario = jsonb_build_object('anonimizada_en', now())
    WHERE usu_id = v_usuario_id;

    UPDATE comun_seguridad.seg_membresia
      SET mem_estado = 'INACTIVO'
    WHERE mem_usuario_id = v_usuario_id;

    -- Anonimizar en perfil de cliente CRM si existe
    IF to_regclass('tranqui_legal.trq_cliente_perfil') IS NOT NULL THEN
      UPDATE tranqui_legal.trq_cliente_perfil
      SET clp_razon_social = 'Cuenta Anonimizada',
          clp_identificacion = '9999999999' || substr(v_usuario_id::text, 1, 3),
          clp_correo = 'anonimo+' || v_usuario_id::text || '@invalido.local',
          clp_telefono = NULL,
          clp_activo = false,
          clp_eliminado_en = now()
      WHERE clp_usuario_id = v_usuario_id;
    END IF;

    UPDATE auth.users SET
      email              = 'anonimo+' || v_usuario_id::text || '@invalido.local',
      phone              = NULL,
      encrypted_password = NULL,
      raw_user_meta_data = '{}'::jsonb,
      banned_until       = 'infinity'::timestamptz
    WHERE id = v_usuario_id;

    DELETE FROM auth.identities WHERE user_id = v_usuario_id;
    DELETE FROM auth.sessions   WHERE user_id = v_usuario_id;

    RETURN 'anonimizada';
  END IF;

  -- 5. Sin historial transaccional: Limpieza limpia previa
  IF to_regclass('tranqui_legal.trq_cliente_perfil') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_cliente_perfil WHERE clp_usuario_id = v_usuario_id;
  END IF;

  IF to_regclass('tranqui_legal.trq_asistente_conversacion') IS NOT NULL THEN
    DELETE FROM tranqui_legal.trq_asistente_conversacion WHERE cnv_usuario_id = v_usuario_id;
  END IF;

  IF to_regclass('comun_comercio.com_billetera') IS NOT NULL THEN
    DELETE FROM comun_comercio.com_billetera WHERE wlt_usuario_id = v_usuario_id;
  END IF;

  -- Borrado en auth.users (cascada automáticamente a seg_usuario, seg_membresia, etc.)
  DELETE FROM auth.users WHERE id = v_usuario_id;

  RETURN 'eliminada';
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_eliminar_cuenta() TO authenticated;
