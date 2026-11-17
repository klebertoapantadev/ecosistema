# Cierre de Tarea — Zoom Estable y Pin de Alta Precisión en Mapa de Entrega

- **Fecha**: 2026-11-17
- **Rama**: `master`
- **Estado**: Completado

## Problema reportado

1. Al seleccionar o arrastrar una ubicación de entrega en el mapa (`MapaCoberturaPichincha`), un efecto automático ejecutaba `map.fitBounds([origen, destino])` tanto al fijar la coordenada como al recibir la ruta OSRM, provocando un *zoom-out* brusco hacia toda la ruta desde el taller matriz y sacando al usuario del nivel de calle donde estaba eligiendo.
2. Los marcadores de `Entrega` y `Taller` usaban `L.divIcon` con `iconSize: [0, 0]`, colapsando la cápsula contenedora a ~18px y desbordando el texto blanco sobre el fondo claro del mapa sin una punta exacta de referencia.

## Solución implementada

1. **Preservación estricta de zoom y centrado en punto elegido (`MapaCoberturaPichincha.tsx`)**:
   - Eliminado el `map.fitBounds([origen, destino])` automático al cambiar `destino` o `rutaGeometria`.
   - Al hacer clic en el mapa o soltar el pin arrastrable (`dragend`), el mapa centra suavemente en `[lat, lng]` conservando exactamente `map.getZoom()`.
   - Cuando la coordenada proviene de buscador de direcciones, GPS, enlace de Maps/Waze o del botón `Centrar en ubicación` (`SelectorUbicacionEntrega.tsx`, `FormularioLogisticaCobertura.tsx`), se centra en `[destino.lat, destino.lng]` con `Math.max(zoomActual, 16)` (acerca a calle si estaba lejos y respeta zooms más cercanos como `17`–`19`).
   - El trazado de `rutaGeometria` actualiza únicamente la polilínea sin alterar la cámara, y las llamadas a `invalidateSize({ pan: false })` evitan desplazamientos accidentales.

2. **Nuevo marcador SVG de alta precisión y guía visual (`MapaCoberturaPichincha.tsx`)**:
   - Reemplazado el `divIcon` colapsado por un pin tipo gota SVG (`52x64px`, `iconAnchor: [26, 56]`) con mira interior, punto exacto sobre la calle, anillo de pulso suave, área táctil amplia para arrastrar (`setLatLng` sin recrear el nodo DOM) y etiqueta superior `Punto de entrega · arrastrar` con `width: max-content`.
   - Corregido también el marcador de `Taller` (`iconSize: [34, 34]`, ícono SVG de tienda y etiqueta superior `width: max-content`).
   - Cursor `crosshair` en modo selección y pastilla guía superior en el lienzo del mapa.

## Verificación

- `pnpm --filter @eco/comercio --filter tinkay-web typecheck` ejecutado sin errores.
- Cero clases utilitarias de Tailwind CSS (Regla 17 de `AGENTS.md`).
