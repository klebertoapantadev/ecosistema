"use client";

import { Fragment, useMemo, useState } from "react";
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
import { DndContext, useDroppable, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as XLSX from "xlsx";

// Widget único y transversal (PLT-011 regla 2): server-side ya filtró el
// dataset (rango de fechas, correo, etc. -- eso lo arma cada pagina en su
// propio formulario, este componente no lo sabe). Lo que sigue es 100%
// client-side sobre lo ya traido: busqueda global, orden, reordenar
// columnas (drag), agrupar (drag a la zona de arriba), exportar.
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

  function alTerminarArrastreColumna(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    setOrdenColumnas((actual) => {
      const desde = actual.indexOf(String(active.id));
      const hasta = actual.indexOf(String(over.id));
      return arrayMove(actual, desde, hasta);
    });
  }

  function alSoltarEnZonaAgrupamiento(evento: DragEndEvent) {
    const columnaId = String(evento.active.id);
    if (evento.over?.id !== "zona-agrupamiento" || agrupamiento.includes(columnaId)) return;
    setAgrupamiento((actual) => [...actual, columnaId]);
  }

  function quitarAgrupamiento(columnaId: string) {
    setAgrupamiento((actual) => actual.filter((id) => id !== columnaId));
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
    const cuerpo = tabla
      .getRowModel()
      .rows.filter((f) => !f.getIsGrouped())
      .map((f) => columnas.map((c) => String(c.valor(f.original))));
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

      <DndContext collisionDetection={closestCenter} onDragEnd={alSoltarEnZonaAgrupamiento}>
        <ZonaAgrupamiento columnas={columnas} agrupamiento={agrupamiento} onQuitar={quitarAgrupamiento} />

        <div className="datagrid-envoltura">
          <table className="datagrid-tabla">
            <thead>
              <DndContext collisionDetection={closestCenter} onDragEnd={alTerminarArrastreColumna}>
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
                      />
                    ))}
                  </tr>
                </SortableContext>
              </DndContext>
            </thead>
            <tbody>
              {tabla.getRowModel().rows.map((fila) => {
                if (fila.getIsGrouped()) {
                  return (
                    <tr key={fila.id} className="datagrid-fila-grupo">
                      <td colSpan={columnas.length + (contenidoExpandible ? 1 : 0)}>
                        <button type="button" className="datagrid-toggle-grupo" onClick={fila.getToggleExpandedHandler()}>
                          {fila.getIsExpanded() ? "▾" : "▸"} {String(fila.getValue(fila.groupingColumnId ?? ""))} ({fila.subRows.length})
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
  const { setNodeRef, isOver } = useDroppable({ id: "zona-agrupamiento" });
  return (
    <div ref={setNodeRef} className={`datagrid-zona-agrupamiento${isOver ? " datagrid-zona-agrupamiento-activa" : ""}`}>
      {agrupamiento.length === 0 ? (
        <span className="datagrid-zona-vacia">Arrastra una columna aquí para agrupar</span>
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
}: {
  id: string;
  titulo: string;
  ordenActual: false | "asc" | "desc";
  alOrdenar?: (evento: unknown) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const estilo = { transform: CSS.Transform.toString(transform), transition };
  return (
    <th ref={setNodeRef} style={estilo} className="datagrid-th">
      <span className="datagrid-th-arrastrar" {...attributes} {...listeners} title="Arrastra para reordenar">
        ⠿
      </span>
      <button type="button" className="datagrid-th-boton" onClick={alOrdenar} disabled={!alOrdenar}>
        {titulo}
        {ordenActual === "asc" && " ▲"}
        {ordenActual === "desc" && " ▼"}
      </button>
    </th>
  );
}
