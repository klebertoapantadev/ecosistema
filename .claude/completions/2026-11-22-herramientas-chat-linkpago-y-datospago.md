# Cierre de Tarea — Herramientas de Cobro `/LinkPago`, `/DatosPago` y Link Directo DeUna en Chat Omnicanal

**Fecha:** 2026-11-22  
**Requerimientos:** `PLT-006`, `PLT-009`, `PLT-010`, `TNK-002`  
**Rama:** `master`

## Qué se implementó

1. **Herramienta `/LinkPago` en Chat Omnicanal (`@eco/comercio` + `tinkay-web`):**
   - **RPC transaccional (`SECURITY DEFINER`)** en `supabase/migrations/20261122000002_rpc_crear_link_pago_chat.sql`: `comun_comercio.com_fn_crear_link_pago_chat(...)` valida sesión + permisos de operador/admin (`seg_fn_es_operador_o_admin_negocio`), calcula exactamente base 0%, base gravada 15% e IVA, inserta en `com_proforma` (`tipo_origen = 'LINK_PAGO_CHAT'`, `prf_estado = 'PENDIENTE_PAGO'`) + `com_proforma_item` y genera secuencial legible (`TNK-LNK-XXXX`) con token único.
   - **Server Action `crearLinkPagoChatAction`** en `packages/comercio/src/acciones-plux.ts`: ejecuta la RPC (con respaldo resiliente autorizado vía cliente admin si la migración aún está pendiente en remoto) y construye la URL pública `${origin}/pagar/${token}`.
   - **Modal `ModalLinkPagoChat.tsx`** (`packages/comercio/src/componentes/ModalLinkPagoChat.tsx`):
     - Prellena el valor automáticamente desde `Campos de Venta` del chat (o monto inline `/LinkPago 45.50`), 100% editable.
     - Prellena concepto, nombre de cliente y tarifa IVA (`0% Flores` / `15%`).
     - Muestra el estado en vivo del procesador de tarjeta (PLUX activo vs. deshabilitado).
     - Botones **`Generar y Enviar`** (crea el link, actualiza `estadoCobro = 'PAGO_SOLICITADO'` en el chat y envía directo por Chat Web Realtime o WhatsApp YCloud) y **`Solo Generar`** (copiar / insertar / enviar).
   - **Accesos rápidos múltiples:** comando `/LinkPago` (y `/LinkPago <monto>`), menú `+ Opciones` → `Link Pago`, y botón `Link Pago` en `PanelCamposVentaChat.tsx`.

2. **Respuesta rápida inteligente `/DatosPago` + Link Directo DeUna configurable:**
   - Nuevo campo `linkDeuna: string | null` en `DatosTransferenciaTienda` (`packages/comercio/src/configuracion-tienda-checkout.ts`) editable en `/panel/pasarelas` (`ConfiguracionPasarelaPayphone.tsx`).
   - Helper `construirMensajeDatosPagoChat`: arma dinámicamente el mensaje con el valor/concepto actual del chat (si existe), enlace directo DeUna, cuentas bancarias configuradas (titular, cédula/RUC, correo) y la opción para que el cliente responda `"TARJETA"` si desea pagar con tarjeta de crédito/débito (omitida automáticamente cuando el interruptor maestro de tarjetas está deshabilitado).
   - Si existe imagen QR DeUna configurada, ofrece un chip de 1 clic (`Adjuntar QR`) sobre el compositor.
   - **Detección contextual de solicitud de tarjeta (`detectarSolicitudPagoTarjetaEnMensaje`):** detecta cuando el cliente solicita pagar con tarjeta o pide un enlace de pago (evitando falsos positivos con tarjetas de dedicatoria floral) y muestra un banner de 1 clic **`Generar Link`** encima del compositor.

3. **Página pública de cobro `/pagar/[token]`:**
   - Componente compartido `VistaLinkPagoCliente.tsx` en `@eco/comercio` y ruta `apps/tinkay-web/app/pagar/[token]/page.tsx`.
   - Cobro limpio al 100% con **PLUX (`BotonPagoPlux`)** (respetando el interruptor maestro de tarjeta y compra rápida Consumidor Final bajo el umbral configurado) + **DeUna** (botón directo + QR) + **Transferencia Bancaria** (copiado rápido de cuentas y subida de comprobante con `confirmarOrdenTransferenciaProformaAction`).
   - Descarga e impresión de Factura Electrónica RIDE SRI inmediata tras confirmación PLUX.

## Verificación ejecutada

- `pnpm --filter @eco/comercio test` — **17 archivos, 102 pruebas aprobadas** (incluyendo cobertura nueva para `linkDeuna`, `/DatosPago`, `/LinkPago` inline y detección sin falsos positivos con tarjetas de dedicatoria).
- `pnpm --filter @eco/comercio typecheck` + `tinkay-web` + `tranqi-web` + `fastfix-web` + `margaritas-web` — sin errores.
- `pnpm --filter tinkay-web build` — compilación de producción exitosa incluyendo ruta dinámica `/pagar/[token]`.

## Paso operativo pendiente en Supabase

- Ejecutar la migración [`supabase/migrations/20261122000002_rpc_crear_link_pago_chat.sql`](file:///c:/IA/Ecosistema/supabase/migrations/20261122000002_rpc_crear_link_pago_chat.sql) en el SQL Editor de Supabase (el respaldo en servidor ya permite operar desde ya si `SUPABASE_SERVICE_ROLE_KEY` está configurado en Vercel).
- Opcionalmente, registrar la URL de pago directo DeUna en `/panel/pasarelas` → sección *Compra Rápida, WhatsApp y Transferencia Bancaria / QR DeUna* → **Link de Pago Directo DeUna (URL)**.
