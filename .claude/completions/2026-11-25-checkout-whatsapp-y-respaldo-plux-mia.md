# Cierre: Checkout solo WhatsApp + Respaldo de Error PLUX y Alerta Mía (Web)

- **Fecha:** 2026-11-25
- **Resumen:**
  1. **Checkout rápido (solo WhatsApp obligatorio):** Se eliminó la exigencia de Cédula/RUC/Pasaporte y nombre para iniciar el pago tanto en `ModalCheckoutTinkay.tsx` como en `registrarPedidoTiendaAction` (`packages/comercio/src/acciones-logistica.ts`), y se actualizó `montoMaximoPagoSinDatosUsd = 0` en `comun_configuracion.cfg_negocio` para `tinkay`. Si el usuario no aporta datos fiscales, se completa automáticamente como Consumidor Final (`9999999999` / `CONSUMIDOR FINAL`).
  2. **Detección de errores silenciosos de PLUX (`BotonPagoPlux.tsx`):**
     - Intercepta `jQuery(document).on("ajaxError.ecoPlux")` para detectar al instante fallos CORS/red (`status === 0`) o HTTP `4xx`/`5xx` en `getEstablishmentByEmailPayboxResource` / endpoints de PagoPlux.
     - Agrega watchdog de apertura del modal (~5.4 s) para que nunca quede una pantalla vacía sin feedback si el iframe de PLUX no logra abrirse.
     - Expone `alErrorPago(detalle: DetalleErrorPlux)` cubriendo preparación, carga de script, XHR/CORS, apertura fallida, autorización fallida y rechazo.
  3. **Respaldo UX + Alerta Mía (Web):**
     - En `ModalCheckoutTinkay.tsx`, ante cualquier error de PLUX se muestra una tarjeta de respaldo con acceso en 1 clic a **Pagar Transferencia** (Transferencia / DeUna), **Escribir WhatsApp** (con mensaje prellenado y puente omnicanal) y **Hablar con Mía**.
     - Se envía automáticamente un evento `alerta_error_pago` a `POST /api/chat` que persiste el aviso en la conversación web del visitante (`comun_agentes`), emite Realtime a **Ventas y Chats en Vivo** y dispara notificación de campana/push al equipo comercial, además de inyectar un mensaje proactivo de Mía en `ChatAriaFlotante.tsx`.
  4. **Diagnóstico PLUX + Webhook:**
     - Confirmado desajuste en `com_pasarela_configuracion` de `tinkay`: se guardaron credenciales reales de producción (`dashboard.pagoplux.com`, correo `tinkay.uio@gmail.com`) con `psc_ambiente = 'PRUEBAS'` (Sandbox), causando `CORS error` en `getEstablishmentByEmailPayboxResource` de Sandbox.
     - Confirmado que la Edge Function `plux-webhook` ya está activa (`ACTIVE`, `verify_jwt: false`) en `https://oaybbpdxhlxjbpwnoymy.supabase.co/functions/v1/plux-webhook?negocio=tinkay`.
