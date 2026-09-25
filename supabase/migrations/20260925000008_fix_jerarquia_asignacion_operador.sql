-- Migración: 20260925000008_fix_jerarquia_asignacion_operador.sql
-- Descripción: Permite la asignación y revocación jerárquica de perfiles desde nivel 30 (Operador) hacia abajo (Operador, Auxiliar, Cliente).
-- Los perfiles superiores a la jerarquía del gestor (ej. Administrador 80, Abogado/Técnico 50 frente a Operador 30) quedan estrictamente protegidos.

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

  -- 2. Validar nivel del gestor que ejecuta la acción (Mínimo nivel 30 - Operador)
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  IF v_nivel_gestor < 30 THEN
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
  -- 1. Validar jerarquía del gestor (Mínimo nivel 30 - Operador)
  v_nivel_gestor := comun_seguridad.seg_fn_nivel_maximo(p_negocio);
  IF v_nivel_gestor < 30 THEN
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
    RAISE EXCEPTION 'No puedes quitar un perfil de jerarquía superior a la tuya (% > %)', v_nivel_perfil, v_nivel_gestor;
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
