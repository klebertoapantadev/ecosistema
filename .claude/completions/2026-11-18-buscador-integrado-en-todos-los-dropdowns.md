# Cierre de Tarea — Buscador Integrado en Todos los Dropdownlists (`SelectConBuscador`)

**Fecha:** 2026-11-18
**Negocio / Paquetes:** `@eco/datagrid`, `@eco/comercio`, `@eco/configuracion-negocio`, `@eco/gestion-usuarios`, `@eco/identidad`, `@eco/notificaciones`, `apps/tinkay-web`, `gobernanza/productos/tinkay`
**Requerimientos:** `TNK-001`, `TNK-002`, `TNK-004`, `TNK-005`, `PLT-001`, `PLT-009`, `PLT-011`

## Entregables Implementados

1. **Componente Universal `<SelectConBuscador>` (`packages/datagrid/src/SelectConBuscador.tsx`):**
   - API 100% compatible con `<select>` (`value`, `defaultValue`, `onChange`, `name`, `required`, `<option>`, `<optgroup>`), cero dependencias externas y especificidad CSS `:where(.eco-select-buscador)` (`0,0,0`) para respetar íntegramente clases existentes e inline styles.
   - Búsqueda instantánea multicriterio sin acentos ni distinción de mayúsculas, navegación por teclado (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) y botón para limpiar filtro.
   - Modo responsive: Popover flotante con inversión automática vertical en escritorio/tablet y Bottom Sheet táctil sin desbordes horizontales en móvil (`<= 640px`, `fontSize: 16px`).
2. **Migración Integral de 38 Componentes Cliente:**
   - Actualizados todos los selectores desplegables en `apps/tinkay-web`, `@eco/comercio` (incluyendo el selector de catálogo de `ConsolaEnvioPedidosTaller.tsx` con depuración de nombres repetidos de variante), `@eco/configuracion-negocio`, `@eco/gestion-usuarios`, `@eco/identidad` y `@eco/notificaciones`.
