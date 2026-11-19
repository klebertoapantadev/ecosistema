# Cierre de Tarea — Clasificación en 4 Tipos de Pedido, Reglas Exequiales y Hora de Entrega Universal

**Fecha:** 2026-11-18  
**Negocios:** Tinkay (`tinkay-web`) y Margaritas Floristería (`margaritas-web`) — `@eco/comercio` + `comun_comercio`

## Resumen de Cambios

1. **Distinción Canónica en 4 Tipos de Pedido (`operaciones-taller.ts`, `InsigniaClasificacionPedido.tsx`, `20261118000007`):**
   - `FLORISTERIA_OCASIONES` (`Floristería / Ocasiones`)
   - `CONDOLENCIAS` (`Condolencias` — arreglos fúnebres particulares con comprador, teléfono/WhatsApp, dirección/funeraria y tarjeta de condolencias)
   - `EVENTOS` (`Eventos` — ceremonias, proformas de evento, montajes y mobiliario)
   - `EXEQUIALES` (`Exequiales` — convenio Exequiales por sala y persona fallecida)

2. **Reglas Operativas Exclusivas para `Exequiales` (`BandejaPedidosTienda.tsx`, `ConsolaEnvioPedidosTaller.tsx`, `ConsolaTallerFloral.tsx`, `ConsolaConfirmacionEntregas.tsx`, `PanelCamposVentaChat.tsx`):**
   - **Sin Teléfono / WhatsApp** requerido ni mostrado.
   - **Sin Tarjeta de Condolencias / Dedicatoria** requerida ni mostrada (oculta en edición, acciones de tabla y detalle expandible).
   - **Sin Dirección de Entrega, Retiro en Tienda ni Enlace Google Maps** (se gestiona directamente por `Sala Exequiales`).
   - **Destinatario = `Persona Fallecida (Destinatario) *` obligatorio (`required`)** con validación en cliente, Server Actions y RPC SQL.

3. **Hora de Entrega en Todos los Casos:**
   - Selector unificado de **Hora de Entrega** en todos los formularios y modales de edición/creación:
     - Rangos horarios oficiales (`A) 09:00 - 13:00`, `B) 13:00 - 17:00`, `C) 17:00 - 20:00`)
     - Opción **`⏰ Hora exacta`** con selector `<input type="time">` cuando aplique (y `⚡ Lo antes posible` en Exequiales).

## Verificación

- `pnpm --filter @eco/comercio test`: 15 suites / 88 tests en verde.
- `pnpm --filter @eco/comercio typecheck`: 0 errores.
- `pnpm --filter tinkay-web typecheck`: 0 errores.
- `pnpm --filter margaritas-web typecheck`: 0 errores.
