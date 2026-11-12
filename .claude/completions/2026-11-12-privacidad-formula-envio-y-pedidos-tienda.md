# Cierre de Tarea — Privacidad de Fórmula de Envío, Variable `mostrarKilometrosCliente` y Persistencia de Pedidos de Tienda

**Fecha:** 2026-11-12  
**Requerimientos:** `PLT-008`, `PLT-009`, `PLT-011`, `TNK-002`, `TNK-004`, `TNK-005`

## Cambios realizados

1. **Ocultamiento total de fórmula interna al cliente:**
   - Retirado `formulaDetalle` de `ChatAriaFlotante.tsx`, `SelectorUbicacionEntrega.tsx`, `/api/chat/route.ts` y herramientas MCP (`/api/mcp/catalogo` en Tinkay y Margaritas).
2. **Variable configurable `mostrarKilometrosCliente` en `/panel/logistica`:**
   - Añadida en `ConfiguracionLogisticaNegocio`, `FormularioLogisticaCobertura.tsx`, `acciones-logistica.ts` y `com_fn_guardar_logistica_negocio` (`log_detalle_logistica.mostrarKilometrosCliente`, por defecto `true`).
   - Cuando está desactivada, ninguna superficie cliente (chat, carrito, checkout, MCP) muestra kilómetros, conservando solo la etiqueta limpia y el costo final.
3. **Inclusión del desglose logístico interno en el Pedido de la Tienda (`/panel/pedidos`):**
   - Implementada `registrarPedidoTiendaAction` y RPC `comun_comercio.com_fn_registrar_pedido_tienda` persistiendo cada orden en `com_proforma`, `com_proforma_item` y `com_despacho_asignacion` con `formula_calculo_interno`, distancia vial, coordenadas, enlace GPS y dedicatorias.
   - Creada `BandejaPedidosTienda.tsx` con `@eco/datagrid` y registrado el widget `pedidos_tienda` en los 10 puntos obligatorios del ecosistema.

