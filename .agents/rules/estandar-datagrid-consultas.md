# Estándar de DataGrid para Pantallas y Widgets de Consulta

**Regla de Gobernanza y UX**: Toda pantalla de consulta, reporte, directorio o bitácora en las aplicaciones web del ecosistema (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`, `@eco/gestion-usuarios`, `@eco/notificaciones`, `@eco/auditoria`, `@eco/comercio`) DEBE construirse sobre el componente estandarizado `@eco/datagrid`.

## 1. Capacidades Obligatorias del Grid

1. **Agrupación de Columnas (Drag & Drop + Botón +)**:
   - Los usuarios pueden arrastrar encabezados de columna hacia la zona superior de agrupamiento o pulsar el botón `+` para agrupar filas de forma anidada y reactiva.
2. **Búsqueda Reactiva sobre el Resultado**:
   - Barra de búsqueda de texto completo que filtra inmediatamente en memoria sobre los valores de todas las columnas visibles.
3. **Ordenamiento Multicolumna**:
   - Encabezados interactivos con indicador de dirección ascendente (`▲`) y descendente (`▼`).
4. **Exportación Integrada (Excel y CSV)**:
   - Botones integrados para descarga directa de hojas de cálculo con el conjunto filtrado completo.
5. **Filas Expandibles**:
   - Detalle desplegable para metadatos, bitácoras de auditoría o cargas JSON extensas.

## 2. Prohibición de Tablas Planas Huérfanas

- Queda estrictamente prohibido codificar elementos `<table>` planos o grids ad-hoc que carezcan de capacidades de agrupación y ordenamiento en vistas de consulta y administración.
