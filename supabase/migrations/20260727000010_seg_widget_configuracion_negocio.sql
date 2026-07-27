-- Bug de alcance (PLT-003, PLT-011): "Configuracion del negocio" vivia como
-- link fijo en el layout del panel, visible a CUALQUIER usuario autenticado
-- -- incluido un CLIENTE recien registrado (rol por defecto, PLT-003 regla
-- 1), que nunca deberia ver esa opcion aunque RLS ya bloquee la escritura
-- (cfg_negocio_admin_escritura exige seg_fn_es_admin_negocio). Un CLIENTE
-- por defecto solo debe poder gestionar su propia cuenta.
--
-- Se registra como widget normal, igual que gestion_usuarios, para que el
-- sistema de permisos de PLT-011 sea la unica fuente de verdad de que ve
-- cada rol -- no un link hardcodeado fuera de ese sistema.
insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi', 'configuracion_negocio', 'Configuración del negocio'),
  ('fastfix', 'configuracion_negocio', 'Configuración del negocio'),
  ('tinkay', 'configuracion_negocio', 'Configuración del negocio'),
  ('margaritas', 'configuracion_negocio', 'Configuración del negocio')
on conflict (wdg_negocio, wdg_clave) do nothing;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select wdg_negocio, 'ADMINISTRADOR', wdg_id
from comun_seguridad.seg_widget
where wdg_clave = 'configuracion_negocio'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;
