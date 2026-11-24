# Cierre de Tarea — Copiar Configuración de Producto + Exportación e Importación Masiva (MD / Excel) para Análisis IA

**Fecha:** 2026-11-24  
**Requerimientos:** `PLT-009`  
**Rama:** `master`

## Qué se implementó

1. **Copiado en texto estructurado de la configuración individual de un producto (`Copiar Config`):**
   - Utilidad pura `formatearConfiguracionProductoTexto` en `packages/comercio/src/utils/catalogoMasivo.ts` que exporta en texto/Markdown limpio todos los atributos: identificación, categoría/colección, tipo de oferta, estado, destacado, IVA, canales, variantes/tamaños con precios/SKU/envoltorio/escalas, descripción, beneficios/¿qué incluye?, requisitos, personalización floral (rosas, colores, girasoles, orquídeas, tipo y colores de envoltorio), entrega/logística, ocasiones/usos, etiquetas, vigencia, combos/renta y multimedia.
   - Integrado en **3 puntos**:
     - Tarjeta de cada producto en `CatalogoProductosComercio.tsx` (vista `Configuración` de operador/administrador).
     - Cabecera de `ModalEditarProducto.tsx` (copia el estado actual en edición con todas sus variantes).
     - Cabecera de `ModalCrearProducto.tsx` (copia el borrador en vivo del asistente de creación).

2. **Visor, Exportación (Markdown `.md` y Excel `.xlsx`) e Importación Masiva (`MD / Excel`):**
   - Helper compartido de Excel multi-hoja en `packages/datagrid/src/excel.ts` (`exportarHojasAExcel` y `leerHojasDesdeExcelBuffer`, reutilizando `xlsx` 0.20.3 ya instalado en `@eco/datagrid`).
   - Motor puro en `packages/comercio/src/utils/catalogoMasivo.ts`:
     - `exportarCatalogoAMarkdown`: genera un documento `.md` determinista y apto para edición masiva con IA (preservando `pro_id` y `var_id`).
     - `construirHojasExcelCatalogo`: genera libro Excel de 2 hojas: hoja unificada `Catalogo` (cada producto en fila `MASTER` seguido inmediatamente de sus filas `VARIANTE` una debajo de otra para comparación directa) + `Guia_IA`.
     - `parsearCatalogoDesdeMarkdown` y `parsearCatalogoDesdeHojasExcel`: parseo resiliente de archivos `.md`, `.txt`, `.xlsx`, `.xls` y `.csv` (soportando hoja unificada `Catalogo` y retrocompatibilidad con el formato previo de 2 hojas `Productos` + `Variantes`).
     - `calcularPlanActualizacionMasiva`: emparejamiento seguro por `pro_id` / `slug` / `sku` / `nombre` y cálculo de diff campo por campo (`Antes → Después`) antes de guardar.
   - Modal completo `ModalExportarImportarCatalogo.tsx` accesible desde la barra de administrador de `CatalogoProductosComercio.tsx` (`MD / Excel`) con 3 pestañas: **Ver y Copiar MD**, **Exportar Archivos** (con prompt sugerido para IA) e **Importar Masivo** (subir archivo o pegar Markdown directo desde IA + vista previa de cambios seleccionables + reporte por producto).
   - Server Action `actualizarProductosMasivoAction` en `packages/comercio/src/acciones.ts` con verificación estricta de rol operador/administrador (`seg_fn_es_operador_o_admin_negocio` / membresía), actualización segura vía `editarProductoAction` y propagación explícita de resultados/errores por producto.

## Verificación ejecutada

- `pnpm --filter @eco/comercio test` — **19 archivos, 117 pruebas aprobadas** (incluyendo round-trip MD y Excel sin falsos cambios, detección de ediciones IA y manejo de IDs inexistentes en `catalogoMasivo.test.ts`).
- `typecheck` aprobado sin errores en `@eco/datagrid`, `@eco/comercio`, `tinkay-web`, `tranqi-web`, `fastfix-web` y `margaritas-web`.
- `pnpm --filter tinkay-web build` — compilación de producción exitosa.
