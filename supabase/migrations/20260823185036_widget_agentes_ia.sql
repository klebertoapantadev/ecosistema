-- TRQ-009: la consola de agentes como widget del panel.
--
-- El rail no se escribe a mano: sale de seg_widget filtrado por
-- seg_rol_widget (ver obtenerWidgetsVisibles en @eco/identidad). Registrar la
-- seccion aqui es lo que la hace aparecer.
--
-- Solo para 'tranqi'. Los otros tres negocios comparten la infraestructura de
-- ARIA (ADR-0002) pero todavia no tienen agentes ni pantalla que administrar;
-- darles una entrada de menu que lleva a una lista vacia seria prometer algo
-- que no existe. Cuando la tengan, se añade su fila.
--
-- Es una insercion de datos en comun_seguridad, no un cambio de su esquema:
-- no altera ninguna tabla ni afecta a los otros negocios.

insert into comun_seguridad.seg_widget (wdg_negocio, wdg_clave, wdg_nombre) values
  ('tranqi', 'agentes_ia', 'Agentes')
on conflict (wdg_negocio, wdg_clave) do nothing;

-- ADMINISTRADOR unicamente. Editar el prompt de un agente cambia lo que se le
-- responde a todos los afiliados; ademas la pantalla exige aal2 por encima de
-- este permiso (ver app/panel/agentes/layout.tsx y app/api/aria/[...ruta]).
insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id)
select wdg_negocio, 'ADMINISTRADOR', wdg_id
from comun_seguridad.seg_widget
where wdg_clave = 'agentes_ia' and wdg_negocio = 'tranqi'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do nothing;
