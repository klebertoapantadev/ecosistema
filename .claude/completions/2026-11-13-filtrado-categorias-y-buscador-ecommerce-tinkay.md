# Cierre de Tarea — Filtrado de Categorías y Buscador Multidimensional en E-Commerce Tinkay

**Fecha:** 2026-11-13
**Requerimientos:** `TNK-001`, `TNK-002`, `PLT-009`

## Causas Raíz Detectadas

1. **Enlaces de categorías del encabezado y pie de página sin acción de filtrado:**
   - En `EncabezadoEcommerce.tsx` y `apps/tinkay-web/app/page.tsx`, los enlaces (`Catálogo`, `Box Florales`, `Estilo Coreano`, `Para Florero`, `Condolencias`) eran únicamente anclas `<a href="#catalogo">` sin conexión al estado de categoría activa, dejando activo `"Todo el Catálogo"` y mezclando `Box Florales` con `Condolencias`.
2. **Categorías estáticas residuales sobreponiéndose a `com_categoria` y exclusión de servicios con foto:**
   - `servicio-catalogo.ts` anteponía `CATEGORIAS_TINKAY` sobre `catsDb`, ignorando nombres/órdenes editados en el panel e inyectando categorías dadas de baja en BD, además de asignar usos ficticios por defecto y excluir productos tipo `SERVICIO` publicados para web con fotografías reales (ej. `Backing Floral` en `Eventos y Ceremonias`).
3. **Buscador limitado a 3 campos superficiales:**
   - `VitrinaCatalogoTinkay.tsx` (y `VitrinaComercialVisual.tsx` / `ConsolaGestionCatalogo.tsx` en `@eco/comercio`) buscaba únicamente coincidencias literales en `nombre`, `descripcionCorta` y `etiquetas`. Al buscar `"condole"` / `"condolencias"`, productos como `Corona` (3 variantes), `Pedestal Floral` (2 variantes) y `Detalle Floral` quedaban fuera porque tenían `etiquetas: []` y su clasificación residía en `categoriaNombre` (`Condolencias & Funerarios`), `usos` (`["🕊️_condolencias"]` / `["condolencias"]`) y `beneficios`.

## Solución Implementada

- **`apps/tinkay-web/modulos/ecommerce/filtrado-catalogo.ts`**: Motor puro de normalización (sin tildes, puntuación ni emojis), expansión de usos y sinónimos naturales en español, separación estricta entre categorías de colección/formato vs. ocasión, e indexación integral de toda la ficha de producto y variante (nombre maestro e individual, SKU, categoría, palabras clave de categoría, usos maestros y por variante, ocasión recomendada, descripciones cortas y largas, beneficios, receta floral, tallos, etiquetas, requisitos y precios).
- **`apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts`**: Priorización directa de `com_categoria` desde Supabase, soporte de vigencia temporal, inclusión de servicios publicados con galería/canal web (`Eventos y Ceremonias`), preservación de usos reales sin inyección artificial y lectura de usos personalizados por variante.
- **`contexto-carrito.tsx`, `EncabezadoEcommerce.tsx`, `VitrinaCatalogoTinkay.tsx`, `CarruselHeroDestacados.tsx`, `app/page.tsx`, `estilos-ecommerce.css`**: Estado compartido de categoría y búsqueda, enlaces superiores dinámicos con resaltado activo y auto-conmutación inteligente a `Todo el Catálogo` cuando una búsqueda desde otra pestaña tiene coincidencias globales.
- **`packages/comercio` y `packages/agentes-ia`**: Homologación del buscador multidimensional (`productoCatalogoCoincideBusqueda` y `mcp-catalogo.ts`) con pruebas unitarias en Vitest.

