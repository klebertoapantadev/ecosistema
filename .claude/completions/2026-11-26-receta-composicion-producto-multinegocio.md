# Cierre de Tarea — Receta / Composición Multinegocio de Productos (`PLT-009`, `TNK-001`, `TNK-002`)

**Fecha:** 2026-11-26  
**Rama:** `master`  
**Proyecto Supabase:** `ecosistema` (`oaybbpdxhlxjbpwnoymy`)

## Objetivo
Implementar un motor genérico multinegocio de **Composición / Receta de Productos** (con plantilla floral para Tinkay/Margaritas: Rosas `1..N` colores, Girasoles, Orquídeas, Gerberas, Lirios y componentes personalizados `+ Otro`) con alcance **Global (Master)** o sobrescritura por **Variante/Tamaño**, garantizando:
1. Mostrar automáticamente en descripción y detalle del producto **`Aprox. 50 rosas, aprox. 18 girasoles`** únicamente para los componentes con cantidad `> 0` (si todos son `0`, no mostrar nada).
2. Exigir y mostrar el selector de colores de rosas en compra **únicamente cuando la receta del producto/variante incluya rosas (`rosas > 0`)**.
3. Sincronización automática hacia `comun_comercio.com_receta` y `com_insumo` para futuras integraciones de costos, compras e inventario.

## Cambios Realizados

### 1. Base de Datos (`supabase/migrations/`)
- [`20261126000008_receta_composicion_producto_multinegocio.sql`](../../supabase/migrations/20261126000008_receta_composicion_producto_multinegocio.sql) (aplicada en vivo):
  - Crea la RPC `SECURITY DEFINER` `comun_comercio.com_fn_sincronizar_recetas_producto(p_negocio text, p_producto_id uuid)`.
  - Resuelve herencia Master vs. Variante (`personalizacion_floral_modo = 'personalizado'`), crea/actualiza insumos en `com_insumo`, hace baja lógica (`rec_eliminado_en = now()`) de recetas obsoletas y hace upsert en `com_receta`.

### 2. Motor Compartido Multinegocio (`packages/comercio/`)
- [`packages/comercio/src/utils/recetaProducto.ts`](../../packages/comercio/src/utils/recetaProducto.ts):
  - Define `COMPONENTES_RECETA_FLORISTERIA` (`rosas`, `girasoles`, `orquideas`, `gerberas`, `lirios`), `ItemComposicionReceta`, `normalizarComposicionReceta`, `obtenerItemsActivosReceta`, `obtenerResumenFloresReceta`, `formatearDescripcionComposicion` (`"Aprox. 50 rosas, aprox. 18 girasoles"`, solo `> 0`) y `resolverComposicionRecetaEfectiva` (herencia Master vs. Variante).
- [`packages/comercio/src/utils/personalizacionFloral.ts`](../../packages/comercio/src/utils/personalizacionFloral.ts):
  - Añade modo `"flores_receta"` (evitando fallback a `"solo_rosas"` cuando una receta tiene solo gerberas/lirios).
  - Cuando existe receta (`tieneReceta === true`) sin rosas (`!incluyeRosas`), deshabilita automáticamente `maxColoresRosas = 0`, `permiteSoloRosas = false` y `modoRequiereColoresRosas(...) = false`.
  - Cuando la receta incluye rosas, sincroniza `maxColoresRosas` (`1..N`), activa `girasoles_y_rosas` si hay girasoles y sincroniza el rango de orquídeas si hay orquídeas.
- [`packages/comercio/src/componentes/EditorPersonalizacionFloralProducto.tsx`](../../packages/comercio/src/componentes/EditorPersonalizacionFloralProducto.tsx):
  - Agrega el bloque interactivo de **Composición / Receta del Producto** (funciona en Master y en Override de Variante) con vista previa en vivo (`"Aprox. 50 rosas, aprox. 18 girasoles"`), control `Colores 1..N` en rosas, checkbox `Aprox.`, botón `+ Otro` y ocultamiento automático de secciones de color de rosas cuando la receta no incluye rosas.
- [`packages/comercio/src/componentes/ModalEditarProducto.tsx`](../../packages/comercio/src/componentes/ModalEditarProducto.tsx), [`packages/comercio/src/acciones.ts`](../../packages/comercio/src/acciones.ts) y [`packages/comercio/src/componentes/CatalogoProductosComercio.tsx`](../../packages/comercio/src/componentes/CatalogoProductosComercio.tsx):
  - Persisten `composicion_receta` en `pro_detalle_producto` y `var_detalle_variante`, invocan `com_fn_sincronizar_recetas_producto` al crear/editar y renderizan la composición en Admin y Vista Cliente.

### 3. Tienda Pública Tinkay y Agente ARIA/Mía
- [`apps/tinkay-web/modulos/ecommerce/tipos.ts`](../../apps/tinkay-web/modulos/ecommerce/tipos.ts), [`servicio-catalogo.ts`](../../apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts) y [`filtrado-catalogo.ts`](../../apps/tinkay-web/modulos/ecommerce/filtrado-catalogo.ts):
  - Mapean, resuelven herencia e indexan en el buscador `composicionReceta` y `composicionDescripcion`.
- [`apps/tinkay-web/modulos/ecommerce/componentes/ModalDetalleProducto.tsx`](../../apps/tinkay-web/modulos/ecommerce/componentes/ModalDetalleProducto.tsx) y [`TarjetaProductoConCarrusel.tsx`](../../apps/tinkay-web/modulos/ecommerce/componentes/TarjetaProductoConCarrusel.tsx):
  - Muestran `🌸 Composición: Aprox. 50 rosas, aprox. 18 girasoles` únicamente cuando existe al menos un componente `> 0` (en tarjeta, bloque `Descripción` y detalle dinámico por variante).
  - Ocultan el selector de colores de rosas cuando la receta no incluye rosas y adaptan orquídeas fijas de receta y alertas `Bajo confirmación o para reservas (1 día)` con `Verificar con tienda`.
- [`packages/agentes-ia/src/mcp-catalogo.ts`](../../packages/agentes-ia/src/mcp-catalogo.ts):
  - Indexa y expone `composicion` (solo si `> 0`) por producto y variante para que Mía/ARIA responda y busque con precisión.

### 4. Pruebas y Gobernanza
- Pruebas unitarias en [`recetaProducto.test.ts`](../../packages/comercio/src/utils/recetaProducto.test.ts) y [`personalizacionFloral.test.ts`](../../packages/comercio/src/utils/personalizacionFloral.test.ts).
- Gobernanza actualizada en [`gobernanza/productos/tinkay/especificacion-funcional.md`](../../gobernanza/productos/tinkay/especificacion-funcional.md) (`TNK-001`, `TNK-002`).
