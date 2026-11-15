# Cierre de Tarea — Reemplazo de ManyChat y Centro de Ventas Omnicanal Fase 1 (`PLT-010`)

- **Fecha:** 2026-11-15
- **Requerimiento:** `PLT-010` (Avance actualizado a `80%` en `gobernanza/productos/plataforma/especificacion-funcional.md` — Fase 1 100% operativa exclusivamente con Chat Web)
- **Widget Canónico:** `consola_chat` (`/panel/conversaciones`)

## Entregables Completados (Fase 1 — Exclusivamente Chat Web + Usuarios Web + Compras Web)

1. **Migración SQL Idempotente (`supabase/migrations/20261115000007_omnicanal_chats_etiquetas_respuestas_y_ventas.sql`)**:
   - Esquema `comun_agentes` con RLS estricto (`seg_fn_es_equipo_ventas_negocio`) y triggers `aud_fn_auditar_tabla()` en `agc_conversacion`, `agc_mensaje`, `agc_etiqueta`, `agc_conversacion_etiqueta`, `com_cliente_etiqueta`, `agc_respuesta_rapida` y `agc_flujo_automatizacion`.
   - Columnas alineadas 100% con el DDL real de `seg_usuario` (`usu_whatsapp`, `usu_cedula`, `usu_autorizacion_whatsapp`, `usu_detalle_usuario->>'foto'`) y `seg_rol_widget` (`rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible`).
   - Publicación `supabase_realtime` sobre `agc_conversacion` y `agc_mensaje`.
   - RPCs `SECURITY DEFINER` en `comun_comercio` (`com_fn_omnicanal_*`) y pre-asignación del widget `consola_chat` en `seg_widget` y `seg_rol_widget` para `VENTAS`, `VENDEDOR`, `OPERADOR`, `ADMINISTRADOR` y `SUPERADMIN`.
2. **Paquete Compartido `@eco/comercio` (Enfoque 100% Fase 1 Chat Web)**:
   - `omnicanal.ts` + pruebas unitarias (`55/55` tests del paquete en verde).
   - `acciones-omnicanal.ts` con persistencia primaria en RPCs de PostgreSQL, auto-extracción de correo/celular en mensajes del Chat Web y respaldo híbrido automático sobre `cfg_negocio`.
   - `ConsolaVentasOmnicanal.tsx` depurada exclusivamente para **Chat Web** (sin selectores ni tarjetas placeholder de canales aún no conectados, 100% estilos inline + CSS nativo, cero clases Tailwind, DataGrid de 2 capas para Compras Web y Usuarios/Contactos Web, bandeja HITL estilo ManyChat, etiquetas, `/atajos`, notas internas, recordatorios y métricas IA vs. Humano).
3. **Integración End-to-End en Vivo con Chat Web, Checkout y Proformas**:
   - `apps/tinkay-web/app/api/chat/route.ts` y `ChatAriaFlotante.tsx`: identificación automática de usuarios autenticados o barra ligera opcional para visitantes invitados (`eco_chat_visitante_tinkay`), registro de respuestas tanto de ARIA como del catálogo de respaldo y recepción en vivo de respuestas humanas cada 4.5s.
   - `ModalCheckoutTinkay.tsx`, `DrawerProformaEvento.tsx` y `acciones-logistica.ts`: publicación automática de hitos `EVENTO_ORDEN` (`🛍️ Orden Web` y `📋 Proforma de Evento`) dentro del hilo activo del Chat Web del visitante.
   - `apps/tranqi-web/app/api/chat/route.ts` y `apps/tranqi-web/app/page.tsx`: persistencia de `eco_chat_conv_tranqi`, exclusión de eventos automáticos de scroll (`[CONTEXTO:`) para no contaminar la bandeja y recepción en vivo de intervenciones de asesores humanos.
4. **Registro de 10 Puntos (`widget-registration-enforcer`) y Rutas en las 4 Apps**:
   - Habilitado `/panel/conversaciones` en `tinkay-web`, `margaritas-web`, `fastfix-web` y `tranqi-web`, más los 10 puntos obligatorios de registro y pre-configuración por rol.
5. **Gobernanza y Arquitectura**:
   - Creado `gobernanza/productos/plataforma/arquitectura-omnicanal-reemplazo-manychat.md` con guía detallada para YCloud WhatsApp, Meta Graph API (Facebook Messenger + Instagram) y TikTok.
   - Actualizada matriz de avance en `gobernanza/productos/plataforma/especificacion-funcional.md`.
