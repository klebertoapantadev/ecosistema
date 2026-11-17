# Cierre de Tarea — Visibilidad de Decoración Globos I y Aro - Guirnalda de Globos en Vitrina Cliente

**Fecha:** 2026-11-17  
**Requerimientos:** `TNK-001` / `TNK-002`

## Causa Raíz
En `apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts`, el cálculo de `esExtra` incluía coincidencias parciales de slug (`p.pro_slug?.includes('globo')`, `'ferrero'`, `'choc'`, `'mariposa'`, `'cinta'`) pensadas originalmente para complementos sueltos de semilla. Al crear **`Decoración Globos I`** (`decoracion-globos-i`) y **`Aro - Guirnalda de globos`** (`aro-guirnalda-de-globos`) dentro de `Eventos y Ceremonias`, ambos quedaban marcados como `esExtra = true` y eran filtrados fuera de `expandirProductosVitrina()` y `productoCoincideConCategoria()`.

## Solución Implementada
- Se restringió `esExtra` a productos marcados explícitamente con `detalle.es_complemento === true`, tipo `COMPLEMENTO` o pertenecientes a categorías `Extras` / `Complemento` (`cat-detalles`), usando slugs exactos de semilla únicamente como respaldo cuando el producto no tiene asignada una categoría comercial regular.
- Se verificó contra la base de datos en vivo que **`Decoración Globos I`** y **`Aro - Guirnalda de globos`** aparecen tanto en `Todo el Catálogo` como en `Eventos y Ceremonias`, manteniendo ocultos los verdaderos `Extras` (`Bombones Chocolates` y `Cinta Condolencias`).
