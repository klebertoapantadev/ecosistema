# 2026-11-15 — Corrección Integral de Notificaciones y Alertas de Compra (Cliente + Staff) en Tinkay y Plataforma (`PLT-013`, `PLT-009`)

## Causa raíz diagnosticada
1. **Correo del comprador omitido en compras `< $50` (Consumidor Final) y sin envío en `confirmarPagoPluxAction`:**
   - En `ModalCheckoutTinkay.tsx`, cuando el pedido era `< $50` (`mostrarCamposFacturacion === false`), `correoEfectivo` se enviaba vacío `""` aunque el comprador estuviera autenticado (`familiammtg@gmail.com`) o hubiera prellenado su correo, mientras la pantalla de éxito mostraba *"enviado el comprobante a familiammtg@gmail.com"*.
   - Adicionalmente, `confirmarPagoPluxAction` no despachaba correo de confirmación al comprador ni invocaba `notificarStaffNuevoPedido`.
2. **Transporte SMTP multi-negocio y esquema `comun_notificacion` no expuesto en PostgREST:**
   - `enviarCorreo({ negocio: "tinkay" })` devolvía `409 El negocio no tiene un servidor SMTP activo` al no contar aún con fila propia en Vault, sin respaldo al transporte SMTP verificado de plataforma.
   - Las lecturas/escrituras directas `.schema("comun_notificacion").from("not_registro")` fallaban silenciosamente con `406 PGRST106` porque `comun_notificacion` no estaba expuesto en `pgrst.db_schemas`, y en Vercel no se expone `SUPABASE_SERVICE_ROLE_KEY` (Regla 3 `AGENTS.md`).
3. **Ausencia de campana In-App y endpoint `/api/notificaciones/usuario` en `tinkay-web`:**
   - `tinkay-web` no montaba `<CampanaNotificaciones />` ni exponía `/api/notificaciones/usuario`.

## Solución implementada
- **`@eco/notificaciones` (`enviar-correo.ts`, `notificar-usuario.ts`, `api-usuario.ts`, `CampanaNotificaciones.tsx`):**
  - Respaldo automático en `enviarCorreo` hacia el transporte SMTP verificado de plataforma cuando un negocio devuelve `409` sin SMTP propio, preservando intactos asunto y HTML de marca.
  - Nueva función `notificarClienteCompraConfirmada` (correo HTML con resumen de orden, Factura Electrónica SRI / autorización PLUX o aviso de transferencia + alerta In-App/Push).
  - Resolución resiliente de destinatarios staff vía RPC `SECURITY DEFINER` `seg_fn_obtener_staff_negocio` y persistencia triple (`seg_fn_emitir_notificaciones_internas`, `not_registro`, `usu_detalle_usuario.notificaciones_bandeja`).
  - Módulo servidor transversal `@eco/notificaciones/api-usuario` + mejoras en `CampanaNotificaciones` (variante clara/oscura, query `?negocio=`, evento `eco:refrescar-notificaciones`, Web Notification API y banner toast flotante en vivo).
- **`@eco/comercio` (`acciones-plux.ts`, `acciones-logistica.ts`) y `apps/tinkay-web`:**
  - Preservación del correo real del comprador autenticado incluso en compras rápidas `< $50` Consumidor Final.
  - Despacho simultáneo a cliente y staff en compras con tarjeta PLUX y en pedidos por transferencia/QR DeUna.
  - Ruta `/api/notificaciones/usuario` y montaje de `<CampanaNotificaciones />` en `EncabezadoEcommerce.tsx` (tienda pública) y `app/panel/layout.tsx` (panel de cliente, ventas, operadores y administradores).
- **Migración SQL `20261115000009_notificaciones_alertas_multinegocio_y_correo_compra.sql` y Gobernanza (`PLT-013`):**
  - Exposición de `comun_notificacion` y `comun_facturacion` en PostgREST, `GRANT UPDATE` por columna en `not_registro` (Regla 13 `AGENTS.md`), actualización de `seg_fn_obtener_staff_negocio` y creación de RPCs `seg_fn_emitir_notificaciones_internas`, `seg_fn_listar_mis_notificaciones` y `seg_fn_accion_mi_notificacion`.
