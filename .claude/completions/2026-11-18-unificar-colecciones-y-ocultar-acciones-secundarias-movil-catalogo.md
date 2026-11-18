# Cierre de Tarea — Unificación de Colecciones y Limpieza Móvil en Catálogo Comercial

**Fecha:** 2026-11-18
**Negocio / Paquetes:** `@eco/comercio`, `apps/tinkay-web`, `gobernanza/productos/tinkay`
**Requerimientos:** `TNK-001`, `PLT-009`

## Cambios Realizados

1. **Unificación de `"Nueva Colección"` y `"Gestionar"` (`CatalogoProductosComercio.tsx`):**
   - Unificados los dos botones duplicados de la barra superior (`Nueva Colección` y `Gestionar`) y los dos botones duplicados de la tarjeta de filtros (`+ Colección` y `⚙️`) en un solo botón conciso **`Colecciones`** (`Categorías` en negocios no florales) que abre `ModalCrearCategoria` con sus pestañas integradas de creación y gestión.
2. **Ocultamiento en Modalidad Móvil (`<= 640px`) y Visibilidad Exclusiva en Pantallas Grandes (PC y Tablet `>= 641px`):**
   - Ocultados en vista celular (`@media (max-width: 640px)` + `window.matchMedia("(max-width: 640px)")`) los botones **`Colecciones`** (unificado), **`Tipos Oferta`**, **`Convenios B2B`**, **`Compartir`** y **`Actualizar`**.
   - Reemplazada la clase utilitaria `animate-spin` del ícono de actualización por animación CSS nativa `.eco-icono-girando` conforme a `AGENTS.md` Regla 17.
