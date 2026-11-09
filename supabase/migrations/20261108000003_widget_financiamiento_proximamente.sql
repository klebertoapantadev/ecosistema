-- ==============================================================================
-- Migración: 20261108000003_widget_financiamiento_proximamente.sql
-- Implementa:
--   Registro y pre-configuración del widget de Financiamiento (en construcción /
--   próximamente disponible) en comun_seguridad.seg_widget y seg_rol_widget
--   conforme a la Regla 15 de AGENTS.md.
-- ==============================================================================

insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
values
  ('tranqi',     'financiamiento', 'Financiamiento & Cuotas para tu Caso', true, '{"descripcion": "Widget informativo de planes de financiamiento y cuotas para casos legales (Próximamente disponible)", "categoria": "Comercio & Clientes", "ruta": "/panel/clientes?widget=financiamiento", "panel_defecto": "panel_clientes", "icono": "CreditCard"}'::jsonb),
  ('fastfix',    'financiamiento', 'Financiamiento & Cuotas', true, '{"descripcion": "Widget informativo de planes de financiamiento y cuotas (Próximamente disponible)", "categoria": "Comercio & Clientes", "ruta": "/panel/clientes?widget=financiamiento", "panel_defecto": "panel_clientes", "icono": "CreditCard"}'::jsonb),
  ('tinkay',     'financiamiento', 'Financiamiento & Cuotas', true, '{"descripcion": "Widget informativo de planes de financiamiento y cuotas (Próximamente disponible)", "categoria": "Comercio & Clientes", "ruta": "/panel/clientes?widget=financiamiento", "panel_defecto": "panel_clientes", "icono": "CreditCard"}'::jsonb),
  ('margaritas', 'financiamiento', 'Financiamiento & Cuotas', true, '{"descripcion": "Widget informativo de planes de financiamiento y cuotas (Próximamente disponible)", "categoria": "Comercio & Clientes", "ruta": "/panel/clientes?widget=financiamiento", "panel_defecto": "panel_clientes", "icono": "CreditCard"}'::jsonb)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
select w.wdg_negocio, r.rol, w.wdg_id, true
from comun_seguridad.seg_widget w
cross join (values ('CLIENTE'), ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave = 'financiamiento'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

