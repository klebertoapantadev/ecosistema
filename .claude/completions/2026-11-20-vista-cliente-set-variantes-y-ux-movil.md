# Cierre de tarea — Paridad Vista Cliente, Variantes en Sets y UX Móvil

**Fecha:** 2026-11-20  
**Rama:** `master`  
**Ámbito:** `@eco/datagrid`, `@eco/comercio`, `apps/tinkay-web`, `gobernanza/productos/tinkay`

## Cambios realizados

1. **Paridad fiel entre "Vista Cliente" (`/panel/catalogo-productos`) y la tienda pública (`tinkay-web`):**
   - [`packages/comercio/src/componentes/CatalogoProductosComercio.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/CatalogoProductosComercio.tsx):
     - En `modoVista === "cliente"`, se ocultaron el filtro interno de canales y todos los chips de canales (`E-Commerce Web`, `App Clientes`, `Chatbot Web`, etc.).
     - Se reemplazó el recuadro contable interno (`Base Imponible / + IVA / TOTAL FACTURABLE`) por la presentación comercial real del cliente (`$80.00`, precio tachado `$87.50`, insignia `Set -9% OFF`, leyenda PVP/IVA y escalas por volumen).
     - Se agregó el desglose completo de Sets/Combos (`N× Pieza`, variante, precio unitario, descuento por volumen, subtotal y resumen `Suma de elementos por separado` → `Precio Set Completo (-X%)`).
     - Se unificaron los badges sobre la imagen (`🎁 SET -X% OFF`, `🔥 -X% OFF`, `🪑 EN RENTA`, `✨ EVENTOS`), el enlace directo a `/producto/[slug]` y los CTAs fieles por vertical (`Comprar`, `Personalizar / Comprar`, `Proforma`), además de riel horizontal de categorías y relación de aspecto compacta `4 / 3.4` en móvil.
   - [`packages/comercio/src/canales.ts`](file:///c:/IA/Ecosistema/packages/comercio/src/canales.ts):
     - Se removió la marca heredada `"Tranqi"` de los canales transversales (`"Chatbot Web"`, `"Agente IA por WhatsApp (YCloud)"`).

2. **Selección de variantes en configuración de Sets/Combos y corrección de dropdown dentro de modales:**
   - [`packages/datagrid/src/SelectConBuscador.tsx`](file:///c:/IA/Ecosistema/packages/datagrid/src/SelectConBuscador.tsx) y [`packages/datagrid/package.json`](file:///c:/IA/Ecosistema/packages/datagrid/package.json):
     - Se portaleó el popover / bottom-sheet y el backdrop a `document.body` mediante `createPortal` para evitar recortes por `backdropFilter` y `overflow: hidden` en modales.
     - Se cambió el input del buscador de `type="search"` a `type="text" inputMode="search"`, eliminando la doble `×` nativa junto al botón limpiar.
   - [`packages/comercio/src/componentes/EditorComboYVolumen.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/EditorComboYVolumen.tsx):
     - Selector unificado ancho completo con `<optgroup>` por producto y sus variantes (`Bombones Chocolates — Ferrero x1 en Esfera acrílica ($1.50)`, etc.), buscando por nombre de producto o de variante.
     - Tarjetas/píldoras táctiles con miniatura, nombre completo y PVP para seleccionar/cambiar la variante sin truncamientos (clave `var_id || var_sku || var_nombre`) y stepper táctil `- [qty] +`.
     - Filas de piezas ya agregadas actualizadas para resolver variantes por `var_id || var_sku` a ancho completo.

3. **Auditoría y mejoras de experiencia móvil (UX) en tienda pública y panel catálogo:**
   - [`apps/tinkay-web/modulos/ecommerce/componentes/ModalDetalleProducto.tsx`](file:///c:/IA/Ecosistema/apps/tinkay-web/modulos/ecommerce/componentes/ModalDetalleProducto.tsx) y [`TarjetaProductoConCarrusel.tsx`](file:///c:/IA/Ecosistema/apps/tinkay-web/modulos/ecommerce/componentes/TarjetaProductoConCarrusel.tsx):
     - Resuelta la superposición entre `Copiar link` y el botón cerrar `X` (`paddingRight: '48px'`).
     - Etiqueta diferenciada `🎁 Set / Combo para Eventos` vs. `🎁 Set / Combo Especial` (y `Set especial` en tarjetas no-evento).
     - Controles táctiles ampliados (`>= 36–38px`) en steppers `- / +` y píldoras de variantes; barra inferior sticky con `safe-area-inset-bottom`.
   - [`apps/tinkay-web/modulos/ecommerce/componentes/VitrinaCatalogoTinkay.tsx`](file:///c:/IA/Ecosistema/apps/tinkay-web/modulos/ecommerce/componentes/VitrinaCatalogoTinkay.tsx) y [`estilos-ecommerce.css`](file:///c:/IA/Ecosistema/apps/tinkay-web/modulos/ecommerce/estilos-ecommerce.css):
     - Filtros `Ordenar` y `Presupuesto` en grilla de 2 columnas en `<768px`, categorías con `scroll-snap`, padding inferior ampliado (`96px`) para evitar solapamiento con el botón flotante de Mía, foto compacta de modal (`4 / 3.2`, máx. `38dvh`) y botón cerrar flotante de alto contraste (`40×40px`).
   - [`packages/comercio/src/componentes/BarraPasosWizardProducto.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/BarraPasosWizardProducto.tsx), [`ModalEditarProducto.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/ModalEditarProducto.tsx) y [`ModalCrearProducto.tsx`](file:///c:/IA/Ecosistema/packages/comercio/src/componentes/ModalCrearProducto.tsx):
     - Riel horizontal `flex` con `scroll-snap` y barra de progreso en el wizard de 5 pasos sin truncar etiquetas ni mostrar scrollbar nativo.
     - Modales administrativos a pantalla completa (`100dvh`) en `<= 640px`, pie sticky con `safe-area-inset-bottom` y `font-size: 16px` en campos para evitar auto-zoom en iOS Safari.

4. **Gobernanza:**
   - Actualizada la especificación funcional en [`gobernanza/productos/tinkay/especificacion-funcional.md`](file:///c:/IA/Ecosistema/gobernanza/productos/tinkay/especificacion-funcional.md) (`TNK-001` y `TNK-002`).

## Verificación
- `pnpm --filter @eco/datagrid typecheck`: OK
- `pnpm --filter @eco/comercio typecheck`: OK
- `pnpm --filter @eco/comercio test`: 17/17 archivos, 97/97 tests OK
- `impeccable detect --json --changed`: sin hallazgos nuevos en el código modificado
- `pnpm --filter tinkay-web typecheck && pnpm --filter tinkay-web build`: ejecutado y verificado antes del push
