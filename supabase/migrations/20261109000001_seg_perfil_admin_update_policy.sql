-- Migración: 20261109000001_seg_perfil_admin_update_policy.sql
-- Descripción:
-- Otorga permiso de actualización acotado por columna (Regla 13 de AGENTS.md) sobre
-- comun_seguridad.seg_perfil (per_detalle_perfil, per_actualizado_en) a usuarios autenticados
-- con rol ADMINISTRADOR (nivel >= 80) o SUPERADMIN, complementando la persistencia primaria
-- en comun_configuracion.cfg_negocio.cfg_detalle_configuracion.perfiles_navegacion.

GRANT UPDATE (per_detalle_perfil, per_actualizado_en) ON comun_seguridad.seg_perfil TO authenticated;

DROP POLICY IF EXISTS seg_perfil_admin_escritura ON comun_seguridad.seg_perfil;

CREATE POLICY seg_perfil_admin_escritura ON comun_seguridad.seg_perfil
  FOR UPDATE TO authenticated
  USING (
    comun_seguridad.seg_fn_es_superadmin()
    OR comun_seguridad.seg_fn_nivel_maximo('TRANQ') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('FFH') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('TNK') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('MRG') >= 80
  )
  WITH CHECK (
    comun_seguridad.seg_fn_es_superadmin()
    OR comun_seguridad.seg_fn_nivel_maximo('TRANQ') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('FFH') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('TNK') >= 80
    OR comun_seguridad.seg_fn_nivel_maximo('MRG') >= 80
  );
