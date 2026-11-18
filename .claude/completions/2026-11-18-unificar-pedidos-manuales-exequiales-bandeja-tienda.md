# Cierre: Visibilidad Unificada de Pedidos Manuales y Exequiales en Pedidos de Tienda + Ícono `🕯️ Exequiales`

**Fecha:** 2026-11-18
**Requerimientos:** `TNK-005`, `PLT-009`, `PLT-011`

## Causa Raíz
1. Los pedidos cargados desde **Enviar Pedidos** (`MANUAL_ADMIN` = `PED-...` y `EXEQUIALES_LLAMADA` = `OT-...`, como `OT-0005`) se guardaban en `com_orden_taller` / `com_entrega_evidencia` sin fila en `com_proforma`.
2. `obtenerPedidosTiendaAction` (`/panel/pedidos`) consultaba únicamente `com_proforma`, por lo que al abrir el enlace directo de la notificación (`/panel/pedidos?pedido=OT-0005`) o buscar en **Pedidos de Tienda**, las órdenes `OT-...` y `PED-...` no aparecían.
3. En `/panel/envio-pedidos`, `filtroBandeja` arrancaba en `por_enviar` (`PENDIENTE_ENVIO`), ocultando inmediatamente las órdenes recién enviadas a Taller (`ENVIADO_TALLER`).

## Cambios Aplicados
- `packages/comercio/src/acciones-logistica.ts`: `obtenerPedidosTiendaAction` unifica ahora órdenes de `com_proforma`, `com_orden_taller` (`PED-...` y `OT-...`) y `com_entrega_evidencia`; `actualizarEstadoPedidoTiendaAction` sincroniza también el cambio de estado sobre `com_orden_taller`.
- `packages/comercio/src/componentes/BandejaPedidosTienda.tsx`: badges diferenciados (`🕯️ Exequiales`, `📝 Pedido Manual`, `✨ Evento`, `🛍️ Tienda`) y recarga automática si `?pedido=...` no está aún en caché local.
- `packages/comercio/src/componentes/ConsolaEnvioPedidosTaller.tsx` y `acciones-operaciones-taller.ts`: botón renombrado a `🕯️ Exequiales`, filtro inicial `todos` y soporte de `?pedido=...`.
