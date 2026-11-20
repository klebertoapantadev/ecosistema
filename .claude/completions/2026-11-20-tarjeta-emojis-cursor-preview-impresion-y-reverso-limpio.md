# Cierre: Emojis en posición del cursor, visualizador de impresión interior, interior sin logo y reverso minimalista

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Emojis insertados exactamente donde está el cursor (`EditorTarjetaPublicoCliente.tsx`):**
   - Seguimiento continuo de `selectionStart`/`selectionEnd` en el `<textarea>` del mensaje (`textareaMensajeRef` + `cursorMensajeRef` + `onMouseDown={(e) => e.preventDefault()}` en botones de emoji) para insertar cada emoji en el punto exacto del cursor y mantener el cursor inmediatamente después.

2. **Visualizador en vivo de impresión interior en Paso 8 (`EditorTarjetaPublicoCliente.tsx`):**
   - Generación de `qrDataUrl` real para `/dedicatoria/[tokenVista]` y renderizado en vivo de `<LienzoDisenadorTarjeta soloLectura={true} ... />` justo debajo de las 3 opciones de impresión (`Solo mensaje impreso`, `Solo QR (Digital)` y `Mensaje + QR digital`), actualizándose al instante al cambiar de modalidad.

3. **Interior limpio sin logo (`TarjetaDedicatoriaDigitalInteractiva.tsx`, `LienzoDisenadorTarjeta.tsx`):**
   - Eliminado el logo/marca de agua del interior de la tarjeta para dejar todo el espacio libre al diseño del cliente.

4. **Parte posterior minimalista (`TarjetaDedicatoriaDigitalInteractiva.tsx`):**
   - Reverso kraft clicable simplificado únicamente con nuestro logo oficial y `www.tinkay.net` debajo (`www.margaritasfloristeria.com` en Margaritas).
