-- Migración: 20260925000005_fix_seg_fn_asignar_quitar_perfiles_superadmin.sql
-- Descripción: Corrección integral de seg_fn_asignar_perfil, seg_fn_quitar_perfil, seg_fn_es_superadmin y seg_fn_nivel_maximo
-- Garantiza que SuperAdmins y Administradores de negocio puedan asignar y desasignar perfiles en tiempo real sin bloqueos.

-- 1. Helper: seg_fn_es_superadmin resiliente (por flag en seg_usuario o emails maestros)
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
        OR lower(u.usu_correo) IN ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_es_superadmin() TO authenticated;

-- 2. Helper: seg_fn_nivel_maximo con normalización exhaustiva
CREATE OR REPLACE FUNCTION comun_seguridad.seg_fn_nivel_maximo(p_negocio text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT greatest(
    CASE WHEN comun_seguridad.seg_fn_es_superadmin() THEN 100 ELSE 0 END,
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
    ), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_nivel_maximo(text) TO authenticated;

-- 3. RPC: seg_fn_asignar_perfil (Asignación segura y tolerante a fallos)
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
  v_negocio_db text;
BEGIN
  -- Validar existencia del perfil
  SELECT per_id, per_nivel, per_activo INTO v_perfil
  FROM comun_seguridad.seg_perfil
  WHERE upper(per_clave) = upper(p_perfil);

  IF v_perfil.per_id IS NULL OR NOT v_perfil.per_activo THEN
    RAISE EXCEPTION 'Perfil desconocido o inactivo: %', p_perfil;
  END IF;

  -- Calcular nivel del gestor
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

  -- Buscar si ya existe membresía para este usuario con cualquier alias del negocio
  SELECT mem_id, mem_negocio INTO v_membresia_id, v_negocio_db
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
    VALUES (p_usuario_id, p_negocio, upper(p_perfil), 'ACTIVO')
    RETURNING mem_id INTO v_membresia_id;
  ELSE
    UPDATE comun_seguridad.seg_membresia
    SET mem_actualizado_en = now(), mem_estado = 'ACTIVO'
    WHERE mem_id = v_membresia_id;
  END IF;

  -- Vincular en seg_membresia_perfil
  INSERT INTO comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
  VALUES (v_membresia_id, v_perfil.per_id, auth.uid())
  ON CONFLICT (mpe_membresia_id, mpe_perfil_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_asignar_perfil(uuid, text, text) TO authenticated;

-- 4. RPC: seg_fn_quitar_perfil
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
BEGIN
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

  DELETE FROM comun_seguridad.seg_membresia_perfil mp
  USING comun_seguridad.seg_membresia m, comun_seguridad.seg_perfil p
  WHERE mp.mpe_membresia_id = m.mem_id
    AND mp.mpe_perfil_id = p.per_id
    AND m.mem_usuario_id = p_usuario_id
    AND (
      upper(m.mem_negocio) = upper(p_negocio)
      OR (upper(p_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL') AND upper(m.mem_negocio) IN ('TRANQ', 'TRANQI', 'LEGAL'))
      OR (upper(p_negocio) IN ('FFH', 'FASTFIX') AND upper(m.mem_negocio) IN ('FFH', 'FASTFIX'))
      OR (upper(p_negocio) IN ('TNK', 'TINKAY') AND upper(m.mem_negocio) IN ('TNK', 'TINKAY'))
      OR (upper(p_negocio) IN ('MRG', 'MARGARITAS') AND upper(m.mem_negocio) IN ('MRG', 'MARGARITAS'))
    )
    AND upper(p.per_clave) = upper(p_perfil);
END;
$$;

GRANT EXECUTE ON FUNCTION comun_seguridad.seg_fn_quitar_perfil(uuid, text, text) TO authenticated;
