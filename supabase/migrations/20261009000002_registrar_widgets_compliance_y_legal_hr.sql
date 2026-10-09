-- ==============================================================================
-- Migración: 20261009000002_registrar_widgets_compliance_y_legal_hr.sql
-- Módulo: comun_seguridad
-- Requerimientos: TRQ-B2B-003, TRQ-B2B-004, TRQ-B2B-005
-- Propósito:
--   1. Registrar en comun_seguridad.seg_widget los nuevos widgets:
--      - 'compliance_score_legal': Compliance & Legal Health Score
--      - 'legal_hr_laboral': Legal HR: Contratos, Onboarding y Finiquitos
--   2. Pre-configurar en comun_seguridad.seg_rol_widget para los roles
--      OPERADOR, ADMINISTRADOR y SUPERADMIN (y CLIENTE para panel_empresas).
-- ==============================================================================

-- 1. Insertar o actualizar 'compliance_score_legal' en seg_widget para todos los negocios
insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'compliance_score_legal',
  'Compliance & Score Legal Empresarial',
  true,
  jsonb_build_object(
    'descripcion', 'Matriz de obligaciones normativas, monitoreo continuo de caducidades con ARIA y cálculo del Legal Health Score.',
    'categoria', 'operaciones',
    'ruta', '/panel/administrar?widget=compliance_score_legal',
    'panel_defecto', 'panel_administrar',
    'icono', 'ShieldCheck',
    'version', '1.0.0',
    'mfa_requerido', false
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

-- 2. Insertar o actualizar 'legal_hr_laboral' en seg_widget para todos los negocios
insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'legal_hr_laboral',
  'Legal HR: Contratos y Finiquitos',
  true,
  jsonb_build_object(
    'descripcion', 'Gestión laboral de colaboradores, contratos de trabajo tipificados, firma digital .p12, avisos IESS y actas de finiquito SUT.',
    'categoria', 'operaciones',
    'ruta', '/panel/administrar?widget=legal_hr_laboral',
    'panel_defecto', 'panel_administrar',
    'icono', 'Briefcase',
    'version', '1.0.0',
    'mfa_requerido', false
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

-- 3. Pre-configurar en seg_rol_widget para OPERADOR, ADMINISTRADOR y SUPERADMIN
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
cross join (values ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave in ('compliance_score_legal', 'legal_hr_laboral')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
  rlw_visible = true;
