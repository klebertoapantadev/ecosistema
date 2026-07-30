# ADR-0004: DataGrid transversal (`@eco/datagrid`) como implementación de PLT-011 regla 2

**Fecha:** 2026-07-30
**Estado:** aceptada

## Contexto

`especificacion-funcional.md` (plataforma) v1.7 formaliza PLT-011 regla 2, el "Estándar Interactivo de
DataGrids y Tablas de Datos en Widgets": todo widget con listado tabular debe tener filtro server-side
(Criterio 1), búsqueda instantánea client-side sobre todo lo ya traído (Criterio 2), columnas ordenables,
reordenables por drag, agrupables por drag, y exportación nativa a Excel/CSV. Antes de este ADR, ningún
widget del ecosistema tenía esto — Auditoría, Socios y Usuarios eran `<table>`/`<details>` planas sin
filtro, sin orden, sin export, y no existía ninguna dependencia de grid/export en el repo.

El usuario reportó además que Auditoría (Tranqi) no mostraba eventos de identidad de plataforma (alta de
usuario, verificación de correo, recuperación de contraseña) porque esos eventos viven en
`comun_seguridad`, no en el esquema del negocio — ver la función SQL nueva descrita abajo, que resuelve
ambos huecos a la vez.

## Decisión

1. **Nuevo paquete `@eco/datagrid`** — un único componente cliente reutilizable (`<DataGrid columnas={}
   filas={} idFila={} nombreExportacion={} contenidoExpandible={} />`) que implementa las 6 capacidades de
   PLT-011 regla 2 sobre el dataset ya filtrado por el servidor. El formulario de filtro server-side
   (Criterio 1) NO vive en este paquete — cada widget arma el suyo (campos distintos por contexto), mismo
   patrón ya establecido con `.form-busqueda`/`buscarUsuarios(consulta, negocio)`.
2. **Dependencias nuevas, todas headless (sin CSS propio)** — consistente con la regla de "sin librería de
   componentes visuales" de `sistema-visual.md`, que aplica a apariencia, no a lógica (mismo argumento que
   ya usa `packages/primitivas` para nombrar Radix UI como base):
   - `@tanstack/react-table` — estado y lógica de orden/agrupamiento/filtro-global; el markup lo pinta el
     componente con las clases en español ya existentes (`.datagrid-*`).
   - `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — drag real para reordenar columnas y
     para soltar un encabezado en la zona de agrupamiento.
   - `xlsx` (SheetJS) para el `.xlsx` client-side. CSV no usa librería (join con comillas escapadas).
3. **`xlsx` se instala desde el tarball propio de SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/...tgz`),
   no desde el paquete publicado en npm.** La versión de npm (`0.18.5`) tiene 2 vulnerabilidades altas sin
   parche disponible ahí (Prototype Pollution `GHSA-4r6h-8v6p-xvw6`, ReDoS `GHSA-5pgg-2g8v-p4x9` — ambas
   listadas como "Patched versions: <0.0.0" en `pnpm audit`, es decir, sin fix publicado en el registro).
   SheetJS dejó de publicar versiones parcheadas en npm por una disputa pasada y distribuye los fixes reales
   solo desde su propio CDN — esta es la vía oficialmente documentada por el proyecto, no un workaround
   improvisado. Se evaluó `exceljs` como alternativa 100% npm, pero se descartó por el riesgo de bundling
   en cliente (depende de módulos internos de Node como `fs`/`stream` no pensados para navegador) frente al
   beneficio marginal de evitar un tarball externo ya verificado y con checksum estable.
4. **Frontera Server/Client Component respetada explícitamente.** El primer intento pasaba las columnas
   (con funciones `valor`/`render`) y callbacks (`idFila`, `contenidoExpandible`) directo desde un Server
   Component (`page.tsx`) a `<DataGrid>` (Client Component) — Next.js no permite serializar funciones a
   través de esa frontera, y el error solo aparece en runtime de producción (la ruta es dinámica, nunca se
   renderiza en build). Se corrigió moviendo la definición de columnas y el contenido expandible a un
   componente cliente intermedio (`TablaAuditoria.tsx`); el Server Component solo pasa datos serializables
   (`registros: RegistroAuditoria[]`). Este patrón — Server Component hace la consulta y pasa datos planos,
   un Client Component intermedio arma las `columnas` con sus funciones y renderiza `<DataGrid>` — es el
   que debe replicarse en cada widget nuevo que use `@eco/datagrid`.
5. **Primer consumidor: Auditoría de Tranqi**, respaldada por la función SQL nueva
   `comun_auditoria.aud_fn_listar_auditoria_negocio(p_negocio, p_esquema_negocio, ...)` — unifica en un
   solo `returns table(...)` (primer precedente de este patrón en el proyecto) las filas del esquema propio
   del negocio con las de `comun_seguridad` (alta de usuario, membresía, OTP de correo, recuperación de
   contraseña), acotadas por `exists (select 1 from comun_seguridad.seg_membresia ...)` a solo los usuarios
   con membresía activa en ese negocio. `security definer` con autorización propia
   (`seg_fn_es_admin_negocio`), porque la política RLS existente de `aud_registro` no cubre
   `comun_seguridad` para roles de negocio.
6. **Sin paginación por cursor.** El rango de fechas del filtro server-side (Criterio 1) mantiene el set
   acotado (`limit` simple, `p_limite` default 500); todo lo demás es 100% client-side, como pide la spec.
7. **Un solo `DndContext` para reordenar Y agrupar columnas — no dos anidados.** El primer intento envolvía
   `<ZonaAgrupamiento>` en un `DndContext` externo y los `<th>` en uno interno (para el `SortableContext`
   de reordenamiento). `useSortable`/`useDraggable` solo se conectan al `DndContext` más cercano en el
   árbol de React, así que el gesto de arrastre de un header nunca podía llegar al contexto externo —
   agrupar por drag era físicamente inalcanzable, aunque la UI (zona de drop, chips) se veía correcta.
   Verificado con eventos de puntero sintéticos (`pointerdown`/`pointermove`/`pointerup` vía
   `dispatchEvent`, simulando el gesto real): reordenar funcionaba, agrupar nunca disparaba su callback.
   Corregido unificando en un solo `DndContext` con un `onDragEnd` que distingue el destino
   (`over.id === "zona-agrupamiento"` agrupa, cualquier otra columna reordena). Cualquier widget nuevo que
   toque `DataGrid.tsx` debe mantener un único `DndContext` para ambos gestos.

8. **La zona de agrupamiento gana la colisión por puntero, no por `closestCenter`; y agrupar tiene además
   un botón.** Unificar el `DndContext` (Decisión 7) era necesario pero no suficiente: soltar un encabezado
   sobre la zona seguía sin agrupar. Causa real: `collisionDetection={closestCenter}` compara centro contra
   centro, y la zona es una caja de ancho completo (~1200 px) cuyo centro queda más lejos del encabezado
   arrastrado que el centro de la columna vecina. La zona nunca ganaba la colisión, así que `onDragEnd`
   jamás veía `over.id === "zona-agrupamiento"`. Confirmado en runtime leyendo la live region de dnd-kit
   durante el gesto: `"Draggable item tabla was moved over droppable area fecha."` — la columna vecina, con
   el cursor ya dentro de la zona. Se reemplazó por una detección propia: si el puntero está dentro de la
   zona, o si el centro de la columna arrastrada subió hasta la banda, la colisión es la zona; en cualquier
   otro caso cae a `closestCenter`, que sí es lo correcto para reordenar entre columnas de tamaño parecido.
   Como el arrastre además no es alcanzable con teclado ni cómodo en táctil, **cada encabezado lleva un
   botón `+`/`−` (`aria-pressed`) que agrega o quita esa columna del agrupamiento** — misma acción, dos
   caminos, y el camino accesible no depende de que la detección de colisión acierte. Lección: al mezclar un
   droppable de ancho completo con droppables angostos en un mismo `DndContext`, `closestCenter` a secas es
   siempre la elección equivocada.
9. **Correcciones colaterales encontradas al habilitar el agrupamiento de verdad** (ninguna era visible
   mientras agrupar estaba roto):
   - *Contador de grupo.* Mostraba `subRows.length`; con agrupamiento anidado esos son los subgrupos, no las
     filas, y `getLeafRows()` mezcla ambos. Se cuenta `getLeafRows().filter(f => !f.getIsGrouped())`.
   - *Exportación.* `getRowModel()` solo lista las subfilas de los grupos expandidos, así que exportar con
     grupos colapsados perdía filas. Ahora se baja a las hojas antes de armar el `.xlsx`/`.csv`, y el archivo
     siempre lleva el dataset filtrado completo sin importar qué grupos estén abiertos.
   - *Hidratación.* `DndContext` sin `id` numera sus `aria-describedby` con un contador global que no coincide
     entre servidor y cliente: error de hidratación en cada carga. Se le pasa un `useId()`.
   - *Táctil.* El handle de arrastre necesita `touch-action: none` o el gesto no arranca en pantallas táctiles.

## Alternativas evaluadas

| Alternativa | Por qué no se eligió |
| :--- | :--- |
| AG Grid / Mantine DataTable / MUI DataGrid | Traen su propio sistema visual (CSS/theming), choca con la regla de "sin librería de componentes visuales" de `sistema-visual.md` — el ecosistema pinta su propio look con clases en español. |
| `exceljs` en vez del tarball de SheetJS | 100% npm, pero pensado primero para Node; su bundling en un Client Component de Next.js arrastra dependencias de `fs`/`stream` no resueltas de forma limpia en navegador. El tarball de SheetJS es la vía oficial del propio proyecto y evita ese riesgo. |
| Reset password/session-based reload en vez de frontera Server/Client explícita | Ocultar el error en vez de corregir la causa — el patrón correcto (Server Component pasa datos, Client Component arma columnas) es el que debe repetirse en cada widget nuevo. |

## Consecuencias

- Cualquier widget tabular nuevo (Gestión de Usuarios es el siguiente candidato natural, luego catálogos y
  pedidos de comercio) reutiliza `@eco/datagrid` sin rediseñar la interacción — solo define sus propias
  columnas y su propio formulario de filtro server-side, siguiendo el patrón Server/Client de la Decisión 4.
- `pnpm-lock.yaml` referencia una URL externa (CDN de SheetJS) para `xlsx` en vez de una versión de npm —
  documentado aquí para que no se lea como una anomalía en una futura auditoría del lockfile.
- La función SQL `aud_fn_listar_auditoria_negocio` es el primer precedente de `returns table(...)` en
  `supabase/migrations/` — sirve de referencia para futuras consultas que unifiquen filas de más de un
  esquema.
