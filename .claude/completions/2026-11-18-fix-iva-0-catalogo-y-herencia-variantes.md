# Cierre: Corrección de Tarifa IVA 0% y Herencia de IVA en Variantes del Catálogo (`PLT-009` / `TNK-001`)

**Fecha:** 2026-11-18
**Requerimientos:** `PLT-009`, `TNK-001`

## Causas Raíz
1. En `packages/comercio/src/acciones.ts` (`obtenerCatalogoProductosAction`), la línea `Number(v.var_tarifa_iva_porcentaje) || 15` convertía cualquier tarifa `0` (falsy en JS) en `15%`, multiplicando por `1.15` todos los productos y variantes de Tinkay en `/panel/catalogo-productos` (incluidos los de Entrega Inmediata).
2. En `packages/comercio/src/componentes/ModalEditarProducto.tsx`:
   - `actualizarVariantePorIndex` tenía `target.var_tarifa_iva_porcentaje || 15` (otro bug `0 || 15`).
   - `agregarNuevaVariante` hardcodeaba `ivaPorc = 15` en lugar de heredar `tarifaIvaMaster`.
   - `tarifaIvaMaster` y la variante de respaldo inicializaban en `15` en lugar de `0` para floristería.
3. En `apps/tinkay-web/modulos/ecommerce/datos-catalogo.ts` y `servicio-catalogo.ts` / `ModalDetalleProducto.tsx` / `TarjetaProductoConCarrusel.tsx`, quedaban 5 ítems semilla/fallback con `tarifaIva: 15`.

## Cambios Aplicados
- `packages/comercio/src/acciones.ts`: eliminado `|| 15`, herencia explícita desde `tarifa_iva_predeterminada` del producto principal (respetando `iva_personalizado` solo si se configura explícitamente distinto), y código SRI coherente (`IVA_0` vs `IVA_15`).
- `packages/comercio/src/componentes/ModalEditarProducto.tsx` y `CatalogoProductosComercio.tsx`: herencia automática desde `tarifaIvaMaster` al agregar/editar variantes y propagación respetando overrides explícitos.
- `apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts`, `datos-catalogo.ts`, `ModalDetalleProducto.tsx`, `TarjetaProductoConCarrusel.tsx`: normalizados a `IVA 0%`.
- `supabase/migrations/20261118000008_tinkay_iva_0_productos_y_herencia_variantes.sql`: saneamiento SQL idempotente para dejar todos los productos y variantes de Tinkay en `IVA 0%` (`IVA_0`).
