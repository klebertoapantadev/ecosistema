# Cierre de tarea — Sin opción de factura en checkout + Evidencias completas y Creador en cada pedido

- **Fecha:** 2026-11-23
- **Rama:** `master`
- **Requerimiento:** `TNK-002` ([especificacion-funcional.md](../../gobernanza/productos/tinkay/especificacion-funcional.md))

## Cambios implementados

1. **Checkout sin opción de factura electrónica (`ModalCheckoutTinkay.tsx`):**
   - Eliminada la casilla *"Deseo factura electrónica con mis datos (opcional)"* del Paso 3 (`3. Contacto`).
   - La facturación electrónica se gestiona manualmente de momento (`omitirFacturaAutomatica={true}` en `<BotonPagoPlux />`).
   - Corregida también la validación del servidor en `registrarPedidoTiendaAction` (`acciones-logistica.ts`) para que `montoMaximoPagoSinDatosUsd === 0` no aplique ningún control por monto.
2. **Almacenamiento consolidado de evidencias y autor del pedido (`acciones-plux.ts`, `acciones-logistica.ts`, `acciones-operaciones-taller.ts`):**
   - **Recibo / comprobante subido manualmente:** guardado en `prf_detalle_proforma` y `ota_detalle_orden` (`comprobante_transferencia` + `evidencias.comprobante_pago` con `subido_por_nombre` y `subido_en`), más nueva Server Action `adjuntarComprobantePedidoAction` para subir o reemplazar recibos desde cualquier pedido.
   - **Respuesta de PLUX:** `confirmarPagoPluxAction` persiste autorización, identificador, marca/dígitos, monto, fecha y `respuesta_raw` completa tanto en `com_proforma.prf_detalle_proforma` como en `com_orden_taller.ota_detalle_orden`.
   - **Confirmación de entrega:** vinculada y visible en el expediente del pedido con foto, GPS, entregador y hora.
   - **Quién creó el pedido (`creado_por`):** registrado automáticamente en pedidos manuales (`crearOActualizarPedidoOperadorAction` → usuario staff autenticado desde `seg_usuario`), Exequiales y pedidos web (`registrarPedidoTiendaAction`).
3. **Visualización en `/panel/pedidos` (`BandejaPedidosTienda.tsx`):**
   - Muestra en Tabla, Kanban y Detalle del pedido: `Creado por`, recibo/comprobante adjunto (con botón `Subir Recibo` / `Cambiar Recibo`), respuesta PLUX (con desplegable `Ver respuesta completa PLUX`) y confirmación de entrega (`Ver Entrega`).

## Verificación

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter tinkay-web build`
- Sin clases utilitarias de Tailwind CSS en el diff.
