-- PLT-020: los widgets de agenda en el panel.
--
-- El rail no se escribe a mano: sale de seg_widget filtrado por seg_rol_widget
-- (ver obtenerWidgetsVisibles en @eco/identidad). Registrar las secciones aqui
-- es lo que las hace aparecer.
--
-- `citas_programadas` es un widget de PLATAFORMA, no de Tranqi: PLT-011 regla 8
-- lo fija en el Panel Profesional del rol SOCIO/PROFESIONAL, que agrupa
-- ABOGADO y TECNICO. Se siembra para los cuatro negocios aunque hoy solo
-- tranqi-web lo renderice -- asi FastFix no necesita otra migracion el dia que
-- formalice sus requerimientos, solo la pantalla.
--
-- `agendar_cita` y `mis_citas` son del CLIENTE y se siembran igual para los
-- cuatro: agendar es transversal a cualquier negocio que atienda con cita.
-- `asignaciones_agenda` es la mesa de contingencia y solo la ve el staff.

insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi',     'agendar_cita',        'Agendar cita'),
  ('fastfix',    'agendar_cita',        'Agendar visita'),
  ('tinkay',     'agendar_cita',        'Agendar cita'),
  ('margaritas', 'agendar_cita',        'Agendar cita'),

  ('tranqi',     'mis_citas',           'Mis citas'),
  ('fastfix',    'mis_citas',           'Mis visitas'),
  ('tinkay',     'mis_citas',           'Mis citas'),
  ('margaritas', 'mis_citas',           'Mis citas'),

  ('tranqi',     'citas_programadas',   'Citas programadas'),
  ('fastfix',    'citas_programadas',   'Visitas programadas'),
  ('tinkay',     'citas_programadas',   'Citas programadas'),
  ('margaritas', 'citas_programadas',   'Citas programadas'),

  ('tranqi',     'disponibilidad',      'Mi disponibilidad'),
  ('fastfix',    'disponibilidad',      'Mi disponibilidad'),
  ('tinkay',     'disponibilidad',      'Mi disponibilidad'),
  ('margaritas', 'disponibilidad',      'Mi disponibilidad'),

  ('tranqi',     'asignaciones_agenda', 'Asignaciones y contingencia'),
  ('fastfix',    'asignaciones_agenda', 'Asignaciones y contingencia'),
  ('tinkay',     'asignaciones_agenda', 'Asignaciones y contingencia'),
  ('margaritas', 'asignaciones_agenda', 'Asignaciones y contingencia')
on conflict (wdg_negocio, wdg_clave) do nothing;

-- Cliente: pedir cita y ver las suyas.
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select w.wdg_negocio, r.rol, w.wdg_id
from comun_seguridad.seg_widget w
cross join (values ('CLIENTE')) as r(rol)
where w.wdg_clave in ('agendar_cita', 'mis_citas')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;

-- Profesional: su agenda y sus horas operativas. ABOGADO en Tranqi, TECNICO en
-- FastFix; se conceden ambos en los cuatro negocios porque seg_rol_widget solo
-- concede visibilidad -- quien no tenga ese perfil no ve nada.
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select w.wdg_negocio, r.rol, w.wdg_id
from comun_seguridad.seg_widget w
cross join (values ('ABOGADO'), ('TECNICO')) as r(rol)
where w.wdg_clave in ('citas_programadas', 'disponibilidad')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;

-- Staff: la mesa de asignaciones y la cola de contingencia. Un cliente que se
-- queda sin abogado a la hora de su cita es un problema de operacion, y alguien
-- tiene que verlo.
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select w.wdg_negocio, r.rol, w.wdg_id
from comun_seguridad.seg_widget w
cross join (values ('OPERADOR'), ('ADMINISTRADOR')) as r(rol)
where w.wdg_clave in ('asignaciones_agenda', 'citas_programadas')
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;
