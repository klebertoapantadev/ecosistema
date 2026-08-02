-- Migración: 20260802000001_comun_notificacion.sql
-- Descripción: Módulo común de Notificaciones y Alertas Multicanal (PLT-013)
-- Esquema: comun_notificacion y tablas complementarias en comun_seguridad

CREATE SCHEMA IF NOT EXISTS comun_notificacion;

GRANT USAGE ON SCHEMA comun_notificacion TO authenticated, service_role, anon;

--------------------------------------------------------------------------------
-- 1. TABLA: comun_notificacion.not_campana (cmp_)
-- Registro auditado de campañas emitidas desde el widget `emision_notificaciones`
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_notificacion.not_campana (
  cmp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmp_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  cmp_negocio VARCHAR(10) NOT NULL,
  cmp_emisor_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(seg_id) ON DELETE CASCADE,
  cmp_tipo_audiencia VARCHAR(20) NOT NULL CHECK (cmp_tipo_audiencia IN ('TODOS', 'POR_ROL', 'POR_USUARIOS')),
  cmp_roles_jsonb JSONB DEFAULT '[]'::jsonb,
  cmp_usuarios_jsonb JSONB DEFAULT '[]'::jsonb,
  cmp_canales_jsonb JSONB NOT NULL DEFAULT '["IN_APP"]'::jsonb,
  cmp_asunto TEXT NOT NULL,
  cmp_cuerpo_html TEXT NOT NULL,
  cmp_cuerpo_markdown TEXT,
  cmp_estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA' CHECK (cmp_estado IN ('BORRADOR', 'PROGRAMADA', 'EMITIDA', 'CANCELADA')),
  cmp_metricas_jsonb JSONB DEFAULT '{"total_enviados": 0, "total_leidos": 0, "total_fallidos": 0}'::jsonb,
  cmp_detalles JSONB DEFAULT '{}'::jsonb,
  cmp_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permisos RLS en not_campana
ALTER TABLE comun_notificacion.not_campana ENABLE ROW LEVEL SECURITY;

CREATE POLICY not_campana_select_miembros ON comun_notificacion.not_campana
  FOR SELECT USING (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), cmp_negocio)
  );

CREATE POLICY not_campana_insert_admin ON comun_notificacion.not_campana
  FOR INSERT WITH CHECK (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), cmp_negocio)
  );

--------------------------------------------------------------------------------
-- 2. TABLA: comun_notificacion.not_registro (not_)
-- Log individual de despachos in-app/push/email por usuario
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_notificacion.not_registro (
  not_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  not_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  not_campana_id UUID REFERENCES comun_notificacion.not_campana(cmp_id) ON DELETE SET NULL,
  not_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(seg_id) ON DELETE CASCADE,
  not_negocio VARCHAR(10) NOT NULL,
  not_canal VARCHAR(20) NOT NULL CHECK (not_canal IN ('IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP_PROPUESTA')),
  not_titulo TEXT NOT NULL,
  not_contenido_html TEXT NOT NULL,
  not_url_accion TEXT,
  not_leido_en TIMESTAMPTZ,
  not_detalles JSONB DEFAULT '{}'::jsonb,
  not_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para lectura eficiente de notificaciones in-app
CREATE INDEX IF NOT EXISTS idx_not_registro_usuario_negocio 
  ON comun_notificacion.not_registro(not_usuario_id, not_negocio, not_leido_en);

-- Permisos RLS en not_registro
ALTER TABLE comun_notificacion.not_registro ENABLE ROW LEVEL SECURITY;

CREATE POLICY not_registro_select_propio ON comun_notificacion.not_registro
  FOR SELECT USING (
    not_usuario_id = auth.uid()
  );

CREATE POLICY not_registro_update_propio ON comun_notificacion.not_registro
  FOR UPDATE USING (
    not_usuario_id = auth.uid()
  );

CREATE POLICY not_registro_insert_admin ON comun_notificacion.not_registro
  FOR INSERT WITH CHECK (
    comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), not_negocio)
  );

--------------------------------------------------------------------------------
-- 3. TABLA: comun_seguridad.seg_dispositivo_push (dsp_)
-- Tokens de suscripción Push por dispositivo (Web Push VAPID / FCM)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_seguridad.seg_dispositivo_push (
  dsp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsp_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  dsp_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(seg_id) ON DELETE CASCADE,
  dsp_token_push TEXT NOT NULL,
  dsp_plataforma VARCHAR(20) NOT NULL CHECK (dsp_plataforma IN ('WEB', 'ANDROID', 'IOS')),
  dsp_activo BOOLEAN NOT NULL DEFAULT TRUE,
  dsp_detalles JSONB DEFAULT '{}'::jsonb,
  dsp_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dsp_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dsp_usuario_id, dsp_token_push)
);

ALTER TABLE comun_seguridad.seg_dispositivo_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY seg_dispositivo_push_propio ON comun_seguridad.seg_dispositivo_push
  FOR ALL USING (dsp_usuario_id = auth.uid());

--------------------------------------------------------------------------------
-- 4. TABLA: comun_seguridad.seg_preferencia_notificacion (pfn_)
-- Preferencias de canal y Silenciado por Tiempo (Mute Temporal) por usuario
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comun_seguridad.seg_preferencia_notificacion (
  pfn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pfn_secuencial BIGINT GENERATED ALWAYS AS IDENTITY,
  pfn_usuario_id UUID NOT NULL REFERENCES comun_seguridad.seg_usuario(seg_id) ON DELETE CASCADE,
  pfn_negocio VARCHAR(10) NOT NULL,
  pfn_canal_email BOOLEAN NOT NULL DEFAULT TRUE,
  pfn_canal_push BOOLEAN NOT NULL DEFAULT TRUE,
  pfn_canal_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  pfn_silenciado_hasta TIMESTAMPTZ,
  pfn_detalles JSONB DEFAULT '{}'::jsonb,
  pfn_creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pfn_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pfn_usuario_id, pfn_negocio)
);

ALTER TABLE comun_seguridad.seg_preferencia_notificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY seg_preferencia_notificacion_propia ON comun_seguridad.seg_preferencia_notificacion
  FOR ALL USING (pfn_usuario_id = auth.uid());

--------------------------------------------------------------------------------
-- 5. RPC FUNCTIONS: Marcar leídas, contar no leídas y despachar campañas
--------------------------------------------------------------------------------

-- Función para contar no leídas
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_contar_no_leidas(
  p_negocio VARCHAR
) RETURNS INT AS $$
DECLARE
  v_conteo INT;
BEGIN
  SELECT COUNT(*) INTO v_conteo
  FROM comun_notificacion.not_registro
  WHERE not_usuario_id = auth.uid()
    AND not_negocio = p_negocio
    AND not_leido_en IS NULL;
    
  RETURN v_conteo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_marcar_leida(
  p_not_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE comun_notificacion.not_registro
  SET not_leido_en = NOW()
  WHERE not_id = p_not_id
    AND not_usuario_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar todas las notificaciones como leídas
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_marcar_todas_leidas(
  p_negocio VARCHAR
) RETURNS VOID AS $$
BEGIN
  UPDATE comun_notificacion.not_registro
  SET not_leido_en = NOW()
  WHERE not_usuario_id = auth.uid()
    AND not_negocio = p_negocio
    AND not_leido_en IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para emitir campaña masiva desde el widget emision_notificaciones
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_emitir_campana(
  p_negocio VARCHAR,
  p_tipo_audiencia VARCHAR,
  p_roles_jsonb JSONB,
  p_usuarios_jsonb JSONB,
  p_canales_jsonb JSONB,
  p_asunto TEXT,
  p_cuerpo_html TEXT,
  p_cuerpo_markdown TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_campana_id UUID;
  v_emisor_id UUID;
  v_target_usuario_id UUID;
  v_canal JSONB;
  v_enviados_count INT := 0;
BEGIN
  v_emisor_id := auth.uid();

  IF NOT comun_seguridad.seg_fn_es_miembro_negocio(v_emisor_id, p_negocio) THEN
    RAISE EXCEPTION 'Acceso denegado: El emisor no es miembro activo del negocio %', p_negocio;
  END IF;

  INSERT INTO comun_notificacion.not_campana (
    cmp_negocio, cmp_emisor_id, cmp_tipo_audiencia, cmp_roles_jsonb,
    cmp_usuarios_jsonb, cmp_canales_jsonb, cmp_asunto, cmp_cuerpo_html, cmp_cuerpo_markdown
  ) VALUES (
    p_negocio, v_emisor_id, p_tipo_audiencia, p_roles_jsonb,
    p_usuarios_jsonb, p_canales_jsonb, p_asunto, p_cuerpo_html, p_cuerpo_markdown
  ) RETURNING cmp_id INTO v_campana_id;

  -- Insertar notificaciones in-app para la audiencia seleccionada
  FOR v_target_usuario_id IN
    SELECT DISTINCT m.mem_usuario_id
    FROM comun_seguridad.seg_membresia m
    WHERE m.mem_negocio = p_negocio
      AND m.mem_estado = 'ACTIVO'
      AND (
        p_tipo_audiencia = 'TODOS'
        OR (p_tipo_audiencia = 'POR_ROL' AND m.mem_perfil = ANY(ARRAY(SELECT jsonb_array_elements_text(p_roles_jsonb))))
        OR (p_tipo_audiencia = 'POR_USUARIOS' AND m.mem_usuario_id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(p_usuarios_jsonb))))
      )
  LOOP
    -- Verificar si el usuario tiene Mute Temporal (Silenciado activo)
    IF NOT EXISTS (
      SELECT 1 FROM comun_seguridad.seg_preferencia_notificacion
      WHERE pfn_usuario_id = v_target_usuario_id
        AND pfn_negocio = p_negocio
        AND pfn_silenciado_hasta > NOW()
    ) THEN
      INSERT INTO comun_notificacion.not_registro (
        not_campana_id, not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html
      ) VALUES (
        v_campana_id, v_target_usuario_id, p_negocio, 'IN_APP', p_asunto, p_cuerpo_html
      );
      v_enviados_count := v_enviados_count + 1;
    END IF;
  END LOOP;

  -- Actualizar métricas de la campaña
  UPDATE comun_notificacion.not_campana
  SET cmp_metricas_jsonb = jsonb_build_object(
    'total_enviados', v_enviados_count,
    'total_leidos', 0,
    'total_fallidos', 0
  )
  WHERE cmp_id = v_campana_id;

  RETURN v_campana_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- 6. DISPARO AUTOMÁTICO AL ASIGNAR ROL (PLT-003 regla 8)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_disparar_notificacion_cambio_rol()
RETURNS TRIGGER AS $$
DECLARE
  v_titulo TEXT;
  v_cuerpo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_titulo := 'Nuevo perfil asignado en ' || NEW.mem_negocio;
    v_cuerpo := '<p>Hola. Se te ha asignado el perfil <strong>' || NEW.mem_perfil || '</strong> en el negocio <strong>' || NEW.mem_negocio || '</strong>.</p>';
    
    INSERT INTO comun_notificacion.not_registro (
      not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html
    ) VALUES (
      NEW.mem_usuario_id, NEW.mem_negocio, 'IN_APP', v_titulo, v_cuerpo
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_not_cambio_rol ON comun_seguridad.seg_membresia;

CREATE TRIGGER trg_not_cambio_rol
  AFTER INSERT ON comun_seguridad.seg_membresia
  FOR EACH ROW
  EXECUTE FUNCTION comun_notificacion.not_fn_disparar_notificacion_cambio_rol();

--------------------------------------------------------------------------------
-- 7. AUDITORÍA VÍA TRIGGERS (aud_fn_auditar_tabla)
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aud_fn_auditar_tabla') THEN
    CREATE TRIGGER trg_aud_not_campana
      AFTER INSERT OR UPDATE OR DELETE ON comun_notificacion.not_campana
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();

    CREATE TRIGGER trg_aud_not_registro
      AFTER INSERT OR UPDATE OR DELETE ON comun_notificacion.not_registro
      FOR EACH ROW EXECUTE FUNCTION comun_auditoria.aud_fn_auditar_tabla();
  END IF;
END $$;

-- Concesión de permisos generales a roles autenticados
GRANT ALL ON ALL TABLES IN SCHEMA comun_notificacion TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA comun_notificacion TO authenticated, service_role;
