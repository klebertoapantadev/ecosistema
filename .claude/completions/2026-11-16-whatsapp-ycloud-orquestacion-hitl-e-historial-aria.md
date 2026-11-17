# Completado: Fase 2 Omnicanal — Orquestación WhatsApp Business (YCloud) + HITL + Importador de Historial ARIA

**Fecha:** 2026-11-16
**Requerimientos:** `PLT-010`, `TNK-004`

## Respaldo exacto de configuración previa (Plan de Rollback en 10s)
- **YCloud → Developers → Webhooks (previo):**
  - Endpoint URL: `https://aria.midomo.site/v1/channels/whatsapp/webhook/c023d946ca1549a5899c6d6faf883ebf`
  - Description: `Agente Tinkay- ARIA` (`21 events selected`)
- **Consola ARIA (`consola.aria.midomo.site`) → Canales (previo):**
  - Canal: `Tinkay-YCloud` (`WhatsApp (YCloud)`)
  - Agente: `Mía · Tinkay WhatsApp`
  - Número emisor (E.164): `+593 996438873`
  - Responder solo a estos números: `+593 99 972 7844`
- **Cómo revertir en 10 segundos si se requiere:** pegar nuevamente la URL anterior en YCloud y volver a activar el switch `Habilitado` en `consola.aria.midomo.site → Canales → Tinkay-YCloud`.

## Resumen de lo implementado
1. **Migración SQL + Supabase Vault (`20261116000003_omnicanal_whatsapp_ycloud_orquestacion_e_historial.sql`):**
   - Almacenamiento cifrado en `vault.secrets` (`ari_ycloud_api_secreto_id`, `ari_ycloud_webhook_secreto_id`, `ari_whatsapp_agente_secreto_id`).
   - Receptor idempotente de Webhooks YCloud (`com_fn_omnicanal_procesar_webhook_ycloud`): soporta `whatsapp.inbound_message.received` (texto, foto, ubicación GPS, botones), `whatsapp.smb.message.echoes` (mensajes enviados desde la app móvil WhatsApp Business que activan automáticamente `EN_ATENCION_ASESORA`) y `whatsapp.message.updated` (estados `ENTREGADO` / `LEIDO`).
   - Protección anti-bucle de despedidas bot-a-bot y filtro idéntico de lista blanca (`ycloud_numeros_permitidos`).
   - Despacho directo a WhatsApp (`POST https://api.ycloud.com/v2/whatsapp/messages/sendDirectly`) al responder como asesora humana o como Mía (ARIA).
   - Importador de historial previo desde ARIA (`/v1/runs`) mediante `com_fn_omnicanal_sincronizar_historial_aria`.
2. **Webhook en Tinkay (`/api/webhooks/ycloud/[token]/route.ts`) y Panel `/panel/aria` + `/panel/conversaciones`:**
   - Tarjeta completa en `/panel/aria` (`FormularioAria.tsx`) con generador/copiado de URL del Webhook y caja permanente de respaldo de la URL previa de ARIA.
   - Selector `Todos / 📱 WA / 🌐 Web` y botón `Importar ARIA` en `ConsolaVentasOmnicanal.tsx`.
