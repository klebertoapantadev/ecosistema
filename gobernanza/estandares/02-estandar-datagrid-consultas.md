# Estándar de Componentes DataGrid y Vistas de Consulta (PLT-011 / PLT-013)

- **ID del Estándar**: `STD-UX-002`
- **Ámbito**: Transversal a todo el Ecosistema (`apps/*`, `packages/*`)
- **Estado**: `VIGENTE (Obligatorio)`

## 1. Declaración de Principio

Todas las pantallas, widgets y paneles de administración y consulta de datos tabulares (ej. Auditoría BDD, Monitoreo de Notificaciones, Bitácora de Despachos, Directorio de Usuarios, Solicitudes de Socios, Historial de Pagos) deben utilizar obligatoriamente el componente `@eco/datagrid` (`<DataGrid />`).

## 2. Requerimientos Funcionales del Grid

| Requerimiento | Descripción | Mecanismo |
| :--- | :--- | :--- |
| **Agrupación de Columnas** | Permite jerarquizar registros por cualquier dimensión (ej. por Emisor, Destinatario, Canal, Estado o Fecha). | Arrastre de encabezado a la banda superior o clic en botón `+` de columna. |
| **Búsqueda Global** | Filtrado instantáneo por coincidencia en texto de cualquier columna visible. | `busqueda` reactiva en cliente. |
| **Ordenamiento de Columnas** | Orden ascendente y descendente por tipos alfanuméricos, numéricos o fechas. | Clic sobre el encabezado de columna. |
| **Exportación a Excel / CSV** | Exportación client-side de las filas resultantes preservando la estructura tabular completa. | Botones "Exportar a Excel" y "Exportar a CSV" provistos por el DataGrid. |
| **Fila Expandible** | Visualización enriquecida de payloads, confirmaciones o historiales sin salir del grid. | Prop `contenidoExpandible`. |
