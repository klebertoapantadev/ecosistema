# Cierre de Tarea — Visibilidad de Productos Inactivados en Catálogo Administrativo

**Fecha:** 2026-11-18  
**Requerimientos:** `TNK-001` / `PLT-009`

## Causa Raíz
En `packages/comercio/src/acciones.ts` (`obtenerCatalogoProductosAction`), el paso 0 invocaba siempre la RPC pública `com_fn_obtener_catalogo_productos`, incluso cuando el administrador solicitaba `incluirInactivos = true`. Como la RPC aplica `WHERE pro_activo = true` y devolvía los demás productos activos (`prodsRpc.length > 0`), la función retornaba anticipadamente sin consultar la tabla completa, ocultando los productos inactivos también para el administrador al recargar la página.

## Solución Implementada
- Se condicionó la llamada a `com_fn_obtener_catalogo_productos` únicamente a consultas públicas (`!incluirInactivos`). Cuando `incluirInactivos = true` (`CatalogoProductosComercio.tsx` y `ConsolaGestionCatalogo.tsx`), se consulta directamente `comun_comercio.com_producto` excluyendo solo filas con borrado lógico (`pro_eliminado_en IS NULL`).
- Se reforzó `alternarActivoProductoAction` con verificación explícita de errores de actualización en Supabase y `revalidatePath("/")`.
- Se añadieron píldoras de filtro rápido **`Todos` / `Activos` / `Inactivos (N)`** en `CatalogoProductosComercio.tsx` para ubicar y reactivar productos inactivos en 1 toque.
