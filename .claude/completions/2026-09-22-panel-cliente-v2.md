# 2026-09-22 — Panel del cliente v2 (TRQ-013)

**Rama:** `TRQ-013-panel-cliente-v2` · **Requerimiento:** `TRQ-CLI-001` (30 % → 40 %)

## Qué se hizo

- **Rail plegable (1A)** para todos los perfiles, a 72 px de solo iconos:
  - estado en la cookie `tranqi_rail_plegado`;
  - tooltips propios con el rail plegado;
  - indicador de la opción activa que se desliza.

  Rail del cliente a `#1E0046`. La etiqueta amarilla «Rol Activo» queda solo para el
  superadmin.
- **Inicio centrado** con tope de 1680 px (`.contenedor-panel`). Así lo pedía ya
  `sistema-visual.md` §10.
- **Menú de cuenta (5A)**: Mi cuenta, Seguridad, «Ver como» (solo quien puede conmutar) y
  Cerrar sesión.
- **Avisos flotantes (9A)**: `app/panel/AvisosPanel.tsx`, con `ProveedorAvisos` en el layout
  y el hook `useAvisos()`.
- **Inicio del cliente con datos reales**: módulo nuevo `modulos/inicio-cliente/`
  (consultas, cifras, caso, planes, billetera vacía).
- **Asistente de agendar por pasos (10C + 8B)** en `modulos/agenda/componentes/FormularioAgendar.tsx`.
  Misma lógica de reserva que antes.
- **Gobernanza** actualizada:
  - `sistema-visual.md` (§4 rail, §9 maquetas, §10 tope);
  - `especificacion-funcional.md` (TRQ-CLI-001);
  - nueva `maquetas/maqueta-cliente-v2.html`.

## Verificación

- `pnpm --filter tranqi-web typecheck`: limpio.
- `eslint` sobre los ficheros tocados: 0 errores, 1 aviso que ya existía (`<img>` del logo).
  El `lint` de todo el paquete falla por 382 problemas que ya estaban en master
  (`modulos/socios/*`, etc.) y que no son de esta rama.
- No se probó en navegador con sesión real: el panel exige autenticación.

## Pendiente

- Solicitud de patrocinio (resto de TRQ-CLI-001).
- Si se quieren «Pagos» y «Mensajes» en el caso, o la preferencia de canal de contacto, hace
  falta primero su modelo de datos.
