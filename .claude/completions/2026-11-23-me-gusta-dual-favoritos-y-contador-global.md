# Cierre de tarea — Sistema Dual de "Me gusta" (Favoritos personales al inicio + Contador Global Permanente en BDD)

- **Fecha:** 2026-11-23
- **Rama:** `master`
- **Requerimiento:** `TNK-002` ([especificacion-funcional.md](../../gobernanza/productos/tinkay/especificacion-funcional.md))

## Cambios implementados

1. **Filtro personal `Me gusta` al inicio y condicional (`EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`, `contexto-carrito.tsx`):**
   - El filtro `❤️ Me gusta [N]` se ubica en **primera posición** (antes de `Arreglos Florales`) en escritorio, franja móvil, menú lateral y vitrina.
   - Aparece **únicamente** cuando el usuario ha marcado al menos un corazón (`totalFavoritos > 0`) y regresa automáticamente al catálogo general si retira su último favorito mientras estaba en esa pestaña.
2. **Contador global permanente en PostgreSQL (`20261123000001_contador_me_gusta_global_productos.sql`, `packages/comercio/src/acciones.ts`, `servicio-catalogo.ts`, `filtrado-catalogo.ts`):**
   - Nuevas columnas `com_producto.pro_total_me_gusta` y `com_variante.var_total_me_gusta` (`bigint not null default 0`), vistas públicas actualizadas y RPC transaccional `SECURITY DEFINER` `com_fn_registrar_me_gusta_producto` (+ `com_fn_obtener_me_gusta_catalogo`).
   - Cada "Me gusta" incrementa `+1` de forma permanente en BDD y **nunca decrementa** aunque el usuario remueva el corazón de su lista personal.
3. **Visualización global al ingresar y ranking de "Más deseados" (`TarjetaProductoConCarrusel.tsx`, `ModalDetalleProducto.tsx`, `VitrinaCatalogoTinkay.tsx`, `CatalogoProductosComercio.tsx`):**
   - Cada tarjeta de la tienda y el modal de detalle muestran el contador global acumulado junto al corazón (`♡ N` / `❤️ N`).
   - La vitrina muestra el contador global acumulado de la tienda y agrega la opción de ordenamiento `Más deseados (❤️)`.
   - El panel de catálogo (`/panel/catalogo-productos`) muestra la insignia `❤️ N` por producto y el filtro/orden `Más deseados (N)` para identificar los productos más deseados aunque no se hayan comprado.

## Verificación

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter tinkay-web build`
- Sin clases utilitarias de Tailwind CSS en el diff.
