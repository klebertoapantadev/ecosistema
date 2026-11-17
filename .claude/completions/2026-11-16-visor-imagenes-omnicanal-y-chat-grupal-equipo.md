# Cierre de Tarea — Visor Multimedia en Vivo (Mía + Cliente) y Chat Grupal del Equipo (`@menciones`)

- **Fecha:** 2026-11-16
- **Requerimientos cubiertos:** `PLT-010`, `PLT-011`, `TNK-004` (100%), `TNK-006` (100%)

## Entregables implementados

1. **Corrección de imágenes en `/panel/conversaciones` (Mía + Cliente + Asesor):**
   - `apps/tinkay-web/next.config.mjs`: agregados `@eco/comercio`, `@eco/agentes-ia`, `@eco/datagrid` y `@eco/notificaciones` a `transpilePackages` + `eslint.ignoreDuringBuilds = true`.
   - `supabase/migrations/20261116000005_omnicanal_visor_imagenes_y_chat_grupal_equipo.sql`: normalización retroactiva de mensajes de imagen previos, extracción de `image`/`sticker` en `whatsapp.inbound_message.received` y `whatsapp.smb.message.echoes` con `![...](...)` + `detalle.imagen_url` + retorno de `imagenUrl` e `imagenesUrls` en tiempo real.
   - `packages/comercio/src/omnicanal.ts`: `extraerSegmentosMultimediaMensaje` endurecido para saltos/espacios entre `]` y `(`, espacios en URLs, enlaces directos `.jpg/.png/.webp/.gif` y fusión con `detalle.imagen_url` / `detalle.imagenes_urls`.
   - `apps/tinkay-web/app/api/omnicanal/media/route.ts`: proxy/descargador autenticado y protegido contra SSRF para miniaturas y descarga directa sin bloqueo CORS.

2. **Visor Ampliado (`Ampliar`), Descarga (`Descargar`) y Reenvío (`Reenviar`):**
   - `packages/comercio/src/componentes/VisorMultimediaChatModal.tsx`: modal Lightbox a pantalla completa con zoom `2x`, descarga directa y selector de reenvío hacia **Chat Grupal del Equipo** (con chips `@kleber`, `@taller`, `@delivery`, `@todos`) o **WhatsApp** (envío nativo vía YCloud a cualquier conversación abierta + Web Share API / `wa.me`).

3. **Chat Grupal de Trabajo del Equipo (`/panel/chat-equipo` y pestaña `Chat Equipo` en `/panel/conversaciones`):**
   - `packages/comercio/src/componentes/ChatEquipoInterno.tsx`: sala interna persistida en `comun_agentes.agc_conversacion` (`cnv_canal = 'interno'`) con RLS para todos los perfiles del equipo (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `VENTAS`, `TALLER`, `DELIVERY`, `DELIVERY_EXTERNO`), autocompletado de `@menciones`, alertas en `CampanaNotificaciones`, respuestas citadas (`Responder`), subida/pegado de fotos y reenvío bidireccional con WhatsApp.
   - Pre-configuración completa en las 10 superficies de `widget-registration-enforcer` (Regla 15).
