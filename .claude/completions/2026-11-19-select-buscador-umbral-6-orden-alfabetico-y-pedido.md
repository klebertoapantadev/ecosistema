# SelectConBuscador: Buscador solo con >6 ítems, orden alfabético y renombrar "Pedido"

- **Fecha:** 2026-11-19
- **Alcance:** `@eco/datagrid` y `@eco/comercio`

## Cambios realizados

1. **Buscador condicional en dropdownlists (`> 6` ítems):**
   - `packages/datagrid/src/SelectConBuscador.tsx`: se añadió `umbralBuscador = 6` (`mostrarBuscador = opciones.length > umbralBuscador`). Cuando la lista tiene 6 o menos opciones, la barra de búsqueda no se muestra ni se hace foco en un `<input>`, evitando que aparezca el teclado móvil innecesariamente; la navegación por teclado en escritorio sigue activa sobre el contenedor de la lista.
2. **Ordenamiento alfabético por defecto en todos los dropdownlists:**
   - `packages/datagrid/src/SelectConBuscador.tsx` y `packages/datagrid/src/index.ts`: se añadió y exportó `ordenarOpcionesSelectAlfabeticamente` (`ordenarAlfabeticamente = true` por defecto). Ordena alfabéticamente en español (`localeCompare(..., "es", { sensitivity: "base", numeric: true })`) ignorando símbolos/emojis iniciales, manteniendo arriba cualquier opción placeholder (`value === ""`) y respetando agrupación `<optgroup>`.
3. **Renombre de tipo de pedido `"Floristería / Ocasiones"` → `"Pedido"`:**
   - `packages/comercio/src/operaciones-taller.ts`: actualizado `etiqueta` y `etiquetaCorta` a `"Pedido"` manteniendo la clave interna `"FLORISTERIA_OCASIONES"` para compatibilidad con BDD; ordenados alfabéticamente los 4 tipos (`Condolencias`, `Eventos`, `Exequiales`, `Pedido`) y blindado `obtenerDefinicionClasificacionPedido` / `inferirClasificacionPedido` para buscar por clave y aceptar `"PEDIDO"`.
   - `packages/comercio/src/componentes/PantallaTvTaller.tsx`: actualizada etiqueta `"Pedido"` y orden alfabético en el desglose por tipo.
   - `packages/comercio/src/operaciones-taller.test.ts`: actualizado test unitario (9/9 aprobados).
