# Cierre de Tarea — Notificaciones Push Estilo WhatsApp con Deep-Link Directo y Rediseño Visual Sobrio Omnicanal

**Fecha:** 2026-11-17
**Negocio / Paquetes:** `@eco/notificaciones`, `@eco/comercio`, `apps/tinkay-web`, `supabase/migrations`, `gobernanza/productos/tinkay`
**Requerimientos:** `TNK-004`, `TNK-006`, `PLT-010`

## Entregables Implementados

1. **Notificaciones Push Estilo WhatsApp + Acceso Directo al Chat Correspondiente:**
   - **Motor Web Push Nativo RFC 8291 (`aes128gcm`) + RFC 8292 (`VAPID ES256`):** Implementado en `packages/notificaciones/src/web-push-nativo.ts` usando exclusivamente `node:crypto` (cero dependencias externas).
   - **Persistencia Segura en Supabase (`20261117000006_omnicanal_webpush_suscripciones.sql`):** Tabla `comun_seguridad.seg_push_suscripcion` con RLS habilitado al 100%, `aud_fn_auditar_tabla()`, `GRANT UPDATE` por columna, y almacenamiento de la clave privada VAPID en `vault.secrets` (`cfg_vapid_secreto_id`).
   - **Service Worker PWA (`apps/tinkay-web/public/sw-operaciones.js`) + Endpoint `/api/notificaciones/push`:** Soporte completo de eventos `push` y `notificationclick` para abrir o enfocar directamente la ventana/PWA de Tinkay en la conversación exacta (`/panel/conversaciones?chat={id}&msg={msgId}`, `/panel/conversaciones?pestana=chat_equipo&msg={msgId}` o `/panel/chat-equipo?msg={msgId}`).
   - **Despacho en Vivo y Segundo Plano (`acciones-omnicanal.ts` + `GestorPushChatsOmnicanal.tsx`):** Conectado a cada mensaje recibido de clientes (WhatsApp YCloud y Chat Web) y a cada mensaje enviado en el Chat Grupal del Equipo.

2. **Rediseño Visual Limpio y Sobrio:**
   - Reemplazadas las burbujas moradas (`#4C1D95`/`#6D28D9`) del Chat Grupal y las burbujas azul eléctrico (`#1E40AF`) de asesores por una paleta editorial neutra de alto contraste (`#FFFFFF` entrantes, `#ECEAE4` salientes con texto `#18181B`, `#F2F5F3` ARIA, `#FAF6EC` notas internas, controles `#18181B` / `#2D4734` y píldoras monocromáticas `#F4F4F5`).

3. **Corrección del Menú `Opciones` en Web + Paleta Sobria + Eliminación de `Enviar y cerrar`:**
   - En Web, el popover de `Opciones` ahora se ancla directamente encima del botón `[＋ Opciones]` dentro de la columna del chat (corrigiendo el desalineamiento sobre el menú lateral).
   - Paleta sobria unificada (`#FFFFFF` / `#F4F4F5` / `#27272A`, con rojo tenue `#FEF2F2` / `#B91C1C` solo en `Eliminar`) tanto en el Bottom Sheet móvil como en el popover Web.
   - Eliminado el botón `Enviar y cerrar` del compositor de `ConsolaVentasOmnicanal.tsx`.
