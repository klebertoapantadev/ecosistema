# 2026-11-26 — Auditoría de ortografía y terminología del catálogo Tinkay

## Objetivo
Revisar nombres, descripciones, beneficios y recetas de todos los productos y variantes de Tinkay (en base de datos Supabase y en el repositorio), corrigiendo ortografía, acentuación, puntuación y estandarizando la terminología comercial:
- Prohibir `"rosas de exportación"` / `"flores de exportación"` → reemplazar por `"rosas seleccionadas"` (o `"flores naturales"`).
- Prohibir `"follajes finos"` / `"follaje fino"` → reemplazar por `"follaje natural"`.
- Estandarizar descripciones breves de cantidad como `"Aprox. #40 Rosas."` o `"Aporx. 25 rosas clasificadas."` → `"Aprox. 40 rosas seleccionadas con follaje natural."`

## Cambios realizados

### 1. Base de datos Supabase (`ecosistema` / `oaybbpdxhlxjbpwnoymy`)
- Migración creada y aplicada en vivo: `supabase/migrations/20261126000003_tinkay_correccion_ortografia_y_terminologia_catalogo.sql`.
- Correcciones aplicadas sobre 24 productos/variantes de `comun_comercio.com_producto`, `comun_comercio.com_variante` y `comun_comercio.com_categoria`:
  - Ortografía y tildes: `Box corazon` → `Box Corazón`, `Corazon` → `Corazón`, `Orquidea` → `Orquídea`, `Flloral` → `Floral`, `Aporx.` → `Aprox.`, `cilindricas`/`rigidas` → `cilíndricas`/`rígidas`, `armoniza` → `armoniosa`, concordancia (`elaborado` → `elaborada`, `No requieren` → `No requiere`, `Globos burbuja personalizado` → `globo burbuja personalizado`), espaciado (`Corona  XXL`, `◽con`, `2mX 2m`), puntuación y mayúsculas (`Febrero` → `febrero`, `Porta-tarjeta` → `Portatarjeta`, `Números de luces` → `Números de Luces`).
  - Terminología comercial: eliminación del 100% de ocurrencias de `"rosas de exportación"` y `"follajes finos"` / `"follaje fino"` en `pro_descripcion`, `pro_detalle_producto`, `var_detalle_variante` (`beneficios_custom`, `receta_bom`, `detalle`).
  - Formato uniforme de cantidades: `"Aprox. #40 Rosas."` → `"Aprox. 40 rosas seleccionadas con follaje natural."` y equivalentes en `box-florales`, `tinkay-bouq-mix`, `tinkay-bouq-florero`, `tinkay-bouq-san-valentin`, `aro-floral`, `corazon`, `detalle`, `orquideas-3` y `pedestal-floral`.

### 2. Código del repositorio (`apps/tinkay-web` y `packages/comercio`)
- `apps/tinkay-web/modulos/ecommerce/datos-catalogo.ts`
- `apps/tinkay-web/modulos/ecommerce/filtrado-catalogo.ts`
- `apps/tinkay-web/modulos/ecommerce/metadata-ecommerce.ts`
- `apps/tinkay-web/modulos/ecommerce/servicio-catalogo.ts`
- `apps/tinkay-web/modulos/ecommerce/componentes/CarruselHeroDestacados.tsx`
- `apps/tinkay-web/modulos/ecommerce/componentes/ChatAriaFlotante.tsx`
- `apps/tinkay-web/modulos/ecommerce/componentes/DrawerCarritoFloristeria.tsx`
- `apps/tinkay-web/modulos/ecommerce/componentes/LandingEcommerceTinkay.tsx`
- `packages/comercio/src/acciones.ts`
- `packages/comercio/src/componentes/ModalCrearProducto.tsx`
- `packages/comercio/src/componentes/ModalEditarProducto.tsx`

## Verificación
- Auditoría SQL post-migración en Supabase: 0 coincidencias restantes de términos prohibidos o erratas detectadas en `com_producto` / `com_variante` (`negocio = 'tinkay'`).
- Grep en `apps/tinkay-web` y `packages/comercio/src`: 0 coincidencias de términos prohibidos.
- `pnpm --filter @eco/comercio test`, `pnpm --filter @eco/comercio typecheck`, `pnpm --filter tinkay-web typecheck`, `pnpm --filter tinkay-web build`.

---

## Mejora adicional — Legibilidad de cards de operador (`CatalogoProductosComercio.tsx`)
- **Grilla de operador más amplia**: `minmax(min(340px, 100%), 1fr)` en `modoVista === "admin"` para evitar tarjetas comprimidas.
- **Barra superior dedicada de acciones** (`Activo`, `En Canal`, `Destacado`, `Link`, `Copiar`, `Editar`): movida a una franja superior limpia fuera de la foto, evitando desbordes por el borde izquierdo y sin tapar la etiqueta de la foto activa.
- **Canales de visibilidad sin recorte horizontal**: reemplazado `catalogo-riel-deslizable` (`nowrap`) por `flex-wrap: wrap` para ver todos los canales simultáneamente.
- **Variantes y tamaños visibles de un vistazo**:
  - En modo operador (`admin`), todas las variantes se muestran en lista vertical estructurada (nombre completo, SKU, resumen de receta/características propias, precio y botón `✏️` dedicado para editar).
  - Tocar una variante ahora la selecciona en la tarjeta (actualizando foto, desglose de precio y características) sin abrir forzadamente el modal de edición.
  - En modo cliente, las variantes usan `flex-wrap: wrap` sin recorte horizontal.
- **Características / ¿Qué incluye? y Composición**:
  - Se corrige la resolución de `beneficios_custom` cuando `beneficios_modo` no estaba explícito o cuando el producto master no tenía beneficios propios (ej. `Box Florales`).
  - Se muestran también `receta_bom`, `detalle`, `SKU` y `tallos` de la variante seleccionada, indicando la variante activa en el encabezado del bloque.
- **Otros ajustes visuales**: deduplicación de `cobertura_texto` en el badge logístico y separación vertical de los puntos del carrusel respecto a los badges inferiores de la imagen.
