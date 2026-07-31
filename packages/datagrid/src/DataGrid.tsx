"use client";

import { Fragment, useCallback, useId, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type GroupingState,
} from "@tanstack/react-table";
import { DndContext, useDroppable, type CollisionDetection, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as XLSX from "xlsx";

const ID_ZONA = "zona-agrupamiento";

// Widget único y transversal (PLT-011 regla 2): server-side ya filtró el
// dataset (rango de fechas, correo, etc. -- eso lo arma cada pagina en su
// propio formulario, este componente no lo sabe). Lo que sigue es 100%
// client-side sobre lo ya traido: busqueda global, orden, reordenar
// columnas (drag), agrupar (drag a la zona de arriba o boton + del
// encabezado), exportar.
//
// `valor()` es lo que se busca/ordena/exporta (texto/numero plano);
// `render()` es opcional para una presentacion mas rica (chip, icono) --
// si falta, se muestra `valor()` tal cual. No importa `next/*`: portable a
// Capacitor si algun dia una app nativa lo necesita (ver §8 de
// gobernanza/estandares/01-convenciones-codificacion.md).
export interface ColumnaDataGrid<T> {
  id: string;
  encabezado: string;
  valor: (fila: T) => string | number;
  render?: (fila: T) => React.ReactNode;
  ordenable?: boolean;
}

export interface DataGridProps<T> {
  columnas: ColumnaDataGrid<T>[];
  filas: T[];
  idFila: (fila: T) => string;
  nombreExportacion: string;
  contenidoExpandible?: (fila: T) => React.ReactNode;
}

export function DataGrid<T>({ columnas, filas, idFila, nombreExportacion, contenidoExpandible }: DataGridProps<T>) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<SortingState>([]);
  const [agrupamiento, setAgrupamiento] = useState<GroupingState>([]);
  const [ordenColumnas, setOrdenColumnas] = useState<string[]>(columnas.map((c) => c.id));
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // Sin un id propio, dnd-kit numera sus `aria-describedby` con un contador
  // global que no coincide entre servidor y cliente y React tira un error de
  // hidratacion en cada carga. `useId` si es estable entre ambos.
  const idDnd = useId();

  const definicionColumnas = useMemo<ColumnDef<T>[]>(
    () =>
      columnas.map((c) => ({
        id: c.id,
        header: c.encabezado,
        accessorFn: c.valor,
        cell: (info) => (c.render ? c.render(info.row.original) : String(info.getValue())),
        enableSorting: c.ordenable ?? true,
        enableGrouping: true,
      })),
    [columnas],
  );

  const tabla = useReactTable({
    data: filas,
    columns: definicionColumnas,
    state: { sorting: orden, grouping: agrupamiento, globalFilter: busqueda, columnOrder: ordenColumnas },
    onSortingChange: setOrden,
    onGroupingChange: setAgrupamiento,
    onGlobalFilterChange: setBusqueda,
    onColumnOrderChange: setOrdenColumnas,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (fila) => idFila(fila),
    autoResetExpanded: false,
  });

  // La zona de agrupamiento es una caja ancha (100% del grid) y las columnas
  // son angostas: con `closestCenter` a secas el centro de la zona queda mas
  // lejos del centro de la columna arrastrada que el de la columna vecina, asi
  // que la zona NUNCA gana la colision y soltar encima de ella no agrupaba.
  // Por eso primero preguntamos si el puntero esta literalmente dentro de la
  // zona; solo si no lo esta caemos a `closestCenter`, que es lo correcto para
  // reordenar entre columnas de tamaño parecido.
  const deteccionColision = useCallback<CollisionDetection>((argumentos) => {
    const zonaRect = argumentos.droppableRects.get(ID_ZONA);
    if (zonaRect) {
      const punto = argumentos.pointerCoordinates;
      const bajoElPuntero =
        punto != null &&
        punto.x >= zonaRect.left &&
        punto.x <= zonaRect.left + zonaRect.width &&
        punto.y >= zonaRect.top &&
        punto.y <= zonaRect.top + zonaRect.height;
      // La zona vive justo encima de la fila de encabezados: si el centro de la
      // columna arrastrada subio hasta la banda, la intencion es agrupar.
      // Reordenar es un gesto horizontal, asi que no se pisan.
      const centroVertical = argumentos.collisionRect.top + argumentos.collisionRect.height / 2;
      const subioALaBanda = centroVertical < zonaRect.top + zonaRect.height;
      if (bajoElPuntero || subioALaBanda) {
        const contenedorZona = argumentos.droppableContainers.find((contenedor) => contenedor.id === ID_ZONA);
        if (contenedorZona) return [{ id: ID_ZONA, data: { droppableContainer: contenedorZona, value: 0 } }];
      }
    }
    return closestCenter(argumentos);
  }, []);

  // Un solo DndContext maneja ambos gestos sobre el mismo handle de columna:
  // soltar sobre "zona-agrupamiento" agrupa, soltar sobre otra columna
  // reordena. Dos DndContext anidados (uno para cada gesto) no funciona --
  // useSortable solo se conecta al DndContext mas cercano, asi que el gesto
  // nunca llega al contexto externo.
  function alTerminarArrastre(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;
    const columnaId = String(active.id);
    if (over.id === ID_ZONA) {
      if (!agrupamiento.includes(columnaId)) setAgrupamiento((actual) => [...actual, columnaId]);
      return;
    }
    if (active.id === over.id) return;
    setOrdenColumnas((actual) => {
      const desde = actual.indexOf(columnaId);
      const hasta = actual.indexOf(String(over.id));
      return arrayMove(actual, desde, hasta);
    });
  }

  function quitarAgrupamiento(columnaId: string) {
    setAgrupamiento((actual) => actual.filter((id) => id !== columnaId));
  }

  // El arrastre no es alcanzable con teclado ni comodo en tactil, asi que cada
  // encabezado ofrece ademas un boton que agrega/quita esa columna del
  // agrupamiento. Misma accion, dos caminos.
  function alternarAgrupamiento(columnaId: string) {
    setAgrupamiento((actual) =>
      actual.includes(columnaId) ? actual.filter((id) => id !== columnaId) : [...actual, columnaId],
    );
  }

  function alternarExpandida(id: string) {
    setExpandidas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function filasParaExportar(): string[][] {
    const encabezados = columnas.map((c) => c.encabezado);
    // Con agrupamiento activo, `getRowModel()` solo lista las subfilas de los
    // grupos expandidos: exportar tal cual perderia todo lo colapsado. Bajamos
    // a las hojas para que el archivo siempre lleve el dataset filtrado
    // completo, sin importar que grupos esten abiertos.
    const hojas: T[] = [];
    const recorrer = (filas: { getIsGrouped: () => boolean; subRows: unknown[]; original: T }[]) => {
      for (const fila of filas) {
        if (fila.getIsGrouped()) recorrer(fila.subRows as typeof filas);
        else hojas.push(fila.original);
      }
    };
    recorrer(tabla.getRowModel().rows);
    const cuerpo = hojas.map((fila) => columnas.map((c) => String(c.valor(fila))));
    return [encabezados, ...cuerpo];
  }

  function exportarExcel() {
    const hoja = XLSX.utils.aoa_to_sheet(filasParaExportar());
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Datos");
    XLSX.writeFile(libro, `${nombreExportacion}.xlsx`);
  }

  function exportarCsv() {
    const filasTexto = filasParaExportar();
    const csv = filasTexto.map((fila) => fila.map((celda) => `"${celda.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `${nombreExportacion}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <div className="datagrid">
      <div className="datagrid-toolbar">
        <input
          type="search"
          className="datagrid-busqueda"
          placeholder="Buscar en todo lo que ves…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="datagrid-exportar">
          <button type="button" className="btn-mini" onClick={exportarExcel}>
            Exportar a Excel
          </button>
          <button type="button" className="btn-mini" onClick={exportarCsv}>
            Exportar a CSV
          </button>
        </div>
      </div>

      <DndContext id={idDnd} collisionDetection={deteccionColision} onDragEnd={alTerminarArrastre}>
        <ZonaAgrupamiento columnas={columnas} agrupamiento={agrupamiento} onQuitar={quitarAgrupamiento} />

        <div className="datagrid-envoltura">
          <table className="datagrid-tabla">
            <thead>
              <SortableContext items={ordenColumnas} strategy={horizontalListSortingStrategy}>
                <tr>
                  {contenidoExpandible && <th className="datagrid-th-expandir" />}
                  {tabla.getHeaderGroups()[0]?.headers.map((encabezado) => (
                    <EncabezadoArrastrable
                      key={encabezado.id}
                      id={encabezado.id}
                      titulo={String(encabezado.column.columnDef.header)}
                      ordenActual={encabezado.column.getIsSorted()}
                      alOrdenar={encabezado.column.getCanSort() ? encabezado.column.getToggleSortingHandler() : undefined}
                      agrupada={agrupamiento.includes(encabezado.column.id)}
                      alAgrupar={() => alternarAgrupamiento(encabezado.column.id)}
                    />
                  ))}
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {tabla.getRowModel().rows.map((fila) => {
                if (fila.getIsGrouped()) {
                  return (
                    <tr key={fila.id} className="datagrid-fila-grupo">
                      <td colSpan={columnas.length + (contenidoExpandible ? 1 : 0)}>
                        <button type="button" className="datagrid-toggle-grupo" onClick={fila.getToggleExpandedHandler()}>
                          {/* Con agrupamiento anidado `subRows` son los subgrupos y `getLeafRows()`
                              mezcla subgrupos con filas: ambos mienten. Contamos solo hojas reales. */}
                          {fila.getIsExpanded() ? "▾" : "▸"} {String(fila.getValue(fila.groupingColumnId ?? ""))} (
                          {fila.getLeafRows().filter((hoja) => !hoja.getIsGrouped()).length})
                        </button>
                      </td>
                    </tr>
                  );
                }
                const expandidaAhora = expandidas.has(fila.id);
                return (
                  <Fragment key={fila.id}>
                    <tr>
                      {contenidoExpandible && (
                        <td className="datagrid-td-expandir">
                          <button type="button" className="datagrid-boton-expandir" onClick={() => alternarExpandida(fila.id)}>
                            {expandidaAhora ? "▾" : "▸"}
                          </button>
                        </td>
                      )}
                      {fila.getVisibleCells().map((celda) => (
                        <td key={celda.id}>{flexRender(celda.column.columnDef.cell, celda.getContext())}</td>
                      ))}
                    </tr>
                    {contenidoExpandible && expandidaAhora && (
                      <tr className="datagrid-fila-detalle">
                        <td colSpan={columnas.length + 1}>{contenidoExpandible(fila.original)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </DndContext>

      {filas.length === 0 && <p className="historial-fecha">Sin resultados.</p>}
    </div>
  );
}

function ZonaAgrupamiento<T>({
  columnas,
  agrupamiento,
  onQuitar,
}: {
  columnas: ColumnaDataGrid<T>[];
  agrupamiento: string[];
  onQuitar: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ID_ZONA });
  return (
    <div ref={setNodeRef} className={`datagrid-zona-agrupamiento${isOver ? " datagrid-zona-agrupamiento-activa" : ""}`}>
      {agrupamiento.length === 0 ? (
        <span className="datagrid-zona-vacia">Arrastra una columna aquí, o usa el + del encabezado, para agrupar</span>
      ) : (
        agrupamiento.map((id) => {
          const columna = columnas.find((c) => c.id === id);
          return (
            <span key={id} className="datagrid-chip-agrupado">
              {columna?.encabezado ?? id}
              <button type="button" onClick={() => onQuitar(id)} aria-label={`Quitar agrupamiento por ${columna?.encabezado}`}>
                ×
              </button>
            </span>
          );
        })
      )}
    </div>
  );
}

function EncabezadoArrastrable({
  id,
  titulo,
  ordenActual,
  alOrdenar,
  agrupada,
  alAgrupar,
}: {
  id: string;
  titulo: string;
  ordenActual: false | "asc" | "desc";
  alOrdenar?: (evento: unknown) => void;
  agrupada: boolean;
  alAgrupar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const estilo = { transform: CSS.Transform.toString(transform), transition };
  return (
    <th ref={setNodeRef} style={estilo} className="datagrid-th">
      <span className="datagrid-th-arrastrar" {...attributes} {...listeners} title="Arrastra para reordenar o agrupar">
        ⠿
      </span>
      <button type="button" className="datagrid-th-boton" onClick={alOrdenar} disabled={!alOrdenar}>
        {titulo}
        {ordenActual === "asc" && " ▲"}
        {ordenActual === "desc" && " ▼"}
      </button>
      <button
        type="button"
        className={`datagrid-th-agrupar${agrupada ? " datagrid-th-agrupar-activa" : ""}`}
        onClick={alAgrupar}
        aria-pressed={agrupada}
        title={agrupada ? `Quitar agrupamiento por ${titulo}` : `Agrupar por ${titulo}`}
      >
        {agrupada ? "−" : "+"}
      </button>
    </th>
  );
}
