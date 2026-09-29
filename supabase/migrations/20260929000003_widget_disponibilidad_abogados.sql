-- Migración: 20260929000003_widget_disponibilidad_abogados.sql
-- Descripción:
--   1. Registro del widget independiente 'disponibilidad_abogados' (y alias 'disponibilidad_operativa')
--   2. Pre-configuración de acceso por defecto para OPERADOR, ABOGADO, ADMINISTRADOR, SUPERADMIN
--   3. Asignación a los paneles 'panel_agendamiento', 'panel_herramientas' y 'panel_administrar'

-- ==============================================================================
-- 1. REGISTRAR WIDGET EN comun_seguridad.seg_widget
-- ==============================================================================

insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_descripcion,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'disponibilidad_abogados',
  'Disponibilidad de Abogados & Turnos',
  'Gestión de cupos, horas y turnos de especialistas. Modo postulación preliminar para abogados y aprobación por operadores.',
  true,
  jsonb_build_object(
    'descripcion', 'Gestión de cupos y disponibilidad de especialistas con flujo de aprobación preliminar',
    'categoria', 'Agendamiento & Operación',
    'ruta', '/panel/agendamiento?widget=disponibilidad_abogados',
    'panel_defecto', 'panel_agendamiento',
    'icono', 'Scale',
    'color', '#5000BA'
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update
set
  wdg_nombre = excluded.wdg_nombre,
  wdg_descripcion = excluded.wdg_descripcion,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget,
  wdg_actualizado_en = now();

-- Alias 'disponibilidad_operativa'
insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_descripcion,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'disponibilidad_operativa',
  'Disponibilidad Operativa & Especialistas',
  'Control de stock de horas y cuadrillas de atención técnica o profesional.',
  true,
  jsonb_build_object(
    'descripcion', 'Control de horas y stock de atención técnica y profesional',
    'categoria', 'Agendamiento & Operación',
    'ruta', '/panel/agendamiento?widget=disponibilidad_operativa',
    'panel_defecto', 'panel_agendamiento',
    'icono', 'Scale',
    'color', '#5000BA'
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update
set
  wdg_nombre = excluded.wdg_nombre,
  wdg_descripcion = excluded.wdg_descripcion,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget,
  wdg_actualizado_en = now();

-- ==============================================================================
-- 2. PRE-CONFIGURAR ACCESO EN comun_seguridad.seg_rol_widget
-- ==============================================================================

insert into comun_seguridad.seg_rol_widget (
  rlw_negocio,
  rlw_rol,
  rlw_widget_id,
  rlw_visible
)
select
  w.wdg_negocio,
  r.rol,
  w.wdg_id,
  true
from comun_seguridad.seg_widget w
cross join (
  values
    ('OPERADOR'),
    ('ABOGADO'),
    ('TECNICO'),
    ('ADMINISTRADOR'),
    ('SUPERADMIN')
) as r(rol)
where w.wdg_clave in ('disponibilidad_abogados', 'disponibilidad_operativa')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update
set
  rlw_visible = true,
  rlw_actualizado_en = now();
