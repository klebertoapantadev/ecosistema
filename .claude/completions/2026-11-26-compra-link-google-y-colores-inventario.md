# Cierre de tarea — Enlace Google Photos, colores desde inventario ("Bajo confirmación") y eliminación de colores surtidos

- **Fecha:** 2026-11-26
- **Requerimientos:** `TNK-001`, `TNK-002`, `TNK-005` (`PLT-009`)
- **Rama:** `master`

## Cambios realizados

1. **RPC pública de inventario de colores (`supabase/migrations/20261126000004_colores_inventario_tienda_publica.sql`):**
   - Creada y aplicada en Supabase (`oaybbpdxhlxjbpwnoymy`) la función `comun_comercio.com_fn_obtener_colores_inventario_tienda(p_negocio)` con permisos `anon, authenticated, service_role`.
   - Expone únicamente disponibilidad por color del último corte (`com_inventario_corte`, con respaldo en `com_inventario`), categorías activas (`com_variedad_rosa`) y etiquetas personalizadas (`cfg_negocio.categorias_colores_rosas`), sin filtrar cantidades internas, fotos ni nombres de operadores.
2. **Eliminación de "Surtido / Mix" y disponibilidad de inventario en `@eco/comercio` (`personalizacionFloral.ts`, `acciones-operaciones-taller.ts`, `personalizacionFloral.test.ts`):**
   - Eliminada la opción `multicolor` / `"Surtido / Mix"` de `COLORES_ROSAS_PERSONALIZACION`, normalización y validación.
   - Alineadas las claves de colores con el inventario (`novedad` y `tinturado`, manteniendo alias retrocompatible desde `azul`).
   - Añadida `obtenerColoresRosasConInventario()` (ordena disponibles en stock primero y colores "bajo confirmación" después) y soporte de `coloresBajoConfirmacion` / `requiereConfirmacionColor` en `SeleccionPersonalizacionFloral`.
3. **Enlace de Google Photos y experiencia de compra (`apps/tinkay-web` + `BandejaPedidosTienda.tsx`):**
   - Mapeado `albumFotosUrl` desde `pro_detalle_producto.album_fotos_url` y `var_detalle_variante.album_url` en `tipos.ts` y `servicio-catalogo.ts`.
   - Agregado `cargarColoresInventarioTinkay()` en SSR (`app/page.tsx`, `app/producto/[slug]/page.tsx`, `app/categoria/[slug]/page.tsx`) y sincronización en vivo en `contexto-carrito.tsx`.
   - En `ModalDetalleProducto.tsx`: enlace **"Ver más ejemplos en Google Photos"** bajo la galería y dentro de `1. Personaliza tu Arreglo` (y en previsualización de extras); selector de colores separado en **Disponibles en inventario hoy** y **Bajo confirmación (pedido con anticipación)**; advertencia destacada con botón **Verificar con tienda** (WhatsApp) cuando se elige un color fuera de inventario.
   - Propagación visual de la alerta **Bajo confirmación** en `DrawerCarritoFloristeria.tsx`, `ModalCheckoutTinkay.tsx` y `BandejaPedidosTienda.tsx`.
4. **Alerta de inventario desactualizado (>15h) y colores en oferta con descuento configurable (`20261126000005_alerta_inventario_15h_y_colores_oferta.sql`):**
   - RPC `com_fn_verificar_y_alertar_inventario_rosas` + job horario `pg_cron` (`alerta-inventario-rosas-15h`) + endpoint cron `/api/cron/alerta-inventario-rosas` en `apps/tinkay-web/vercel.json` + banner global `AlertaInventarioRosasBanner.tsx` en los paneles de `tinkay-web` y `margaritas-web` (despachando Campana IN_APP + Web Push nativo al equipo con cooldown de 6h anti-spam).
   - RPC `com_fn_guardar_colores_oferta_inventario` + panel **Colores en Oferta en Tienda** dentro de `ConsolaInventarioRosas.tsx` (toggle activar/desactivar, `%` configurable con `10%` por defecto y selección de colores).
   - Cálculo y aplicación en vivo del descuento en `personalizacionFloral.ts` (`calcularDescuentoColorOferta`), `ModalDetalleProducto.tsx`, `contexto-carrito.tsx` (preservado al ajustar cantidades), `DrawerCarritoFloristeria.tsx`, `ModalCheckoutTinkay.tsx` y `BandejaPedidosTienda.tsx`.
5. **Gobernanza:** Actualizada `gobernanza/productos/tinkay/especificacion-funcional.md`.
