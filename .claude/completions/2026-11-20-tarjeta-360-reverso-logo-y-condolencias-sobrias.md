# Cierre: Vista 360°, parte posterior clicable, logo interior sutil y diseño sobrio de Condolencias

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Parte posterior clicable y Vista 360° antes de abrir (`packages/comercio/src/componentes/TarjetaDedicatoriaDigitalInteractiva.tsx`):**
   - Rotación 3D en eje Y (`rotateY`) antes de abrir la tarjeta de Dedicatoria mediante arrastre táctil/mouse, botón **`Vista 360°`** (recorrido giratorio continuo de `5,6 s`) y botón **`Ver reverso` / `Ver portada`**.
   - Reverso real en cartulina kraft con logo de la marca, frase editorial y enlace clicable a la página principal (`/`, o nueva pestaña en vista embebida del editor).
   - **Logo pequeño y sutil siempre incluido en el pie interior** de las tarjetas de Dedicatoria (`TarjetaDedicatoriaDigitalInteractiva.tsx` y `LienzoDisenadorTarjeta.tsx`).

2. **Condolencias sobrias detectadas desde el pedido (`packages/comercio/src/acciones-operaciones-taller.ts`, `TarjetaDedicatoriaDigitalInteractiva.tsx`, `EditorTarjetaPublicoCliente.tsx`, `apps/*/app/dedicatoria/[token]/page.tsx`):**
   - Detección reforzada desde la clasificación, resumen de producto, ítems y ubicación del pedido (`esPedidoCondolenciasPorContexto` + `verificarCondolenciasDesdePedidoDb`).
   - Diseño solemne en marfil-piedra mate (`#F7F6F2`) con doble filete fino y detalle botánico lineal monocromático SVG (sin emojis, sin música, sin lyrics, sin QR, sin vista 360°).
   - En `/tarjeta-editar/[token]`, los pedidos de Condolencias muestran exclusivamente la tarjeta sobria y el editor directo de **únicamente el mensaje** (`Editar mensaje` → `Guardar mensaje`).
   - Metadatos públicos sobrios (`Tarjeta de Condolencias — Tinkay Flores y Eventos` / `Margaritas Floristería`).
