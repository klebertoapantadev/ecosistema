-- Migración: 20260925000007_fix_seg_fn_nivel_maximo_y_persistencia_perfiles.sql
-- Descripción: 
-- 1. Sincroniza todas las membresías existentes hacia seg_membresia_perfil asegurando que administradores, operadores y clientes tengan sus perfiles vinculados.
-- 2. Corrige seg_fn_nivel_maximo para que reconozca tanto seg_membresia_perfil como mem_rol en seg_membresia y usu_superadmin_plataforma.
-- 3. Robustecimiento de seg_fn_asignar_perfil y seg_fn_quitar_perfil con actualización sincronizada de mem_rol y seg_membresia_perfil.

-- ============================================================================
-- 1. Sincronizar perfiles históricos desde seg_membresia a seg_membresia_perfil
-- ============================================================================
-- Asegurar que todo perfil existente en el catálogo esté disponible
INSERT INTO comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_ambito, per_descripcion, per_activo, per_asignable)
VALUES 
  ('CLIENTE', 'Cliente', 10, 'GLOBAL', 'Acceso base al portal de clientes y autoservicio', true, true),
  ('OPERADOR', 'Operador', 30, 'NEGOCIO', 'Gestión operativa y atención de casos', true, true),
  ('AUXILIAR', 'Auxiliar', 30, 'NEGOCIO', 'Soporte y asistencia operativa', true, true),
  ('TECNICO', 'Técnico', 50, 'NEGOCIO', 'Especialista técnico de soporte', true, true),
  ('ABOGADO', 'Abogado', 50, 'NEGOCIO', 'Socio legal verificado y habilitado', true, true),
  ('ADMINISTRADOR', 'Administrador', 80, 'NEGOCIO', 'Gestión administrativa y asignación de roles', true, true),
  ('SUPERADMIN', 'SuperAdmin', 100, 'PLATAFORMA', 'Control total de plataforma multi-inquilino', true, false)
ON CONFLICT (per_clave) DO UPDATE 
SET per_nombre = EXCLUDED.per_nombre,
    per_nivel = EXCLUDED.per_nivel,
    per_activo = true,
    per_asignable = EXCLUDED.per_asignable;

-- Vincular perfil CLIENTE (nivel 10) a todas las membresías activas que no lo tengan
INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
SELECT m.mem_id, p.per_id
FROM comun_seguridad.seg_membresia m
CROSS JOIN comun_seguridad.seg_perfil p
WHERE p.per_clave = 'CLIENTE'
ON CONFLICT (mpe_membresia_id, mpe_perfil_id) DO NOTHING;

-- Vincular el rol específico declarado en mem_rol a seg_membresia_perfil
INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
SELECT m.mem_id, p.per_id
FROM comun_seguridad.seg_membresia m
JOIN comun_seguridad.seg_perfil p ON upper(p.per_clave) = upper(
  CASE 
    WHEN upper(m.mem_rol) IN ('ADMIN', 'ADMINISTRADOR') THEN 'ADMINISTRADOR'
    WHEN upper(m.mem_rol) IN ('OPERADOR', 'OPERADOR_REVISION', 'OPERADOR_DESPACHO') THEN 'OPERADOR'
    WHEN upper(m.mem_rol) = 'ABOGADO' THEN 'ABOGADO'
    WHEN upper(m.mem_rol) = 'TECNICO' THEN 'TECNICO'
    WHEN upper(m.mem_rol) = 'AUXILIAR' THEN 'AUXILIAR'
    WHEN upper(m.mem_rol) = 'SUPERADMIN' THEN 'SUPERADMIN'
    ELSE 'CLIENTE'
  END
)
ON CONFLICT (mpe_membresia_id, mpe_perfil_id) DO NOTHING;

-- ============================================================================
-- 2. Función seg_fn_nivel_maximo altamente tolerante y precisa
-- ============================================================================
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_nivel_maximo(p_negocio text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT greatest(
    -- 1. Superadmin global (100)
    CASE 
      WHEN comun_seguridad.seg_fn_es_superadmin() THEN 100 
      ELSE 0 
    END,
    -- 2. Máximo nivel por seg_membresia_perfil
    COALESCE((
      SELECT max(p.per_nivel)
      FROM comun_seguridad.seg_membresia m
      JOIN comun_seguridad.seg_membresia_perfil mp ON mp.mpe_membresia_id = m.mem_id
      JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
      WHERE m.mem_usuario_id = auth.uid()
        AND (
          upper(m.mem_negocio) = upper(p_negocio)
          OR (upper(p_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL') AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL'))
          OR (upper(p_negocio) IN ('FFH', 'FASTFIX') AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
          OR (upper(p_negocio) IN ('TNK', 'TINKAY') AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
          OR (upper(p_negocio) IN ('MRG', 'MARGARITAS') AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
        )
        AND m.mem_estado = 'ACTIVO'
        AND p.per_activo
    ), 0),
    -- 3. Máximo nivel directo por mem_rol en seg_membresia (para cuentas administradoras legadas o concurrentes)
    COALESCE((
      SELECT max(
        CASE 
          WHEN upper(m.mem_rol) IN ('SUPERADMIN') THEN 100
          WHEN upper(m.mem_rol) IN ('ADMIN', 'ADMINISTRADOR') THEN 80
          WHEN upper(m.mem_rol) IN ('ABOGADO', 'TECNICO') THEN 50
          WHEN upper(m.mem_rol) IN ('OPERADOR', 'AUXILIAR') THEN 30
          ELSE 10
        END
      )
      FROM comun_seguridad.seg_membresia m
      WHERE m.mem_usuario_id = auth.uid()
        AND (
          upper(m.mem_negocio) = upper(p_negocio)
          OR (upper(p_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL') AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL'))
          OR (upper(p_negocio) IN ('FFH', 'FASTFIX') AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
          OR (upper(p_negocio) IN ('TNK', 'TINKAY') AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
          OR (upper(p_negocio) IN ('MRG', 'MARGARITAS') AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
        )
        AND m.mem_estado = 'ACTIVO'
    ), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_nivel_maximo(text) TO authenticated, service_role;

-- ============================================================================
-- 3. Función seg_fn_asignar_perfil sincronizando rol principal y membresía_perfil
-- ============================================================================
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_asignar_perfil(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nivel_gestor integer;
  v_perfil record;
  v_membresia_id uuid;
  v_rol_maximo text;
BEGIN
  -- 1. Validar existencia del perfil solicitado
  SELECT per_id, per_nivel, per_activo, per_clave INTO v_perfil
  FROM comun_seguridad.seg_perfil
  WHERE upper(per_clave) = upper(p_perfil);

  IF v_perfil.per_id IS NULL OR NOT v_perfil.per_activo THEN
    RAISE EXCEPTION 'Perfil desconocido o inactivo: %', p_perfil;
  END IF;

  -- 2. Validar nivel del gestor que ejecuta la acción
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  IF v_nivel_gestor < 80 THEN
    IF comun_seguridad.seg_fn_es_superadmin() THEN
      v_nivel_gestor := 100;
    ELSE
      RAISE EXCEPTION 'No autorizado para asignar perfiles en este negocio (Nivel actual: %)', v_nivel_gestor;
    END IF;
  END IF;

  IF v_perfil.per_nivel > v_nivel_gestor THEN
    RAISE EXCEPTION 'No puedes asignar un perfil de jerarquía superior a la tuya (% > %)', v_perfil.per_nivel, v_nivel_gestor;
  END IF;

  -- 3. Buscar o crear la membresía correspondiente en el negocio
  SELECT mem_id INTO v_membresia_id
  FROM comun_seguridad.seg_membresia
  WHERE mem_usuario_id = p_usuario_id
    AND (
      upper(mem_negocio) = upper(p_negocio)
      OR (upper(p_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL') AND upper(mem_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL'))
      OR (upper(p_negocio) IN ('FFH', 'FASTFIX') AND upper(mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (upper(p_negocio) IN ('TNK', 'TINKAY') AND upper(mem_negocio) IN ('TNK', 'TINKAY'))
      OR (upper(p_negocio) IN ('MRG', 'MARGARITAS') AND upper(mem_negocio) IN ('MRG', 'MARGARITAS'))
    )
  LIMIT 1;

  IF v_membresia_id IS NULL THEN
    INSERT INTO comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    VALUES (p_usuario_id, upper(p_negocio), upper(p_perfil), 'ACTIVO')
    RETURNING mem_id INTO v_membresia_id;
  END IF;

  -- 4. Vincular el perfil en seg_membresia_perfil
  INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
  VALUES (v_membresia_id, v_perfil.per_id, auth.uid())
  ON CONFLICT (mpe_membresia_id, mpe_perfil_id) DO UPDATE
    SET mpe_asignado_por = auth.uid(), mpe_actualizado_en = now();

  -- 5. Actualizar mem_rol al perfil de mayor jerarquía asignado a este usuario
  SELECT p.per_clave INTO v_rol_maximo
  FROM comun_seguridad.seg_membresia_perfil mp
  JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
  WHERE mp.mpe_membresia_id = v_membresia_id
  ORDER BY p.per_nivel DESC
  LIMIT 1;

  UPDATE comun_seguridad.seg_membresia
  SET mem_rol = COALESCE(v_rol_maximo, upper(p_perfil)),
      mem_estado = 'ACTIVO',
      mem_actualizado_en = now()
  WHERE mem_id = v_membresia_id;

END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_asignar_perfil(uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 4. Función seg_fn_quitar_perfil con actualización segura
-- ============================================================================
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_quitar_perfil(
  p_usuario_id uuid,
  p_negocio text,
  p_perfil text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nivel_gestor integer;
  v_nivel_perfil integer;
  v_membresia_id uuid;
  v_rol_remanente text;
BEGIN
  -- 1. Validar jerarquía del gestor
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  IF v_nivel_gestor < 80 THEN
    IF comun_seguridad.seg_fn_es_superadmin() THEN
      v_nivel_gestor := 100;
    ELSE
      RAISE EXCEPTION 'No autorizado para quitar perfiles en este negocio (Nivel actual: %)', v_nivel_gestor;
    END IF;
  END IF;

  SELECT per_nivel INTO v_nivel_perfil FROM comun_seguridad.seg_perfil WHERE upper(per_clave) = upper(p_perfil);
  IF v_nivel_perfil IS NULL THEN
    RAISE EXCEPTION 'Perfil desconocido: %', p_perfil;
  END IF;

  IF v_nivel_perfil > v_nivel_gestor THEN
    RAISE EXCEPTION 'No puedes quitar un perfil de jerarquía superior a la tuya';
  END IF;

  IF upper(p_perfil) = 'CLIENTE' THEN
    RAISE EXCEPTION 'CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2)';
  END IF;

  -- 2. Localizar membresía
  SELECT mem_id INTO v_membresia_id
  FROM comun_seguridad.seg_membresia
  WHERE mem_usuario_id = p_usuario_id
    AND (
      upper(mem_negocio) = upper(p_negocio)
      OR (upper(p_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL') AND upper(mem_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL'))
      OR (upper(p_negocio) IN ('FFH', 'FASTFIX') AND upper(mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (upper(p_negocio) IN ('TNK', 'TINKAY') AND upper(mem_negocio) IN ('TNK', 'TINKAY'))
      OR (upper(p_negocio) IN ('MRG', 'MARGARITAS') AND upper(mem_negocio) IN ('MRG', 'MARGARITAS'))
    )
  LIMIT 1;

  IF v_membresia_id IS NOT NULL THEN
    -- Eliminar vinculación del perfil específico
    DELETE FROM comun_seguridad.seg_membresia_perfil mp
    USING comun_seguridad.seg_perfil p
    WHERE mp.mpe_membresia_id = v_membresia_id
      AND mp.mpe_perfil_id = p.per_id
      AND upper(p.per_clave) = upper(p_perfil);

    -- Determinar nuevo rol principal en seg_membresia
    SELECT p.per_clave INTO v_rol_remanente
    FROM comun_seguridad.seg_membresia_perfil mp
    JOIN comun_seguridad.seg_perfil p ON p.per_id = mp.mpe_perfil_id
    WHERE mp.mpe_membresia_id = v_membresia_id
    ORDER BY p.per_nivel DESC
    LIMIT 1;

    UPDATE comun_seguridad.seg_membresia
    SET mem_rol = COALESCE(v_rol_remanente, 'CLIENTE'),
        mem_actualizado_en = now()
    WHERE mem_id = v_membresia_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_quitar_perfil(uuid, text, text) TO authenticated, service_role;
