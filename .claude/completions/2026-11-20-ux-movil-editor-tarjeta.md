# UX Móvil — Editor de Tarjeta de Dedicatoria / Condolencias

- **Fecha:** 2026-11-20
- **Archivos modificados:**
  - `packages/comercio/src/componentes/LienzoDisenadorTarjeta.tsx`
  - `packages/comercio/src/componentes/ModalImprimirTarjetaTaller.tsx`

## Cambios aplicados

1. **Reorganización móvil sin recortes horizontales (`<= 767px`):**
   - Modal a pantalla completa (`100dvh`, `padding: 0`) con cabecera compacta de 1 sola línea (código de pedido + indicador de modo + botón de alerta colapsable por ícono + cierre `X`).
   - Navegación móvil de 3 pestañas solo íconos (`Diseño`, `Texto`, `Ajustes`) para separar tareas y mostrar el lienzo de la tarjeta de inmediato sin desplazar pantallas largas.
   - En `LienzoDisenadorTarjeta`, orden invertido en móvil (`column-reverse`) para ubicar el **lienzo en vivo arriba** y la barra de edición en la **zona del pulgar** abajo.
   - Corregido el desborde horizontal (`minmax(350px, 1fr)` → `minmax(min(340px, 100%), 1fr)` en escritorio; flex/grid con `min-width: 0` y tira horizontal desplazable de tipografías y capas en móvil).
2. **Botones solo ícono en móvil y eliminación de textos verbosos:**
   - Ocultos en móvil el subtítulo explicativo, la pastilla de medidas, los textos de ayuda del lienzo y las etiquetas de botones en barra superior, controles de imagen/texto, enlaces y pie de acciones.
   - Pie de acciones móvil unificado en **1 sola fila de 4 botones solo ícono** (`Guardar`, `Compartir`, `PDF`, `Imprimir`, área táctil `>= 44px`, `title` y `aria-label` completos).
3. **Correcciones de UX y calidad:**
   - Corregido el bug `(Invalid Date)` en el aviso de modificación del cliente y en el historial mediante `formatearFechaSegura()`.
   - Inputs de texto en móvil a `16px` para evitar zoom automático en iOS Safari.
   - Banner global de feedback (`errorMsg` / `avisoOk`) visible sobre el pie desde cualquier pestaña.
   - Cierre con tecla `Escape`, `role="dialog"`, `aria-modal="true"`, y armonización completa de la paleta cálida-editorial (eliminando azules/morados fríos de `LienzoDisenadorTarjeta`).

## Verificación
- `pnpm --filter @eco/comercio typecheck` ✅
- `pnpm --filter tinkay-web typecheck` ✅
- `pnpm --filter margaritas-web typecheck` ✅
- `pnpm --filter @eco/comercio test` ✅ (16 archivos / 95 tests)
