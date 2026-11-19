# Cierre de tarea — Impeccable Fase 1 (Tinkay: Condolencias, Vitrina limpia y Accesibilidad/Táctil)

- **Fecha**: 2026-11-19
- **Rama**: `master`
- **Origen**: Diagnóstico dual `impeccable critique` + `impeccable audit` sobre Tinkay Floristería.

## Cambios aplicados
1. **P0 — Condolencias sobrias, Checkout respetuoso y Quick Wins**:
   - `TarjetaProductoConCarrusel.tsx` + `estilos-ecommerce.css`: `modoSobrio` oculta chips promocionales y descuentos, cambia CTA `Comprar` a `.btn-agregar-rapido-sobrio` (`--verde`), rótulo `Condolencias` sin emojis y dots/favorito en verde sobrio.
   - `ModalCheckoutTinkay.tsx`: suprimido el muro bloqueante rosado de "Bombón Ferrero GRATIS" (nunca aparece si el carrito incluye Condolencias; en compras festivas se muestra como aviso compacto no bloqueante en el formulario).
   - `CarruselHeroDestacados.tsx`: ocultado bloque `"Desde"` en el slide de tienda física (`"Desde Quito"` corregido), pausado en hover/focus y desactivado autoplay con `prefers-reduced-motion: reduce`.
   - `LandingEcommerceTinkay.tsx`: reemplazado teléfono ficticio `+593 99 123 4567` por `configTiendaCheckout.whatsappTienda` dinámico y `loading="lazy"` en imágenes.
   - `VitrinaCatalogoTinkay.tsx`: reset de filtros restaurado a `'recomendados'` y migración de colores a tokens CSS `:root`.
2. **P1 — Limpieza visual de tarjetas de producto**:
   - `TarjetaProductoConCarrusel.tsx` + `estilos-ecommerce.css`: máximo 1 chip diluido por tarjeta (`sistema-visual.md §6`), eliminado botón flotante de copiar link sobre la foto, flechas reveladas solo en `:hover`/`:focus-within` (visibles en dispositivos táctiles), y corregido `<div role="button">` anidando `<button>` a `<article>` semántico.
3. **P1 — Accesibilidad, Ergonomía Táctil y Loaders**:
   - `globals.css` + `estilos-ecommerce.css`: `:focus-visible` global, `@media (prefers-reduced-motion: reduce)`, fallbacks `100dvh`, animación nativa `.eco-spin`, y eliminadas 65 líneas de CSS muerto `.muestra-*`.
   - `DrawerCarritoFloristeria.tsx` y `ModalCheckoutTinkay.tsx`: cierre por tecla `Escape` y `aria-modal="true"`.
   - `ConsolaInventarioRosas.tsx`: steppers táctiles `36×36px` con `aria-label` + input numérico editable directo + barra "Deshacer" al quitar una foto/lote + `role="alert"`/`aria-live="polite"`.
   - `CatalogoProductosComercio.tsx` y otros 6 componentes de `@eco/comercio`: reemplazados loaders Tailwind congelados (`animate-spin`) por animación CSS nativa (`.eco-icono-girando` / `.eco-spin`) y ampliado target táctil del indicador de carrusel de `6px` a `24×24px` con `aria-label`.
   - `CatalogoVariedadesRosas.tsx`: `aria-label` en buscador y botón limpiar búsqueda sin `outline: none` ciego.
