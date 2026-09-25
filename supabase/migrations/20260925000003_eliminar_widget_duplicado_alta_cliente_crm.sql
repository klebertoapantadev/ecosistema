-- Migración: 20260925000003_eliminar_widget_duplicado_alta_cliente_crm.sql
-- Descripción: Elimina el widget huérfano / duplicado 'alta_cliente_crm' (ModalAltaClienteAsistida.tsx)
-- consolidando toda la administración y alta en el widget unificado 'crm_clientes' (BandejaClientesCRM.tsx).

-- 1. Eliminar asignaciones por rol del widget alta_cliente_crm si existen
DELETE FROM comun_seguridad.seg_rol_widget
WHERE rlw_widget_id IN (
  SELECT wdg_id FROM comun_seguridad.seg_widget WHERE wdg_clave = 'alta_cliente_crm'
);

-- 2. Eliminar el widget del catálogo maestro
DELETE FROM comun_seguridad.seg_widget
WHERE wdg_clave = 'alta_cliente_crm';
