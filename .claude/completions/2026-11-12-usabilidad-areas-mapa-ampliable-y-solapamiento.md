# Cierre de Tarea — Usabilidad de Configuración de Áreas, Mapa Ampliable y Solapamiento con Menor Tarifa

- **Fecha:** 2026-11-12
- **Requerimientos:** `PLT-008`, `TNK-002`, `TNK-005`

## Resumen de Cambios

1. **Áreas Solapadas con Regla de Tarifa Más Baja (`packages/comercio/src/logistica.ts`)**:
   - `cotizarEnvioDomicilio` evalúa el costo real de **todas** las áreas activas cuyos polígonos contengan el destino (`GRATIS`, `TARIFA_FIJA` y `POR_KM`) y selecciona automáticamente la de **menor tarifa** (`costoTotalEnvio` mínimo), sin importar el orden en que fueron creadas.
   - Se expone `zonasCoincidentes` en `ResultadoCotizacionEnvio` y se registra la nota de solapamiento en `formulaDetalle` (solo visible en simulador administrativo y pedido de tienda).
   - Cubierto con pruebas unitarias en `packages/comercio/src/logistica.test.ts`.

2. **Optimización de Espacio con Dropdown de Selección de Área (`FormularioLogisticaCobertura.tsx`)**:
   - Sustituida la lista vertical extensa de tarjetas por un **selector desplegable (`<select>`)** con ícono de modalidad y resumen tarifario de cada área, acompañado de un panel compacto de edición para el área seleccionada (estado activo, selector de color, nombre, modalidad, tarifa, sectores referenciales, `Enfocar Área`, `Ver Todas`, `Dibujar Área`, `Deshacer Punto` y `Eliminar Área`).

3. **Mapa Más Amplio y Modo Pantalla Completa (`MapaCoberturaPichincha.tsx`, `ConsolaConfiguracionUnificada.tsx`)**:
   - Ancho del contenedor en `/panel/logistica` ampliado de `960px` a `1220px` y altura base del mapa incrementada de `340px` a `480px`.
   - Controles `Ampliar Mapa` (`680px` en línea) y `Pantalla Completa` (workspace fijo a toda la ventana con guardado directo y cierre con `Esc`), respaldados por `ResizeObserver` + `map.invalidateSize()`.
   - Corregido el doble disparo de clic en Leaflet al dibujar vértices sobre polígonos existentes/solapados.
