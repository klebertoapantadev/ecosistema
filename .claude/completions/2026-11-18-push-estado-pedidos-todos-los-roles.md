# Cierre de Tarea — Notificaciones Push en Cambios de Estado de Pedidos para Todos los Roles + Lectura en 1 Clic

**Fecha:** 2026-11-18
**Requerimientos:** `PLT-009` / `PLT-013` / `TNK-002` / `TNK-005`

## Resumen de Cambios
1. **Migración SQL transaccional (`20261118000002_push_estado_pedidos_todos_los_roles_y_lectura_click.sql`):**
   - `comun_comercio.com_fn_actualizar_estado_pedido_tienda`: actualiza estado en `com_proforma` y sincroniza `com_orden_taller` bajo `SECURITY DEFINER`.
   - `comun_comercio.com_fn_push_emitir_cambio_estado_pedido`: resuelve todos los destinatarios activos por rol (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `VENTAS`, `TALLER`, `DELIVERY`, `DELIVERY_EXTERNO` asignado y `CLIENTE` titular), inserta en `comun_notificacion.not_registro` con `not_id` único y retorna suscripciones Web Push + claves VAPID desde Vault.
   - `comun_seguridad.seg_fn_marcar_notificacion_accion_texto`: marca como leída (`not_leido_en = now()`) cualquier notificación tanto por UUID como por `clave_original`.
2. **Despacho unificado de Push + Campana + Broadcast Realtime (`packages/comercio/src/notificaciones-pedidos-push.ts`):**
   - Integrado en cambios de estado de `BandejaPedidosTienda`, envío a Taller, creación de órdenes operativas/Exequiales, actualización de estado en Taller y confirmación GPS de entrega.
3. **Acceso directo al pedido modificado (`?pedido=...`) según el rol:**
   - `SUPERADMIN` / `ADMINISTRADOR` / `OPERADOR` / `VENTAS` → `/panel/pedidos?pedido=...` (`BandejaPedidosTienda` filtra y expande automáticamente el pedido).
   - `TALLER` → `/panel/taller?pedido=...` (`ConsolaTallerFloral` enfoca y expande el pedido).
   - `DELIVERY` / `DELIVERY_EXTERNO` → `/panel/entregas?pedido=...` (`ConsolaConfirmacionEntregas` preselecciona el pedido).
   - `CLIENTE` → `/panel?vista=pedidos&pedido=...` (`EspacioClienteEcommerceTinkay` resalta el pedido en primer lugar, con suscripción Web Push habilitada en `MarcoEcommerceClienteTinkay`).
4. **Marcado automático como leída al hacer clic:**
   - `sw-operaciones.js` (`notificationclick` con `fetch` `keepalive: true` hacia `/api/notificaciones/usuario`), `GestorPushChatsOmnicanal.tsx` y `CampanaNotificaciones.tsx` (al tocar tarjeta, enlace, toast o ingresar con `?not_id=...`).
