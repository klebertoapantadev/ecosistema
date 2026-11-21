# Cierre de tarea — Optimización de Entrega Inmediata y Catálogo Comercial Móvil

**Fecha:** 2026-11-21  
**Alcance:** `TNK-001`, `TNK-005`, `PLT-009` (`@eco/comercio`, `tinkay-web`, `margaritas-web`, `tranqi-web`, `supabase/migrations`)

## Cambios realizados

1. **Entrega Inmediata (`ConsolaEntregaInmediata.tsx`, `tinkay-web` y `margaritas-web` `/panel/entrega-inmediata`):**
   - Eliminadas las leyendas explicativas redundantes, encabezado interno duplicado y el botón `Actualizar`.
   - Compactados márgenes, títulos (`Entrega Inmediata (1–2h)`) y controles táctiles para operadores en móvil.
   - Incorporado selector desplegable de ayuda rápida (`SelectConBuscador`) en el campo **Producto** con:
     - `Abanico Condolencias XL ($45)` (actualiza precio a `45`)
     - `Pedestal Condolencias XL ($50)` (actualiza precio a `50`)
     - `Bouquet Coreano M`
     - `Otros` (enfoca el campo editable)
   - Todos los campos (`nombre`, `precio`, `antes`, `cantidad`, `detalle`) permanecen 100% editables.
   - Asignación automática del uso existente `"condolencias"` (`🕊️ Condolencias / Duelo`) en `pro_detalle_producto.usos` cuando el nombre contiene `"condolencias"` (o `"condolencia"`), tanto en SQL (`supabase/migrations/20261121000001_entrega_inmediata_usos_condolencias.sql`, incluyendo backfill idempotente de registros existentes) como mediante respaldo resiliente en `publicarEntregaInmediataAction`.

2. **Catálogo Comercial (`CatalogoProductosComercio.tsx`, `tinkay-web/app/panel/catalogo-productos/page.tsx`, `tranqi-web/modulos/comercio/componentes/CatalogoProductosComercio.tsx`):**
   - Eliminados/ocultos los botones de pestañas `Catálogo y Diseños` / `Disponibilidad Taller (Rosas y Papel)` en móvil y floristería.
   - Ocultos en **todas las pantallas** (móvil, tablet y escritorio) los botones de `Guía / Manual de Uso` y `Actualizar`.
   - Eliminadas etiquetas técnicas/leyendas superiores y priorizados **rieles de botones lineales deslizables** (`.catalogo-riel-deslizable`) para barra de acciones, filtro combinado estado/canal, colecciones, canales y **variantes/tamaños** en tarjetas.
   - Ocultado el botón separado `Editar` (y flechas apiladas) en las variantes de las tarjetas: en modo `Configuración`, tocar cualquier variante abre directamente `ModalEditarProducto` sobre esa variante; en `Vista Cliente`, solo selecciona y previsualiza.

3. **Configuración de Productos (`BarraPasosWizardProducto.tsx`, `ModalEditarProducto.tsx`, `apps/tranqi-web/.../ModalEditarProducto.tsx`):**
   - Cabecera oscura de `ModalEditarProducto` compactada a 1 sola línea (título + `X`, sin `CAPA 2`, UUID/slug ni `Manual`), seguida de un **único riel lineal deslizable** (`.modal-riel-deslizable`) que unifica `Master`, cada variante con su PVP y `+ Variante` sin barras duplicadas ni tarjetas apiladas.
   - Barra inferior de acciones de `ModalEditarProducto` simplificada a una sola fila con botones de **solo íconos** (`42×42px`: `Trash2`, `X`, `ArrowLeft`/`ArrowRight`, `Save`) con `title`/`aria-label`, solicitando **confirmación en popup** (`role="alertdialog"`) antes de guardar, descartar/salir o eliminar producto/variante.
   - `SelectorEncuadreFoto` oculto por completo en móviles (`<= 640px`) y colapsado por defecto en web tras un botón `Avanzado` (`Ocultar` al expandir).
   - Todas las opciones heredables en variantes (`Tarifa IVA SRI`, `Fotos del Tamaño`, `Álbum de Muestras`, `Tiempo de Entrega`, `Beneficios y Contenido`, `Usos y Ocasiones`) muestran su valor heredado efectivo en una fila compacta con botón `Editar`, permaneciendo colapsadas mientras heredan del Master.

4. **Pruebas y gobernanza:**
   - Pruebas unitarias en `packages/comercio/src/operaciones-taller.test.ts` (98/98 pasando).
   - Actualizada la especificación funcional en `gobernanza/productos/tinkay/especificacion-funcional.md`.
