# Cierre de tarea — Primera Clasificación de Consulta y Filtro por Etiquetas de Búsqueda (Tinkay)

**Fecha:** 2026-11-22  
**Alcance:** `TNK-001`, `TNK-002` (`tinkay-web`, `@eco/comercio`, `gobernanza/productos/tinkay/especificacion-funcional.md`)

## Cambios realizados

1. **Primera Clasificación de Consulta en 3 Pilares (`filtrado-catalogo.ts`, `EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`, `contexto-carrito.tsx`, `metadata-ecommerce.ts`, `LandingEcommerceTinkay.tsx`):**
   - Definidos los 3 pilares de primer nivel en orden fijo:
     1. **`Arreglos Florales`** (*Para toda ocasión*) → `/categoria/arreglos-florales`, agrupa todas las colecciones florales de compra directa (`⚡ Entrega Inmediata`, `Box Florales`, `Estilo Coreano`, `Para Florero`, `Arreglos Florales`).
     2. **`Eventos`** → `/categoria/eventos`, agrupa `Decoración y Ceremonias` y `Mobiliario en Renta` y activa el acceso a `Proforma`.
     3. **`Condolencias`** → `/categoria/condolencias`, agrupa los arreglos de condolencias y activa el modo visual sobrio.
   - Limpiado el encabezado superior (`EncabezadoEcommerce.tsx` en escritorio, franja rápida móvil y menú lateral) para mostrar una única línea con los 3 pilares principales + `Todo`, moviendo las colecciones específicas al Nivel 2 contextual de la vitrina y a la sección secundaria del menú móvil.
   - Actualizada la resolución de deep links y metadatos OpenGraph (`metadata-ecommerce.ts`) para las rutas `/categoria/arreglos-florales`, `/categoria/eventos` y `/categoria/condolencias`.

2. **Filtrado y Búsqueda por Etiquetas Semánticas (`pro_detalle_producto.etiquetas`, Keywords IA):**
   - `apps/tinkay-web/modulos/ecommerce/tipos.ts` y `servicio-catalogo.ts`: preservadas las etiquetas semánticas reales del producto en `etiquetasBusqueda` (separadas de badges sintéticos como `En Renta` o `Cotización Evento`).
   - `apps/tinkay-web/modulos/ecommerce/filtrado-catalogo.ts`: agregadas utilidades `obtenerEtiquetasBusquedaDisponibles`, `productoCoincideConEtiquetas` y `tokenCoincideEnCorpus` con tolerancia de tildes, prefijo `#` y plural/singular en español (`orquidea` ↔ `orquideas`, `floreros` ↔ `florero`, `luces` ↔ `luz`).
   - `apps/tinkay-web/modulos/ecommerce/componentes/VitrinaCatalogoTinkay.tsx` y `estilos-ecommerce.css`: agregado riel interactivo de chips `# Etiqueta` debajo de las sub-colecciones para filtrar por etiquetas de búsqueda en 1 clic (multi-selección + botón `Limpiar` + auto-ampliación inteligente cuando una búsqueda de texto no coincide con la categoría activa).
   - `packages/comercio/src/componentes/CatalogoProductosComercio.tsx`: actualizado el buscador del catálogo comercial para indexar `pro_detalle_producto.etiquetas`, `usos`, `categoria` y `variantes` (sin distinción de tildes ni plural/singular) y agregado riel deslizable de chips `# Etiqueta` en `/panel/catalogo-productos`.

3. **Gobernanza:**
   - Actualizado `gobernanza/productos/tinkay/especificacion-funcional.md` (sección `TNK-002`).
