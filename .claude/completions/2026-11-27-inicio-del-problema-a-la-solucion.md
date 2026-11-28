# Cierre de Tarea — Inicio del cliente «del problema a la solución» (`TRQ-041`)

**Fecha:** 2026-11-27
**Alcance:** `apps/tranqi-web` (inicio del cliente y módulo `agenda`), `gobernanza/productos/tranqi`

## 1. Por qué

Comentario de negocio (Galo, 27-nov-2026): la pantalla donde el cliente cuenta su necesidad estaba
dentro de Agendamiento, a la que solo se llegaba con el botón «Agendar cita», y «es como lo
principal». Pidió «una sola pestaña, del problema a la solución». Se prototipó en
`TRANQUI/demo/cliente-del-problema.html` y el usuario lo aprobó.

## 2. Qué se implementó

1. **`FormularioAgendar` con `variante="recorrido"`** (por defecto sigue `"pasos"`, sin cambios para
   el widget `agendar_cita`):
   - Cuatro hitos siempre visibles (`CaminoRecorrido`): Tu problema → Tu especialista → Tu cita → En marcha.
   - Si ARIA reconoce la especialidad, pasa sola a la cita (sin «Continuar»); si pide aclaración, se queda.
   - Arriba queda «Nos contaste» + «Lo que entendimos» (respuesta de ARIA, especialidad y «¿No es tu
     tema?» para cambiarla, que recarga los horarios).
   - Al confirmar no redirige: muestra «Tu caso ya está en marcha» con los pasos siguientes, «Ver mis
     citas» y «Resolver otra cosa», y hace `router.refresh()` para actualizar las cifras del inicio.
2. **`app/panel/page.tsx`**: carga `obtenerDatosAgendarCitaWidgetAction()` en servidor y pinta el
   recorrido arriba del todo. Sin datos de agenda, vuelve el botón «Agendar cita». Salen el estado
   vacío «Aún no tienes casos abiertos» y el acceso rápido «Agendar cita» (duplicaban la tarjeta).
3. **`globals.css`**: clases `.recorrido-resolver`, `.camino-recorrido`, `.recorrido-en-marcha`,
   `.en-marcha-*`, con variables de tema (claro/oscuro) y reducción a números en móvil.
4. **Gobernanza**: `especificacion-funcional.md` de tranqi (inicio del cliente y agendamiento) y
   README del módulo `agenda`.

## 3. Verificación

- `tsc --noEmit`, `eslint` de los ficheros tocados, `vitest` (29/29) y `next build`: OK.
- Navegador (página temporal sin sesión, no incluida): recorrido en claro, oscuro y móvil 375 px sin
  desbordes; triaje real de ARIA → paso a la cita; error de reserva dentro de la tarjeta.
- **No verificado en local:** la vista «en marcha» tras una reserva real (necesita sesión de cliente).

## 4. Pendiente

- La navegación lateral del cliente sigue con `Agendamiento` (lo configura `seg_widget`/`seg_rol_widget`);
  decidir si se queda solo para «Mis citas».
