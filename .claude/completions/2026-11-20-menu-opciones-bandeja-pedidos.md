# Agrupación de Controles en Botón "Opciones" — Bandeja de Pedidos

- **Fecha:** 2026-11-20
- **Archivo modificado:** `packages/comercio/src/componentes/BandejaPedidosTienda.tsx`

## Cambios aplicados
1. **Valores por defecto actualizados:**
   - Filtro de fecha: **Hoy** (`HOY`) al abrir la vista (sin quedar atascado en fechas de días anteriores).
   - Filtro de tipo: **Todos** (`TODOS`).
   - Visualización: **Kanban** (`kanban`, con persistencia en `localStorage` bajo clave v2 si el usuario cambia a Tabla).
2. **Barra única compacta + panel desplegable "Opciones":**
   - Reemplazadas las dos barras apiladas de filtros/controles y el buscador duplicado por una sola barra con buscador rápido, chip discreto del filtro activo y botón **`Opciones`** (con contador de filtros distintos al defecto).
   - Dentro de **`Opciones`** (popover en escritorio / hoja inferior en móvil, cierre con clic fuera o `Escape`) se agrupan:
     - **Filtros**: Fecha (`Hoy`, `Ayer`, `Esta Semana`, `Semana ±3 días`, `Mes`, `Todos`) y Tipo de pedido (`Todos` + tipos activos con conteo).
     - **Visualización**: `Kanban` (por defecto) / `Tabla`.
     - **Acciones extra**: `Actualizar`, `Papelera` (solo admin), `Restablecer` y botón inferior `Ver N pedidos`.
3. **Estado vacío accionable y limpieza en móvil:**
   - Ocultado el texto explicativo largo en móvil para que las tarjetas Kanban aparezcan de inmediato.
   - Si `Hoy` tiene 0 pedidos, el estado vacío ofrece botones rápidos (`Ver todos` / `Abrir Opciones`).

## Verificación
- `pnpm --filter @eco/comercio typecheck` ✅
- `pnpm --filter tinkay-web typecheck` ✅
- `pnpm --filter margaritas-web typecheck` ✅
- `pnpm --filter @eco/comercio test` ✅ (16 archivos / 95 tests)
