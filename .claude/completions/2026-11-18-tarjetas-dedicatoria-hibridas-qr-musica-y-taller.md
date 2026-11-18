# Cierre de Tarea — Edición de Pedidos, Relación 1:1 Pedido-Tarjeta, Descarga PDF, Impresión Canon G3110 y Música YouTube/MP3 con Lyrics

**Fecha:** 2026-11-18  
**Requerimientos:** `PLT-009` / `TNK-005`  

## Resumen de Cambios
1. **Relación 1:1 Pedido ↔ Tarjeta y Sincronización Híbrida (`acciones-logistica.ts` + `acciones-operaciones-taller.ts`):**
   - Cada pedido (`TNK-ORD-...`, `PED-...`, `OT-...`, `PRF-...`) cuenta automáticamente con su tarjeta dedicatoria vinculada 1:1 identificada por su token único (`ota_tarjeta_token` / `prf_token_aprobacion`).
   - `guardarEdicionPedidoYTarjetaAction`, `obtenerTarjetaPublicaAction`, `editarTarjetaClienteAction` y `registrarImpresionTarjetaAction` operan de forma sincronizada sobre `com_orden_taller`, `com_proforma` y `com_entrega_evidencia`, funcionando incluso antes de ejecutar `com_orden_taller`.
2. **Integración completa en Pedidos de Tienda (`/panel/pedidos` — `BandejaPedidosTienda.tsx`):**
   - Botones directos **`Editar`** y **`Tarjeta`** en cada fila de la tabla principal y dentro del detalle expandido.
   - Modal de **Editar Datos del Pedido** para actualizar destinatario, comprador, teléfono, dirección, enlace GPS, fecha, franja horaria/sala, notas de taller y mensaje de la tarjeta.
3. **Estudio Integral de la Tarjeta (`ModalImprimirTarjetaTaller.tsx`):**
   - Edición en vivo de `Para`, `De`, mensaje de dedicatoria, formato (`Díptico Tinkay` vs `Condolencias Plana`), tipografía y calibración milimétrica para **Canon PIXMA G3110**.
   - **Descargar PDF (`pdf-lib`)**: genera al vuelo `Tarjeta-{codigo}.pdf` con medidas exactas en milímetros y código QR incrustado.
   - **Música YouTube / MP3 + Lyrics (`LRCLIB`)**: subida de MP3 a `comun-publico/tarjetas-audio/` y extracción automática de letra sincronizada `.lrc` desde enlaces de YouTube o título de canción.
