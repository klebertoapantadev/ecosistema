# Cierre de Tarea — Visibilidad del Drawer de Proforma de Eventos en Tinkay

- **Fecha:** 2026-11-15
- **Estado:** ✅ Completado

## Causa Raíz Identificada
1. `DrawerProformaEvento.tsx` usaba nombres de clases CSS inexistentes (`drawer-backdrop-ecommerce`, `drawer-cabecera`, `titulo-drawer`, `drawer-cuerpo-scroll`, `carrito-vacio-estado`, `drawer-pie-totales`) en lugar de las clases reales de `estilos-ecommerce.css` (`drawer-backdrop-carrito`, `cabecera-drawer-carrito`, `titulo-con-icono-drawer`, `cuerpo-scroll-carrito`, `cuerpo-carrito-vacio`, `pie-drawer-carrito`).
2. Al no existir `.drawer-backdrop-ecommerce`, el contenedor carecía de `position: fixed; inset: 0; z-index`, renderizándose en flujo estático al final absoluto del DOM debajo del `<footer>`, fuera de la vista del usuario al pulsar `Proforma`.
3. Adicionalmente, `ModalTerminosWhatsapp` estaba anidado dentro del backdrop con `onClick` de cierre y `backdrop-filter`, por lo que hacer clic en la cláusula LOPDP podía propagar el cierre del cajón.

## Solución Implementada
- **`apps/tinkay-web/modulos/ecommerce/componentes/DrawerProformaEvento.tsx`**:
  - Homologación con las clases CSS nativas reales de `estilos-ecommerce.css` más estilos explícitos en línea (`position: fixed; inset: 0; zIndex: 120`, scroll interno `flex: 1; minHeight: 0; overflowY: 'auto'`, pie fijo).
  - Extracción de `ModalTerminosWhatsapp` como hermano fuera del backdrop del cajón para evitar propagación de clic y contención por `backdrop-filter`.
  - Soporte de cierre con tecla `Escape` y preservación de la ruta actual (`pathname?proforma=abierta`) al ir a registro/ingreso.
- **`apps/tinkay-web/modulos/ecommerce/contexto-carrito.tsx`**:
  - Exclusión mutua automática entre `drawerProformaAbierto`, `drawerAbierto`, `productoSeleccionadoModal` y `checkoutAbierto`.
