---
tipo: arquitectura_funcional_tecnica
estado: vigente
version: 1.0
fecha: 2026-11-15
codigo_requerimiento: PLT-010
responsables: Kleber Toapanta / Jesus Navarrete
---

# Arquitectura y Plan Maestro de Reemplazo de ManyChat por el Centro de Ventas Omnicanal (`PLT-010`)

## 1. Propósito Estratégico

Sustituir por completo la suscripción y dependencia operativa de **ManyChat** mediante un **Centro Unificado de Ventas y Monitoreo Omnicanal (`consola_chat` / `/panel/conversaciones`)** nativo del ecosistema, compartido por los 4 negocios (**Tinkay Floristería**, **Margaritas Floristería**, **Tranqi**, **FastFix Home**) desde `@eco/comercio` y conectado en tiempo real con:

1. **E-Commerce y Portal Propio (Fase 1 — Implementado y Activo):**
   - Monitoreo en tiempo real de todos los **Chats desde la Web** (`ChatAriaFlotante` y rutas `/api/chat`).
   - Registro estricto y auditado de **Respuestas de IA (ARIA)** vs. **Intervenciones Humanas de Vendedores** (`mensajes_ia_conteo` vs. `mensajes_humano_conteo`, autoría con UUID de `seg_usuario` y marca de tiempo).
   - **Toma de control bidireccional en vivo (*Human-in-the-Loop*):** cuando un vendedor toma una conversación (`EN_ATENCION_ASESORA`) o envía una respuesta humana, ARIA se silencia automáticamente en ese hilo y el comprador en la tienda web recibe en vivo los mensajes del asesor con su nombre; cuando el asesor pulsa **Reactivar IA**, ARIA retoma la atención autónoma.
   - **Visión 360° de Usuarios y Compras Web:** directorio unificado de **Usuarios Registrados en la Web** (`seg_membresia` / `seg_usuario`) + **Compradores No Registrados / Invitados** (`com_cliente` / `USUARIO_NO_AUTORIZADO`), cruzado automáticamente por correo, WhatsApp normalizado (`+593...`) o sesión de chat con todas las **Compras y Proformas de Eventos** (`com_proforma`).
   - **Paridad Operativa con ManyChat:** bandeja lateral con vistas rápidas (*Todos*, *No asignado*, *Asignado a mí*, *Escalados*, *IA ARIA Activa*, *Recordatorios*, *Cerrados*), **Etiquetas personalizables** (*Seguimiento*, *Pagado*, *Hoy*, *Evento*, *SUR*, *Condolencias*, *VIP*), **Equipo de Ventas con asignación por asesor**, **Mensajes Predeterminados (`/atajos` con variables `{{nombre}}` y `{{asesor}}`)**, **Notas Internas** y **Recordatorios de Seguimiento**.
2. **WhatsApp Business Cloud API vía YCloud + Motor de Flujos (Fase 2).**
3. **Facebook Messenger + Instagram Direct / Comentarios / Historias vía Meta Graph API Directa (Fase 3 — $0 costo de intermediarios SaaS).**
4. **TikTok (Bio/Ads Attribution, Lead Generation Webhook API y Business Messaging API — Fase 4).**

---

## 2. Arquitectura Unificada de Canales y Adaptadores

Todos los canales convergen en el mismo modelo canónico de base de datos (`comun_agentes`) y se operan desde el mismo widget `ConsolaVentasOmnicanal` (`@eco/comercio`):

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CANALES DE ENTRADA / SALIDA                         │
├──────────────────┬──────────────────┬────────────────────┬─────────────────┤
│  🌐 Chat Web     │  💬 WhatsApp     │  📸 Instagram &    │  🎵 TikTok      │
│  Tienda / Portal │  vía YCloud API  │  📘 FB Messenger   │  Leads + DM API │
│  (Fase 1 ACTIVO) │  (Fase 2)        │  Meta Graph v21    │  (Fase 4)       │
└────────┬─────────┴────────┬─────────┴─────────┬──────────┴────────┬────────┘
         │                  │                   │                   │
         ▼                  ▼                   ▼                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│           CAPA NORMALIZADORA DE EVENTOS OMNICANAL (Edge / Route)           │
│  • Valida firma HMAC (X-YCloud-Signature / X-Hub-Signature-256 / TikTok)   │
│  • Resuelve identidad 360° (seg_usuario / com_cliente / clave_hilo)        │
│  • Evalúa ventana de mensajería (24h estándar / 7d HUMAN_AGENT en Meta)    │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             MÁQUINA DE ESTADOS & ORQUESTADOR IA vs. HUMANO                 │
│  • BOT_ACTIVO ──► Motor de Flujos (agc_flujo_automatizacion) o ARIA MCP    │
│  • ESCALADO_HUMANO ──► Alerta sonora/visual + Push al equipo de Ventas     │
│  • EN_ATENCION_ASESORA ──► Silencia ARIA; despacho exclusivo de Vendedor   │
│  • EN_ESPERA_CLIENTE / CERRADO ──► Métricas de conversión y comisiones     │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│       SUPABASE MULTI-TENANT (`comun_agentes` + `comun_comercio` RPCs)      │
│  • agc_conversacion (cnv_)  • agc_mensaje (msg_)  • agc_etiqueta (etq_)    │
│  • agc_conversacion_etiqueta (cet_)  • com_cliente_etiqueta (cle_)         │
│  • agc_respuesta_rapida (rrp_)       • agc_flujo_automatizacion (flj_)     │
│  • Supabase Realtime WebSockets ──► ConsolaVentasOmnicanal (/conversaciones)│
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Datos Implementado (`20261115000007_omnicanal_chats_etiquetas_respuestas_y_ventas.sql`)

Cumple al 100% con [`00-nomenclatura-base-datos.md`](../../estandares/00-nomenclatura-base-datos.md) y [`seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) (RLS estricto + `aud_fn_auditar_tabla()`):

| Esquema y Tabla | Prefijo | Propósito |
| :--- | :---: | :--- |
| `comun_agentes.agc_conversacion` | `cnv_` | Hilo único por `(cnv_negocio, cnv_canal, cnv_clave_hilo)`. Controla `cnv_estado_atencion`, `cnv_asesora_asignada_id`, `cnv_ventana_24h_vence_en`, `cnv_recordatorio_en`, `cnv_notas_internas` y contadores separados `cnv_mensajes_cliente_conteo`, `cnv_mensajes_ia_conteo`, `cnv_mensajes_humano_conteo`. |
| `comun_agentes.agc_mensaje` | `msg_` | Bitácora inmutable de cada burbuja con `msg_origen` (`CLIENTE`, `BOT_ARIA`, `ASESORA_HUMANA`, `FLUJO_AUTOMATICO`, `SISTEMA`), `msg_autor_usuario_id` (vendedor autenticado), `msg_aria_run_id`, `msg_tipo_contenido` (`TEXTO`, `NOTA_INTERNA`, `ORDEN_WEB`, `UBICACION`, `PLANTILLA`, etc.) y estado de entrega (`ENVIADO`, `ENTREGADO`, `LEIDO`, `FALLIDO`). |
| `comun_agentes.agc_etiqueta` | `etq_` | Catálogo de etiquetas por negocio con color hexadecimal e ícono (pre-sembradas con las etiquetas reales de operación en ManyChat: `Seguimiento`, `Pagado`, `Hoy`, `Evento`, `SUR`, `Condolencias`, `Cliente VIP`, `Chat Web`). |
| `comun_agentes.agc_conversacion_etiqueta` | `cet_` | Tabla puente N:M explícita entre conversaciones y etiquetas (sin arreglos de UUIDs). |
| `comun_comercio.com_cliente_etiqueta` | `cle_` | Tabla puente N:M explícita entre fichas CRM (`com_cliente`) y etiquetas. |
| `comun_agentes.agc_respuesta_rapida` | `rrp_` | Mensajes predeterminados invocables con `/atajo` en la caja de respuesta, con variables dinámicas `{{nombre}}` y `{{asesor}}` y contador de uso. |
| `comun_agentes.agc_flujo_automatizacion` | `flj_` | Definición declarativa de disparadores (*palabra clave*, *comentario en post/reel*, *primer mensaje*, *carrito/orden*) y grafo JSONB de nodos para Fase 2. |

> **Nota de Exposición PostgREST:** Dado que `comun_comercio` ya se encuentra publicado en `db_schemas` de PostgREST en todos los entornos, las funciones transaccionales `SECURITY DEFINER` (`com_fn_omnicanal_*`) residen en `comun_comercio` con `SET search_path = ''`, garantizando disponibilidad inmediata tras aplicar la migración sin requerir cambios manuales en la configuración global del proyecto Supabase. Adicionalmente, `acciones-omnicanal.ts` incorpora respaldo híbrido automático sobre `comun_configuracion.cfg_negocio` mientras la migración SQL no haya sido ejecutada aún.

---

## 4. Guía Técnica para Integrar Facebook, Instagram y TikTok (Cómo Reemplazar a ManyChat en Redes Sociales)

ManyChat actúa internamente como un cliente OAuth conectado a las APIs oficiales de Meta y TikTok. Nuestro portal puede conectarse **directamente** a esas mismas APIs oficiales sin pagar licencias por contacto a ManyChat:

### 4.1. Facebook Messenger + Instagram (DMs, Respuestas a Historias y Comentarios-a-DM)

Ambos canales utilizan **exactamente la misma plataforma técnica oficial de Meta (`Meta Graph API v21.0`)**, con costo **$0 USD por mensaje** (Meta no cobra por mensajes de Messenger ni Instagram Direct; únicamente cobra plantillas salientes de WhatsApp):

1. **Requisitos Previos del Negocio (1 sola vez por marca):**
   - Tener una **Página de Facebook** del negocio (ej. *Tinkay Floristería*).
   - Tener la cuenta de **Instagram en modo Profesional (Business o Creator)** vinculada a esa Página de Facebook desde *Configuración de Instagram → Cuentas vinculadas → Facebook*.
   - Activar en la app móvil de Instagram: *Configuración y actividad → Mensajes y respuestas a historias → Controles de mensajes → Permitir acceso a los mensajes (Herramientas conectadas: ON)*. *(Si este switch está apagado, ningún sistema externo —ni ManyChat ni nuestro portal— recibe webhooks de Instagram).*

2. **Configuración en Meta for Developers (`developers.facebook.com`):**
   - Crear una **Meta App** tipo **Empresa (Business)** para el Ecosistema (una sola Meta App verificada en nuestro Meta Business Portfolio puede conectar las páginas de Tinkay, Margaritas, FastFix y Tranqi).
   - Agregar los productos **Messenger** e **Instagram** (y **Webhooks**).
   - Generar un **Token Permanente de Usuario del Sistema (`System User Access Token`)** desde *Configuración del Negocio → Usuarios → Usuarios del Sistema*, asignándole las Páginas e Instagrams del ecosistema, y guardarlo cifrado en **Supabase Vault** (`cfg_omnicanal_canal`).

3. **Permisos Oficiales (Scopes) Requeridos:**
   - **Facebook Messenger:** `pages_show_list`, `pages_manage_metadata`, `pages_messaging`.
   - **Instagram Direct & Historias:** `instagram_business_basic` (o `instagram_basic`), `instagram_business_manage_messages` (o `instagram_manage_messages`).
   - **Automatización "Comenta la palabra PRECIO y te envío info al DM" (Comment-to-DM de ManyChat):** `instagram_business_manage_comments` (junto con `pages_read_engagement` para comentarios de Facebook). Meta permite enviar **1 respuesta privada (`Private Reply`) por DM** dentro de los **7 días** posteriores al comentario del usuario usando `POST /{ig-user-id}/messages` con `recipient: { "comment_id": "<COMMENT_ID>" }`.

4. **Webhooks Entrantes y Salientes:**
   - **Endpoint en el Ecosistema:** `supabase/functions/meta-omnicanal-webhook/index.ts` (o `/api/webhooks/meta`).
   - **Verificación `GET`:** valida `hub.mode === 'subscribe'` y `hub.verify_token`, devolviendo `hub.challenge`.
   - **Recepción `POST`:** valida obligatoriamente la firma criptográfica `X-Hub-Signature-256` (HMAC-SHA256 con el `App Secret` guardado en Vault). Normaliza eventos `messaging` (Messenger e Instagram DMs, menciones en Stories, reacciones, `postbacks` de botones) y `changes` (`comments` / `live_comments`) hacia `comun_agentes.agc_conversacion` (`canal = 'instagram'` o `canal = 'facebook'`).
   - **Envío de Respuestas (IA ARIA o Vendedor Humano):**
     - Messenger: `POST https://graph.facebook.com/v21.0/{PAGE_ID}/messages` con `{ recipient: { id: PSID }, message: { text } }`.
     - Instagram: `POST https://graph.facebook.com/v21.0/{IG_ID}/messages` con `{ recipient: { id: IGSID }, message: { text } }`.

5. **Regla Crítica de Ventana de Mensajería de Meta (24 Horas + Etiqueta `HUMAN_AGENT` de 7 Días):**
   - **Primeras 24 horas** desde el último mensaje o interacción del cliente: tanto **ARIA (IA)** como los **vendedores humanos** pueden responder libremente texto, fotos del catálogo, botones y links de compra (`cnv_ventana_24h_vence_en` ya modelado en nuestra tabla `agc_conversacion`).
   - **Del día 2 al día 7 (Exclusivo para Vendedores Humanos desde nuestra Consola HITL):** Meta habilita la etiqueta `messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT"` cuando un **agente humano real** responde consultas que requirieron más de 24 horas (ej. cotización de boda o seguimiento). Nuestra `ConsolaVentasOmnicanal` adjunta automáticamente `HUMAN_AGENT` cuando `msg_origen = 'ASESORA_HUMANA'` y han pasado más de 24h pero menos de 7 días, bloqueando envíos automáticos de IA fuera de las 24h para proteger la cuenta ante Meta.

6. **Paso de Publicación (`Meta App Review`):**
   - Mientras la Meta App está en *Modo Desarrollo*, ya funciona al 100% con las cuentas administradoras/testers del equipo.
   - Para recibir mensajes de **cualquier cliente público**, se envía la App a **Meta App Review** adjuntando un video corto (screencast de 2 minutos) de nuestra nueva pantalla `/panel/conversaciones` mostrando cómo llega un mensaje de Instagram/Facebook y cómo responde una asesora humana. (Al tener ya construida `ConsolaVentasOmnicanal`, cumplimos exactamente el requisito visual que exige Meta).

---

### 4.2. TikTok (Cómo Reemplazar e Igualar a ManyChat en TikTok)

A diferencia de Meta, **TikTok restringe el acceso a su `Business Messaging API` (DMs nativos)** únicamente a cuentas Business registradas (no cuentas personales ni de creador en ciertas regiones) y exige aprobación de aplicación en el **TikTok for Developers / TikTok Business Messaging Partner Portal**, además de imponer una ventana estricta de **48 horas** tras el mensaje iniciado por el usuario (sin soporte multimedia idéntico en todas las regiones).

Por ello, diseñamos una **Estrategia de 3 Niveles para TikTok** que permite capturar ventas desde el Día 1 sin depender de ManyChat:

1. **Nivel T1 — Atribución Directa en Bio, Comentarios Fijados y TikTok Ads (`Día 1 · $0`):**
   - Enlace inteligente en la biografía de TikTok y botones de TikTok Ads hacia `https://tinkay-web.vercel.app/?utm_source=tiktok&utm_campaign={video_o_coleccion}&chat=abierto` o link profundo a nuestra línea de WhatsApp YCloud con código de rastreo.
   - El Chat Web y el Webhook de YCloud detectan `utm_source=tiktok` y aplican automáticamente la etiqueta **`🎵 TikTok`** en `ConsolaVentasOmnicanal`, atribuyendo la conversación y el pedido web a TikTok.

2. **Nivel T2 — TikTok Lead Generation API Oficial (Autoservicio Directo en TikTok for Business):**
   - Para campañas de **TikTok Instant Forms** (cotizaciones de bodas/eventos, planes legales de Tranqi o mantenimientos de FastFix), TikTok ofrece un **Webhook oficial autoservicio (`CRM / Lead Webhook`)** en *TikTok Ads Manager → Assets → Instant Pages*.
   - Al enviar el formulario en TikTok, nuestro endpoint `supabase/functions/tiktok-webhook` recibe el lead en `< 2 segundos`, crea el contacto y conversación en `agc_conversacion` (`canal = 'tiktok'`), notifica a los vendedores en `/panel/conversaciones` y dispara automáticamente el mensaje de bienvenida por **WhatsApp (YCloud)** con plantilla aprobada.

3. **Nivel T3 — TikTok Business Messaging API Nativa (Bandeja de DMs de TikTok):**
   - Cuenta TikTok en modo **TikTok Business Account (Empresa verificada con RUC)**.
   - Registro en `developers.tiktok.com` / `business-api.tiktok.com` solicitando los scopes `biz.spark.auth`, `business.message.read`, `business.message.write` y configurando el Webhook de eventos `im.receive_msg`.
   - Nuestro esquema `agc_conversacion` ya soporta nativamente `cnv_canal = 'tiktok'` y `cnv_ventana_24h_vence_en` (ajustado a las **48 horas** de TikTok y límite de hasta 5 mensajes consecutivos antes de respuesta del usuario). Mientras TikTok aprueba las credenciales directas de desarrollador si se requieren DMs orgánicos, se puede usar temporalmente cualquier conector puente hacia nuestro webhook sin cambiar una sola línea de la consola de vendedores.

---

## 5. Hoja de Ruta por Fases de Implementación

| Fase | Alcance | Estado |
| :--- | :--- | :---: |
| **Fase 1 (Actual)** | Esquema `comun_agentes` + RPCs `com_fn_omnicanal_*`, widget compartido `ConsolaVentasOmnicanal` (`/panel/conversaciones`) en las 4 apps, monitoreo e intervención humana en vivo sobre **Chats Web** (silenciado y reactivación de ARIA), etiquetas, `/atajos`, notas internas, recordatorios y vista 360° de **Usuarios Registrados + Invitados + Compras Web**. | ✅ **100% Implementado** |
| **Fase 2 (Siguiente)** | **WhatsApp Business vía YCloud + Motor de Flujos:** Edge Function `ycloud-webhook` (validación HMAC `X-YCloud-Signature`), despacho saliente desde `ConsolaVentasOmnicanal` vía `POST https://api.ycloud.com/v2/whatsapp/messages`, plantillas HSM fuera de ventana de 24h y constructor/ejecutor de flujos conversacionales sobre `agc_flujo_automatizacion`. | ⏳ Planificado |
| **Fase 3** | **Instagram & Facebook Messenger (Meta Graph API v21.0):** Edge Function `meta-omnicanal-webhook`, OAuth / System User Token en Supabase Vault, recepción y respuesta de DMs, menciones en Historias, automatización *Comentario-a-DM* (`Private Replies`) y control automático de ventana 24h + `HUMAN_AGENT` (7 días). | ⏳ Planificado |
| **Fase 4** | **TikTok Omnicanal:** Atribución automática UTM (`🎵 TikTok`), `tiktok-webhook` para TikTok Lead Generation Instant Forms (+ disparo automático a WhatsApp YCloud) y conector nativo TikTok Business Messaging API (ventana 48h). | ⏳ Planificado |
