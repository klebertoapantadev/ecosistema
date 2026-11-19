# Cierre de tarea — Diseño sobrio y elegante en todas las vistas del panel

- **Fecha**: 2026-11-19
- **Rama**: `master`
- **Alcance**: Rediseño sobrio y elegante de paleta de colores y escala tipográfica aplicado a todas las vistas operativas del panel (`apps/tinkay-web`, `apps/margaritas-web`, `packages/comercio`, `packages/configuracion-negocio`, `packages/notificaciones`, `packages/gestion-usuarios`) y documentado en `gobernanza/productos/tinkay/sistema-visual.md`.

## Cambios principales
1. **Paleta unificada sobria**: se colapsaron más de 220 códigos hexadecimales dispersos y saturados (azul eléctrico, verde neón, rosa intenso, violeta, amarillo chillón, rojo intenso, gradientes oscuros) hacia una paleta editorial cálida y contenida (~14 tonos: `#F6F4F0`, `#FFFFFF`, `#F8F7F4`, `#E6E2DA`, `#D5CFC4`, `#1F1C19`, `#57524C`, `#847D74`, `#221E1B`, `#2F4737`, y tintes semánticos diluidos `#F2F6F3`, `#FAF6EE`, `#FAF2F2`, `#F4F2EE`).
2. **Tipografía contenida**: en `.panel-contenido` se usa `Inter` con títulos sobrios (`h1` `1.12rem` peso 600, `h2` `0.92–0.94rem`, `h3` `0.86rem`), eliminando encabezados sobredimensionados (`1.35rem`–`1.65rem` y `22px`).
3. **Marco del panel y navegación**:
   - Eliminado borde rosa `#EC7FA7` y gradiente en `NavegacionPanelLateral.tsx` (reemplazado por acento dorado cálido sutil `#C8A25A`).
   - Reemplazado badge azul neón en `CampanaNotificaciones.tsx` por dorado discreto `#C8A25A` y toast cálido sobrio.
   - Unificados los badges de roles en `apps/tinkay-web/app/panel/layout.tsx` y cabecera de `apps/tinkay-web/app/panel/page.tsx`.
   - Botones de exportación de DataGrid (`.datagrid-exportar .btn-mini`) convertidos en botones outline limpios.
4. **Rediseño integral de Inventario de Rosas y todas las consolas**:
   - `ConsolaInventarioRosas.tsx` y `CatalogoVariedadesRosas.tsx`: cabecera blanca arquitectónica con acento lateral `#2F4737` (sin banner azul marino ni texto neón), botones unificados sin rosa intenso, tarjetas de variedades blancas uniformes con punto de color discreto, consolidado sobrio en piedra cálida.
   - Armonizadas todas las demás vistas: Pedidos de Tienda, Enviar Pedidos, Taller, Calendario, Entregas GPS, Entrega Inmediata, Ventas Omnicanal, Chat del Equipo, Catálogo Comercial, Facturación Electrónica, Testimonios, Configuración SRI/Pasarela/Logística/ARIA/SMTP/Tokens MCP y Usuarios.
