# Cierre de tarea — Envoltorio por colección, microcopia sutil, buscador/filtros, likes acumulativos y estados de pedidos editables con visibilidad en Taller

**Fecha:** 2026-11-24  
**Rama:** `master` (Trunk-Based Development)

## Resumen de cambios implementados

1. **Envoltorio y colores por colección (`personalizacionFloral.ts`, `EditorPersonalizacionFloralProducto.tsx`, `ModalCrearProducto.tsx`, `ModalEditarProducto.tsx`, `ModalDetalleProducto.tsx`, `servicio-catalogo.ts` + backfill SQL):**
   - Colecciones **"Para Florero"** y **"Estilo Coreano"** → **`Papel`** (`papel_envoltorio`) con `Colores Claros (Blanco / Beige)`, `Colores Oscuros (Negro / Gris)` y **`Tonos Pastel (Rosado / Lila)`**.
   - Colección **"BOX"** → **`Base`** (`base`) exclusivamente con **`Blanco`**, **`Negro`** y **`Rosado`**.
   - Resto de colecciones → **`No aplica`** por defecto (no muestra selección de base/papel al cliente).
   - Backfill idempotente en `supabase/migrations/20261124000001_estados_pedido_personalizables_taller_y_envoltorio_colecciones.sql`.

2. **Microcopia y color sutil en tarjetas (`TarjetaProductoConCarrusel.tsx`, `personalizacionFloral.ts`, `ModalDetalleProducto.tsx`):**
   - Reemplazado `"Elaborado en los colores de tu preferencia"` (rosa intenso) por **`Colores y decoración según la ocasión`** en tono neutro cálido (`#F6F4EF` / `#E6E0D6` / `#6B655E`).

3. **Barra única de búsqueda en cabecera + línea deslizable (`EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`, `contexto-carrito.tsx`, `estilos-ecommerce.css`):**
   - Unificada toda la búsqueda y exploración en una sola barra fija en cabecera: **Arriba** búsqueda libre (*"Busca por ocasión, flores, color, precio..."*) + **ícono de Filtros** integrado (abre modal/hoja con los 5 bloques: Categorías, Colecciones, Etiquetas, Popularidad/`Más solicitados` y Presupuesto); **Abajo** una única línea horizontal deslizable con **`♡ Me gusta`** (cliente) seguido de las categorías base (`Arreglos Florales`, `Eventos`, `Condolencias`, `Ofertas`, `Entrega Inmediata`, `Todo`).
   - Eliminada la barra duplicada de búsqueda/filtros dentro de `VitrinaCatalogoTinkay.tsx`.

4. **Contador global de Me Gusta siempre acumulativo (`contexto-carrito.tsx`):**
   - Cada pulsación para marcar corazón incrementa `+1` globalmente en PostgreSQL; quitar el corazón no decrementa; volver a marcarlo incrementa `+1` nuevamente.

5. **Estados de pedido editables, visibilidad en Taller y confirmación completa de compra:**
   - Pago con tarjeta (PLUX) → **`Nuevo - Confirmado`** (`NUEVO_CONFIRMADO`, `visibleEnTaller: true`).
   - Pago con transferencia → **`Nuevo - Por Confirmar`** (`NUEVO_POR_CONFIRMAR`, `visibleEnTaller: false`), visible en `/panel/pedidos` para revisar recibo y cambiar estado.
   - Botón **`Estados`** surfaced directamente en la barra superior de `/panel/pedidos` (`BandejaPedidosTienda.tsx`) abriendo `ModalAdminEstadosPedido.tsx` con edición, agregar/eliminar estados e interruptor **`Taller: Sí / Taller: No`** (`visibleEnTaller`).
   - Consola de Taller (`ConsolaTallerFloral.tsx`), TV Taller (`obtenerTableroTvTallerAction`) y RPCs SQL (`com_fn_estado_pedido_visible_en_taller`, `com_fn_actualizar_estado_pedido_tienda`, `com_fn_sincronizar_ventas_a_ordenes_taller`, `com_fn_obtener_consola_taller_y_despacho`, `com_fn_registrar_pedido_tienda`, `com_fn_confirmar_pago_plux`) sincronizados con `visibleEnTaller`.
   - Pantalla de éxito en `ModalCheckoutTinkay.tsx` muestra todos los datos del pedido (código, estado, método de pago, cliente/WhatsApp, artículos con personalización, modalidad de entrega, total) y botón siempre visible **`Contactar por WhatsApp`**.
