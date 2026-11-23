# Cierre de tarea — Mejoras UX móvil, Me gusta global, filtros integrados y checkout PLUX en Tinkay

- **Fecha:** 2026-11-23
- **Rama:** `master`
- **Requerimiento:** `TNK-002` ([especificacion-funcional.md](../../gobernanza/productos/tinkay/especificacion-funcional.md))

## Cambios implementados

1. **Botón flotante compacto, movible y cerrable de Mía (`ChatAriaFlotante.tsx`, `estilos-ecommerce.css`):**
   - Burbuja circular compacta (`54px`, `50px` en móvil) con únicamente el ícono redondo de la rosa (`🌹`).
   - Arrastre libre con mouse/touch vía Pointer Events (umbral `> 6px`, acotado al viewport).
   - Botón `×` para ocultar el flotante por completo hasta recargar la página.
2. **Cabecera limpia con WhatsApp, Alertas y Cuenta dentro del menú hamburguesa (`EncabezadoEcommerce.tsx`, `estilos-ecommerce.css`):**
   - Eliminados de la barra superior los botones de WhatsApp, `CampanaNotificaciones` y `Mi Espacio / Ingresar`.
   - Centralizados dentro del drawer del menú hamburguesa (`☰`), visible tanto en escritorio como en móvil.
3. **Contador global de "Me gusta" (❤️) + filtro dedicado (`contexto-carrito.tsx`, `TarjetaProductoConCarrusel.tsx`, `filtrado-catalogo.ts`, `EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`):**
   - Estado global persistido en `localStorage` (`tinkay_favoritos_v1`) con contador `totalFavoritos` validado contra el catálogo.
   - Chip/filtro `Me gusta` con contador visible en la barra principal, franja móvil, vitrina y drawer, mostrando únicamente los productos marcados con corazón.
4. **Filtros `Ofertas` y `Entrega Inmediata` integrados en la barra principal (`filtrado-catalogo.ts`, `EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`, `metadata-ecommerce.ts`):**
   - Retirado el botón suelto `🔥 Solo Ofertas` bajo los selectores de orden/presupuesto.
   - Integrados `Ofertas` (con contador) y `Entrega Inmediata` directamente en el carril principal de filtros junto a `Arreglos Florales`, `Eventos`, `Condolencias`, `Me gusta` y `Todo`.
5. **Checkout con Transferencia por defecto y flujo PLUX directo con spinner (`ModalCheckoutTinkay.tsx`, `VistaProformaEventoCliente.tsx`, `BotonPagoPlux.tsx`):**
   - `Transferencia / DeUna` pasa a ser la primera opción y el método seleccionado por defecto.
   - Al elegir `Tarjeta (PLUX)`, se elimina el paso/banner intermedio de `"Orden lista (TNK-ORD-xxxx)"` y se muestra directamente `Pagar con PLUX ($total)`.
   - Al hacer clic en pagar con PLUX, se muestra continuamente un spinner animado (`Conectando con PLUX…` → `Abriendo formulario seguro de PLUX…`) y se abre automáticamente el modal seguro de tarjeta (`autoIniciar` + `autoAbrirModal`).

## Verificación

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter tinkay-web build`
- Sin clases utilitarias de Tailwind CSS en el diff.
