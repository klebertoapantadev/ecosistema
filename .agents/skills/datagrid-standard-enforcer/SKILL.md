---
name: datagrid-standard-enforcer
description: Use when creating, modifying, or refactoring data grids, table lists, or query views across ecosystem applications to ensure compliance with the standardized DataGrid pattern (grouping, sorting, reactive search, and export).
---

# Skill: DataGrid Standard Enforcer
<!-- Skill: Ejecutor del Estándar DataGrid -->

This skill provides guidelines and enforcement rules to ensure that every tabular data view, consultation screen, directory, or audit log across the ecosystem utilizes the standardized `@eco/datagrid` component with column grouping, reactive full-text search, column sorting, and Excel/CSV export.
<!-- Esta skill proporciona directrices y reglas para garantizar que toda vista de datos tabulares, pantalla de consulta, directorio o bitácora en el ecosistema utilice el componente estandarizado `@eco/datagrid` con agrupación de columnas, búsqueda reactiva, ordenamiento y exportación a Excel/CSV. -->

---

## 1. Mandatory DataGrid Architecture Requirements
<!-- 1. Requerimientos de Arquitectura Obligatorios para DataGrid -->

* **Universal Component `@eco/datagrid`:** Never build raw HTML `<table>` elements or ad-hoc datagrids for data query screens. Always import and instantiate `DataGrid` and `ColumnaDataGrid<T>` from `@eco/datagrid`.
  <!-- Componente Universal `@eco/datagrid`: Nunca construir elementos `<table>` planos o datagrids ad-hoc para pantallas de consulta. Siempre importar e instanciar `DataGrid` y `ColumnaDataGrid<T>` de `@eco/datagrid`. -->

* **Standard Capabilities Contract:**
  1. **Column Grouping (Drag & Drop + Toggle Button):** Every column must support drag-and-drop grouping into the upper band (`ZonaAgrupamiento`) or one-click toggle via the `+` / `−` button in the header.
  2. **Reactive Global Search:** The search input must filter across all visible column values instantly in memory on the client.
  3. **Multi-Column Sorting:** Clicking a column header toggles between ascending (`▲`), descending (`▼`), and natural order.
  4. **Expandable Row Details (`contenidoExpandible`):** Complex payloads (e.g., audit diffs, full JSON metadata, action history) must be rendered in collapsible detail rows.
  5. **Instant Export (Excel & CSV):** Built-in client-side export using `xlsx` to export the complete filtered dataset regardless of group collapse state.
  <!-- Contrato de Capacidades Estándar: Agrupación arrastrable, búsqueda reactiva global, ordenamiento por columna, filas expandibles y exportación a Excel/CSV. -->

---

## 2. Implementation Pattern & Code Template
<!-- 2. Patrón de Implementación y Plantilla de Código -->

```tsx
"use client";

import React from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";

export interface MiRegistroItem {
  id: string;
  titulo: string;
  categoria: string;
  estado: string;
  creadoEn: string;
  detalles?: Record<string, unknown>;
}

const COLUMNAS: ColumnaDataGrid<MiRegistroItem>[] = [
  {
    id: "titulo",
    encabezado: "Título / Elemento",
    valor: (r) => r.titulo,
    render: (r) => <strong>{r.titulo}</strong>,
  },
  {
    id: "categoria",
    encabezado: "Categoría",
    valor: (r) => r.categoria,
  },
  {
    id: "estado",
    encabezado: "Estado",
    valor: (r) => r.estado,
    render: (r) => (
      <span className={`chip-estado chip-${r.estado.toLowerCase()}`}>
        {r.estado}
      </span>
    ),
  },
  {
    id: "fecha",
    encabezado: "Fecha Registro",
    valor: (r) => new Date(r.creadoEn).getTime(),
    render: (r) => new Date(r.creadoEn).toLocaleString("es-EC"),
  },
];

export function MiConsultaGridWidget({ registros }: { registros: MiRegistroItem[] }) {
  return (
    <DataGrid
      columnas={COLUMNAS}
      filas={registros}
      idFila={(r) => r.id}
      nombreExportacion="reporte-consulta"
      contenidoExpandible={(r) => (
        <div className="detalle-registro">
          <pre>{JSON.stringify(r.detalles, null, 2)}</pre>
        </div>
      )}
    />
  );
}
```

---

## 3. Pre-Flight Checklist for New or Modified Views
<!-- 3. Lista de Verificación para Vistas Nuevas o Modificadas -->

1. **No Raw Tables:** Ensure no plain `<table className="tabla-panel">` is used for consultation views when grouping/sorting is required.
   <!-- Sin Tablas Planas: Asegurar que no se usen tablas HTML planas para consultas donde se requiera agrupación y ordenamiento. -->
2. **Column Value Accessors Defined:** Verify every column provides a string or number `valor` function for clean search indexing and export.
   <!-- Accesores de Valor Definidos: Verificar que cada columna defina una función `valor` limpia para búsqueda y exportación. -->
3. **Workspace Dependency Added:** Verify `@eco/datagrid: "workspace:*"` is present in the consumer `package.json`.
   <!-- Dependencia de Workspace Agregada: Verificar que `@eco/datagrid` esté listado en las dependencias del `package.json`. -->
