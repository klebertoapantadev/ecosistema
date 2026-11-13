# Cierre de Tarea — Sets / Combos Configurables y Escalas de Descuento por Volumen (`PLT-009.27` / `TNK-002`)

- **Fecha:** 2026-11-13
- **Responsable:** Kleber Toapanta (con Antigravity)
- **Requerimientos:** `PLT-009` (Regla 27), `ADR-0003`, `TNK-001`, `TNK-002`

## Resumen Técnico

1. **Motor Compartido de Precios por Volumen y Combos (`packages/comercio`):**
   - `packages/comercio/src/utils/combosVolumen.ts` (+ `combosVolumen.test.ts`): cálculo puro sin dependencias de Next.js (`calcularPrecioPorVolumen`, `normalizarEscalasVolumen`, `normalizarComponentesCombo`, `describirEscalaVolumen`), recalculando la base imponible unitaria sin IVA para facturación SRI.
   - `packages/comercio/src/componentes/EditorComboYVolumen.tsx`: interfaz administrativa con estilos en línea (cero Tailwind) integrada en `ModalCrearProducto.tsx` y `ModalEditarProducto.tsx` tanto para Producto Simple como Variantes (`S / M / L / XL`).
   - `packages/comercio/src/acciones.ts`: persistencia de `es_combo`, `combo_componentes` y `escalas_volumen` en `pro_detalle_producto` y `var_detalle_variante`.

2. **Base de Datos Relacional (`supabase/migrations/20261113000001_comun_comercio_combos_y_escalas_volumen.sql`):**
   - Tabla `comun_comercio.com_combo_componente` (prefijo `cbc_`), RLS activo (lectura pública de combos activos + escritura staff), trigger `aud_fn_auditar_tabla()` y actualización de `com_fn_guardar_producto_catalogo` (`SECURITY DEFINER`, `set search_path = ''`).

3. **Vitrina, Modal Interactivo y Carrito E-Commerce (`apps/tinkay-web`):**
   - `servicio-catalogo.ts` & `tipos.ts`: hidratación de componentes de combo y escalas de volumen, sincronizando automáticamente el precio tachado del Set frente a la suma individual real.
   - `TarjetaProductoConCarrusel.tsx`: insignias `🎁 SET -X% OFF`, `✨ Incluye N piezas • Personalizable` y `🏷️ N+ uds a $...`.
   - `ModalDetalleProducto.tsx`: conmutador interactivo **Set Completo** vs **Personalizar** (selección de tamaño `S/M/L/XL` y cantidad `0..N` por pieza, más selector de cantidad con descuento por volumen en productos individuales).
   - `contexto-carrito.tsx` & `DrawerCarritoFloristeria.tsx`: recálculo reactivo de PVP y base imponible al cambiar cantidades en el carrito.

