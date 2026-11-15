-- =============================================================================
-- Migración: 20261115000009_notificaciones_alertas_multinegocio_y_correo_compra.sql
-- Descripción:
--   1. Expone `comun_notificacion` y `comun_facturacion` en PostgREST y aplica
--      GRANT por columna en `comun_notificacion.not_registro` (Regla 13 AGENTS.md).
--   2. Amplía `comun_seguridad.seg_fn_obtener_staff_negocio` para incluir asesores
--      de ventas (`VENTAS`/`VENDEDOR`), superadmins de plataforma y los buzones
--      operativos/administrativos de Tinkay (`tinkay.uio@gmail.com`,
--      `familiammtg@gmail.com`, `kleber.toapanta.ch@gmail.com`).
--   3. Crea RPCs SECURITY DEFINER en `comun_seguridad` para emitir, listar y
--      gestionar alertas In-App / Push sin requerir `service_role` en cliente/SSR:
--      - `seg_fn_emitir_notificaciones_internas(p_negocio, p_items)`
--      - `seg_fn_listar_mis_notificaciones(p_negocio)`
--      - `seg_fn_accion_mi_notificacion(p_not_id, p_accion, p_horas)`
-- =============================================================================

-- 1. Exposición segura en PostgREST y permisos granulares (Regla 13 AGENTS.md)
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, comun_auditoria, comun_configuracion, comun_seguridad, comun_catalogo, tranqui_legal, comun_comercio, comun_notificacion, comun_facturacion';
NOTIFY pgrst, 'reload config';

GRANT USAGE ON SCHEMA comun_notificacion TO anon, authenticated, service_role;

ALTER TABLE comun_notificacion.not_registro
  ALTER COLUMN not_negocio TYPE VARCHAR(40);

REVOKE UPDATE ON comun_notificacion.not_registro FROM anon, authenticated;
GRANT SELECT ON comun_notificacion.not_registro TO authenticated;
GRANT UPDATE (not_leido_en, not_detalles) ON comun_notificacion.not_registro TO authenticated;
GRANT ALL ON comun_notificacion.not_registro TO service_role;

DROP POLICY IF EXISTS not_registro_select_propio ON comun_notificacion.not_registro;
CREATE POLICY not_registro_select_propio ON comun_notificacion.not_registro
  FOR SELECT TO authenticated
  USING (not_usuario_id = auth.uid());

DROP POLICY IF EXISTS not_registro_update_propio ON comun_notificacion.not_registro;
CREATE POLICY not_registro_update_propio ON comun_notificacion.not_registro
  FOR UPDATE TO authenticated
  USING (not_usuario_id = auth.uid())
  WITH CHECK (not_usuario_id = auth.uid());

-- 2. Función auxiliar para resolver código corto de notificación por negocio
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_codigo_notificacion_negocio(p_negocio text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE comun_seguridad.seg_fn_normalizar_negocio(p_negocio)
    WHEN 'tinkay' THEN 'TNK'
    WHEN 'fastfix' THEN 'FFH'
    WHEN 'margaritas' THEN 'MRG'
    ELSE 'TRANQ'
  END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_codigo_notificacion_negocio(text)
  TO anon, authenticated, service_role;

-- 3. Actualizar seg_fn_obtener_staff_negocio para cubrir ventas, operadores, admins y superadmins
DROP FUNCTION IF EXISTS comun_seguridad.seg_fn_obtener_staff_negocio(text);

CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(p_negocio text DEFAULT 'tranqi')
RETURNS TABLE (
  usu_id uuid,
  usu_correo text,
  perfiles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    -- Staff activo con membresía o perfil en el negocio
    SELECT
      u.usu_id,
      u.usu_correo,
      upper(coalesce(p.per_clave, m.mem_rol, 'OPERADOR')) AS rol_efectivo
    FROM comun_seguridad.seg_usuario u
    JOIN comun_seguridad.seg_membresia m
      ON m.mem_usuario_id = u.usu_id
     AND comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio_canon
     AND m.mem_estado = 'ACTIVO'
    LEFT JOIN comun_seguridad.seg_membresia_perfil mp
      ON mp.mpe_membresia_id = m.mem_id
    LEFT JOIN comun_seguridad.seg_perfil p
      ON p.per_id = mp.mpe_perfil_id
    WHERE
      upper(coalesce(m.mem_rol, '')) IN (
        'OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN', 'AUXILIAR',
        'VENTAS', 'VENDEDOR', 'ASESOR', 'ASESOR_VENTAS'
      )
      OR upper(coalesce(p.per_clave, '')) IN (
        'OPERADOR', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN', 'AUXILIAR',
        'VENTAS', 'VENDEDOR', 'ASESOR', 'ASESOR_VENTAS'
      )

    UNION ALL

    -- Superadmins globales de plataforma
    SELECT
      u.usu_id,
      u.usu_correo,
      'SUPERADMIN'::text AS rol_efectivo
    FROM comun_seguridad.seg_usuario u
    WHERE u.usu_superadmin_plataforma = true

    UNION ALL

    -- Cuentas titulares operativas de Tinkay (alineado con sincronizarAccesoRolTinkayAction)
    SELECT
      u.usu_id,
      u.usu_correo,
      'ADMINISTRADOR'::text AS rol_efectivo
    FROM comun_seguridad.seg_usuario u
    WHERE v_negocio_canon = 'tinkay'
      AND lower(trim(u.usu_correo)) IN (
        'tinkay.uio@gmail.com',
        'kleber.toapanta.ch@gmail.com'
      )
  )
  SELECT
    c.usu_id,
    c.usu_correo,
    array_agg(DISTINCT c.rol_efectivo) AS perfiles
  FROM candidatos c
  WHERE c.usu_correo IS NOT NULL AND length(trim(c.usu_correo)) > 3
  GROUP BY c.usu_id, c.usu_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_obtener_staff_negocio(text)
  TO anon, authenticated, service_role;

-- 4. RPC SECURITY DEFINER para emitir alertas In-App / Push (staff del negocio o usuario actual)
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_emitir_notificaciones_internas(
  p_negocio text,
  p_items jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_codigo_corto text := comun_seguridad.seg_fn_codigo_notificacion_negocio(p_negocio);
  v_uid_actual uuid := auth.uid();
  v_item jsonb;
  v_destinatario uuid;
  v_canal text;
  v_titulo text;
  v_html text;
  v_url text;
  v_clave text;
  v_es_destinatario_valido boolean;
  v_insertados integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_destinatario := (v_item ->> 'usuario_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_destinatario := NULL;
    END;

    IF v_destinatario IS NULL THEN
      CONTINUE;
    END IF;

    -- Validar que el destinatario sea el propio comprador autenticado o un miembro staff del negocio
    v_es_destinatario_valido := (v_uid_actual IS NOT NULL AND v_destinatario = v_uid_actual)
      OR EXISTS (
        SELECT 1
        FROM comun_seguridad.seg_fn_obtener_staff_negocio(v_negocio_canon) s
        WHERE s.usu_id = v_destinatario
      );

    IF NOT v_es_destinatario_valido THEN
      CONTINUE;
    END IF;

    v_canal := upper(coalesce(v_item ->> 'canal', 'IN_APP'));
    IF v_canal NOT IN ('IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP_PROPUESTA') THEN
      v_canal := 'IN_APP';
    END IF;

    v_titulo := left(trim(coalesce(v_item ->> 'titulo', '')), 300);
    v_html := coalesce(v_item ->> 'contenido_html', '');
    v_url := left(coalesce(v_item ->> 'url_accion', '/panel'), 300);
    v_clave := nullif(trim(coalesce(v_item ->> 'clave_referencia', '')), '');

    IF v_titulo = '' THEN
      CONTINUE;
    END IF;

    IF v_clave IS NOT NULL AND EXISTS (
      SELECT 1
      FROM comun_notificacion.not_registro r
      WHERE r.not_usuario_id = v_destinatario
        AND r.not_canal = v_canal
        AND (r.not_detalles ->> 'clave_original') = v_clave
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO comun_notificacion.not_registro (
      not_usuario_id,
      not_negocio,
      not_canal,
      not_titulo,
      not_contenido_html,
      not_url_accion,
      not_detalles,
      not_creado_en
    ) VALUES (
      v_destinatario,
      v_codigo_corto,
      v_canal,
      v_titulo,
      v_html,
      v_url,
      CASE
        WHEN v_clave IS NOT NULL THEN jsonb_build_object('clave_original', v_clave, 'negocio_canon', v_negocio_canon)
        ELSE jsonb_build_object('negocio_canon', v_negocio_canon)
      END,
      now()
    );

    v_insertados := v_insertados + 1;
  END LOOP;

  RETURN v_insertados;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_emitir_notificaciones_internas(text, jsonb)
  TO anon, authenticated, service_role;

-- 5. RPC SECURITY DEFINER para listar las notificaciones del usuario autenticado en el negocio activo
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_listar_mis_notificaciones(
  p_negocio text DEFAULT 'tranqi'
)
RETURNS TABLE (
  not_id uuid,
  not_titulo text,
  not_contenido_html text,
  not_url_accion text,
  not_leido_en timestamptz,
  not_creado_en timestamptz,
  not_canal text,
  not_detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_codigo_corto text := comun_seguridad.seg_fn_codigo_notificacion_negocio(p_negocio);
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.not_id,
    r.not_titulo,
    r.not_contenido_html,
    r.not_url_accion,
    r.not_leido_en,
    r.not_creado_en,
    r.not_canal::text,
    coalesce(r.not_detalles, '{}'::jsonb)
  FROM comun_notificacion.not_registro r
  WHERE r.not_usuario_id = v_uid
    AND r.not_canal = 'IN_APP'
    AND (
      upper(r.not_negocio) = upper(v_codigo_corto)
      OR comun_seguridad.seg_fn_normalizar_negocio(r.not_negocio) = v_negocio_canon
      OR coalesce(r.not_detalles ->> 'negocio_canon', '') = v_negocio_canon
    )
  ORDER BY r.not_creado_en DESC
  LIMIT 60;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_listar_mis_notificaciones(text)
  TO authenticated, service_role;

-- 6. RPC SECURITY DEFINER para acciones del usuario sobre su propia notificación
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_accion_mi_notificacion(
  p_not_id uuid,
  p_accion text,
  p_horas integer DEFAULT 3
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_accion text := lower(trim(coalesce(p_accion, 'aceptar')));
  v_horas integer := greatest(1, coalesce(p_horas, 3));
BEGIN
  IF v_uid IS NULL OR p_not_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_accion = 'aceptar' THEN
    UPDATE comun_notificacion.not_registro
       SET not_leido_en = coalesce(not_leido_en, now())
     WHERE not_id = p_not_id AND not_usuario_id = v_uid;
  ELSIF v_accion = 'posponer' THEN
    UPDATE comun_notificacion.not_registro
       SET not_detalles = coalesce(not_detalles, '{}'::jsonb) || jsonb_build_object(
         'pospuesta_horas', v_horas,
         'pospuesta_hasta', (now() + make_interval(hours => v_horas))
       )
     WHERE not_id = p_not_id AND not_usuario_id = v_uid;
  ELSIF v_accion = 'eliminar' THEN
    UPDATE comun_notificacion.not_registro
       SET not_leido_en = coalesce(not_leido_en, now()),
           not_detalles = coalesce(not_detalles, '{}'::jsonb) || jsonb_build_object(
             'eliminada', true,
             'eliminada_en', now()
           )
     WHERE not_id = p_not_id AND not_usuario_id = v_uid;
  ELSIF v_accion = 'restaurar' THEN
    UPDATE comun_notificacion.not_registro
       SET not_detalles = (coalesce(not_detalles, '{}'::jsonb) - 'eliminada' - 'eliminada_en') || jsonb_build_object(
             'eliminada', false
           )
     WHERE not_id = p_not_id AND not_usuario_id = v_uid;
  ELSE
    RETURN false;
  END IF;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_accion_mi_notificacion(uuid, text, integer)
  TO authenticated, service_role;
