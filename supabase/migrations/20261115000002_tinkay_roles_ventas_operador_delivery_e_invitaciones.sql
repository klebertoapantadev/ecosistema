-- =============================================================================
-- Migración: 20261115000002_tinkay_roles_ventas_operador_delivery_e_invitaciones.sql
-- Descripción:
--   1. Sembrar los perfiles canónicos DELIVERY (nivel 15) y VENTAS (nivel 20)
--      en comun_seguridad.seg_perfil para Tinkay Floristería y comercios.
--   2. Asegurar que cualquier usuario registrado en Tinkay que no sea el
--      propietario principal (tinkay.uio@gmail.com / kleber.toapanta.ch@gmail.com)
--      inicie con el rol CLIENTE en Tinkay a menos que haya recibido una
--      invitación o asignación explícita de equipo.
-- =============================================================================

INSERT INTO comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_activo, per_asignable)
VALUES
  ('DELIVERY', 'Delivery / Repartidor', 15, true, true),
  ('VENTAS', 'Ventas / Asesor Comercial', 20, true, true)
ON CONFLICT (per_clave) DO UPDATE
SET
  per_nombre = EXCLUDED.per_nombre,
  per_nivel = EXCLUDED.per_nivel,
  per_activo = true,
  per_asignable = true;

-- Normalizar en Tinkay cualquier membresía heredada como SUPERADMIN de cuentas clientes
UPDATE comun_seguridad.seg_membresia m
SET
  mem_rol = 'CLIENTE',
  mem_actualizado_en = now()
FROM comun_seguridad.seg_usuario u
WHERE m.mem_usuario_id = u.usu_id
  AND lower(m.mem_negocio) IN ('tinkay', 'tnk')
  AND lower(u.usu_correo) NOT IN ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com')
  AND COALESCE((u.usu_detalle_usuario->>'roles_explicitos_tinkay')::boolean, false) = false
  AND upper(m.mem_rol) IN ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN');
