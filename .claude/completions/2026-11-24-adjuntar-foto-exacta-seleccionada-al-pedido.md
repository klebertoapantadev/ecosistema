# Cierre de Tarea — Adjuntar al Pedido Exactamente la Foto Seleccionada en Visualización

**Fecha:** 2026-11-24  
**Requerimientos:** `TNK-002` / `PLT-009`  
**Rama:** `master`

## Qué se implementó

1. **Modelo de Personalización Floral (`packages/comercio/src/utils/personalizacionFloral.ts`):**
   - Se añadieron `fotoReferenciaUrl`, `fotoReferenciaIndice` y `fotoReferenciaTotal` a `SeleccionPersonalizacionFloral`.
   - Cuando el cliente elige **"Mismos colores de la foto"** sobre un producto con múltiples fotos, el resumen registra automáticamente `Mismos colores de la foto (Foto X de N)` junto con la URL exacta de la imagen visualizada.

2. **Captura y Confirmación Visual en el Wizard de Compra (`ModalDetalleProducto.tsx`, `contexto-carrito.tsx`, `DrawerCarritoFloristeria.tsx`, `ModalCheckoutTinkay.tsx`):**
   - Al elegir **"Mismos colores de la foto"**, la tarjeta verde muestra la **miniatura exacta de la foto seleccionada** (`Foto X de N`) y permite cambiarla en 1 clic sin salir de la sección.
   - Al pulsar *Comprar ahora* o *Agregar al carrito*, la URL exacta de la foto visualizada (`fotoActivaUrl`) queda en primera posición del ítem y guardada en `personalizacionFloral.fotoReferenciaUrl`.
   - El carrito distingue líneas del mismo producto si tienen distinta foto de referencia (evitando fusionar Foto 1 y Foto 2).
   - El checkout envía `imagen` + `personalizacionFloral.fotoReferenciaUrl` en cada ítem al servidor (`registrarPedidoTiendaAction`).

3. **Persistencia y Visualización en Pedidos, Taller y Mi Espacio (`acciones-logistica.ts`, `operaciones-taller.ts`, `acciones-operaciones-taller.ts`, `BandejaPedidosTienda.tsx`, `ConsolaTallerFloral.tsx`, `EspacioClienteEcommerceTinkay.tsx`):**
   - `registrarPedidoTiendaAction` persiste `imagen` y `foto_referencia_url` en cada ítem de `com_proforma.prf_detalle_proforma.items` (que además se sincroniza automáticamente a `com_orden_taller.ota_items` sin migración SQL adicional).
   - **Bandeja de Pedidos de Tienda** y **Consola de Taller Floral** muestran la miniatura clicable en tamaño completo de la foto exacta seleccionada por el cliente (con borde destacado e indicador visual cuando es *Mismos colores de la foto*).
   - **Mi Espacio (Cliente)** muestra la foto exacta elegida en carrito, listado de pedidos y detalle de pedido.

## Verificación ejecutada

- `pnpm --filter @eco/comercio test` — **19 archivos, 117 pruebas aprobadas** (incluyendo cobertura nueva para `fotoReferenciaUrl` / `Foto 2 de 3` en `personalizacionFloral.test.ts`).
- `typecheck` aprobado sin errores en `@eco/comercio` y `tinkay-web`.
- `pnpm --filter tinkay-web build` — compilación de producción exitosa.
