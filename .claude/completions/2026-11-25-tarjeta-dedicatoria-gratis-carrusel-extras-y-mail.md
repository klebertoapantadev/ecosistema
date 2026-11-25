# Cierre de Tarea — Tarjeta Dedicatoria/Condolencias Gratis en Carrusel de Extras + Opción Opcional/Más Tarde + Enlace en Correo de Compra

**Fecha:** 2026-11-25  
**Requerimientos:** `TNK-002`, `PLT-009`  
**Rama:** `master`

## Qué se implementó

1. **Sección 2 (Tarjeta de dedicatoria opcional):**
   - En `apps/tinkay-web/modulos/ecommerce/componentes/ModalDetalleProducto.tsx` se indica explícitamente que la tarjeta es **opcional en la compra** y puede **llenarse o actualizarse más tarde** desde el enlace del correo de confirmación, adaptando textos, placeholders e inspiración rápida automáticamente cuando el producto es de **Condolencias** vs. **Dedicatoria**, con acceso directo `Ver ejemplo`.

2. **Tarjeta de dedicatoria / condolencias como primer extra gratuito con previsualización interactiva:**
   - En la sección 3 de `ModalDetalleProducto.tsx`, para todos los arreglos florales retail se incluye siempre como **primer elemento** la tarjeta gratuita (`GRATIS · Incluida`), detectando automáticamente si corresponde a **Tarjeta de Condolencias** (`CONDOLENCIAS_PLANA`) o **Tarjeta Dedicatoria** (`DIPTICO`).
   - Al tocarla o pulsar **`Ver ejemplo`**, abre un modal de previsualización interactiva usando `TarjetaDedicatoriaDigitalInteractiva` embebido con ejemplo real (o el texto que el cliente ya escribió) y acciones **`Escribir ahora`** / **`Llenar más tarde`**.

3. **Sección 3 (Extras) en carrusel horizontal deslizable + opción `No, sin extras`:**
   - Se transformó la cuadrícula de extras en un **carrusel horizontal deslizable** (`.carrusel-extras-pista` con `scroll-snap-type: x mandatory` y flechas de navegación en `estilos-ecommerce.css`, cero Tailwind).
   - Se agregó el selector superior **`Ver extras` / `No, sin extras`**: al elegir **`No, sin extras`**, se cierran/ocultan todos los extras y se limpian los extras pagados seleccionados, mostrando una barra compacta que confirma que la tarjeta gratis sigue incluida y permite reabrir los extras en 1 clic.

4. **Enlace para llenar o actualizar la tarjeta en el correo de confirmación de compra y pantalla de éxito:**
   - `packages/notificaciones/src/notificar-usuario.ts`: `notificarClienteCompraConfirmada` acepta `urlEditarTarjeta` y `esTarjetaCondolencias`, renderizando un bloque destacado con botón **`✏️ Llenar o Actualizar Tarjeta`** y enlace directo `/tarjeta-editar/[tokenEdicion]`.
   - `packages/comercio/src/acciones-logistica.ts` (`registrarPedidoTiendaAction`, ruta RPC y respaldo) y `packages/comercio/src/acciones-plux.ts` (`confirmarPagoPluxAction`): generan el token HMAC firmado (`generarTokenEdicionTarjetaServidor`) y envían el enlace en todo correo de confirmación de compra floral (Transferencia y PLUX).
   - `apps/tinkay-web/modulos/ecommerce/componentes/ModalCheckoutTinkay.tsx`: muestra también el bloque con enlace directo **`✏️ Llenar o actualizar tarjeta`** en la pantalla de confirmación tras comprar.
