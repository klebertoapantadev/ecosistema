# Cierre de Tarea — Omnicanal Facebook Messenger & Instagram Direct + Modo Manual por Defecto (`PLT-010` Fase 3)

**Fecha:** 2026-11-26  
**Alcance:** Ecosistema completo (`packages/comercio`, `packages/configuracion-negocio`, `apps/{tinkay,margaritas,fastfix,tranqi}-web`, `supabase/migrations`)

## 1. Qué se implementó

1. **Base de datos y Supabase Vault (`supabase/migrations/20261126000006_omnicanal_meta_messenger_instagram_y_modo_manual.sql`)** — aplicada en vivo en el proyecto dedicado `ecosistema` (`oaybbpdxhlxjbpwnoymy`):
   - Columnas Vault en `comun_configuracion.cfg_aria`: `ari_meta_page_token_secreto_id`, `ari_meta_ig_token_secreto_id`, `ari_meta_app_secret_secreto_id`.
   - Etiquetas `origen-facebook` y `origen-instagram` sembradas en los 4 negocios; `meta_modo_manual_defecto = true` y tokens de webhook/verificación autogenerados (con `meta_page_id = 109525757999859` y `meta_ig_account_id = 17841448407645348` para `tinkay`).
   - RPCs de configuración segura: `cfg_fn_guardar_meta_mensajeria`, `cfg_fn_borrar_meta_mensajeria_clave`, `cfg_fn_guardar_modo_manual_ycloud`.
   - RPCs omnicanal Meta Graph API v21.0:
     - `com_fn_omnicanal_verificar_webhook_meta` (`GET hub.verify_token`).
     - `com_fn_interno_despachar_meta_mensajeria` (envío de texto troceado 950 IG / 1900 FB, imágenes y archivos con soporte automático de ventana 24h y etiqueta `HUMAN_AGENT` hasta 7 días para respuestas humanas).
     - `com_fn_omnicanal_procesar_webhook_meta` (validación `X-Hub-Signature-256`, deduplicación por `mid`, sincronización de ecos desde Facebook/Instagram App Móvil, resolución automática de nombre de perfil, atribución `referral` y regla **Manual por defecto**).
     - `com_fn_omnicanal_responder_meta_con_aria` (invoca ARIA únicamente si el chat individual está en `BOT_ACTIVO`).
   - Extensión de `com_fn_omnicanal_enviar_mensaje_asesor`, `com_fn_omnicanal_responder_con_aria_panel`, `com_fn_omnicanal_procesar_webhook_ycloud` y helpers compartidos de media/STT/Web Push para soportar tokens Meta + YCloud.
2. **Backend y Rutas Webhook (`@eco/comercio` + 4 apps web):**
   - `verificarWebhookMetaOmnicanalAction` y `procesarWebhookMetaOmnicanalAction` en `packages/comercio/src/acciones-omnicanal.ts` (espejado multimedia a `comun-publico`, Broadcast Realtime `<50ms`, Push + Campana a ventas, transcripción de notas de voz y atribución Meta Ads).
   - Rutas `app/api/webhooks/meta/route.ts` y `app/api/webhooks/meta/[token]/route.ts` en `tinkay-web`, `margaritas-web`, `fastfix-web` y `tranqi-web`.
3. **Interfaz de Administración y Consola de Ventas (`@eco/configuracion-negocio` + `@eco/comercio`):**
   - Nueva tarjeta **"Canal Facebook Messenger e Instagram Direct (Meta API · $0/msg)"** en `FormularioAria.tsx` (100% estilos inline React, cero Tailwind) con Callback URL + Verify Token copiables, toggle **Modo Manual por defecto** activado de fábrica y switches independientes para Facebook e Instagram.
   - Toggle equivalente de **Modo Manual por defecto** agregado en la tarjeta de WhatsApp YCloud.
   - `ConsolaVentasOmnicanal.tsx` muestra el nombre real del canal en avisos de envío y la insignia `Manual` en hilos sin asesora asignada (junto al botón individual **`Activar IA`** / **`Pausar IA`** por conversación).

## 2. Verificación

- Migración aplicada en Supabase `ecosistema` (`oaybbpdxhlxjbpwnoymy`) y verificada vía consulta SQL.
- Pruebas unitarias en `@eco/comercio` (`omnicanal.test.ts` + `marketing-meta.test.ts`).
- `pnpm typecheck` y chequeo de cero clases Tailwind en archivos editados.

## 3. Pendiente de conexión externa (cuando el usuario indique)

- Conectar la Callback URL y el Verify Token en `developers.facebook.com` → App Meta → Webhooks (Messenger & Instagram), y pegar el Page/System User Token + App Secret en `/panel/aria` → Canal Facebook e Instagram.
