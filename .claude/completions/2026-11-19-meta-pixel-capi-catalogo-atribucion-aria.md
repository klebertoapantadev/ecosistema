# 2026-11-19 — Meta Pixel + Conversions API (CAPI), Catálogo XML Facebook/WhatsApp y Atribución ARIA (`PLT-025`)

## Resumen de Implementación

1. **Gobernanza y Base de Datos (`PLT-025`)**:
   - Especificación documentada y matriz actualizada al **100%** en `gobernanza/productos/plataforma/especificacion-funcional.md`.
   - Migración `supabase/migrations/20261119000008_cfg_marketing_meta_capi_catalogo_y_widget.sql`:
     - Tabla `comun_configuracion.cfg_marketing_meta` con RLS habilitado y auditoría `aud_fn_auditar_tabla()`.
     - Almacenamiento cifrado del `Meta CAPI Access Token` en `vault.secrets`.
     - Despacho servidor `cfg_fn_enviar_evento_meta_capi` vía `pgsql-http` + Vault sin exponer secretos al cliente ni requerir variables manuales en Vercel.
     - Registro y pre-asignación por defecto del widget `configuracion_marketing_meta` para `ADMINISTRADOR` y `SUPERADMIN` en los 4 negocios (`tranqi`, `fastfix`, `tinkay`, `margaritas`).

2. **Consola Administrativa por Negocio (`@eco/configuracion-negocio`)**:
   - Pestaña **Marketing & Meta** (`/panel/marketing-meta` y `ConsolaConfiguracionUnificada.tsx`) con Pixel ID, Verificación de Dominio, Token CAPI en Vault, Test Event Code, botón **Probar CAPI**, URL copiable del Feed de Catálogo y fórmula UTM para Meta Ads.
   - Pre-configurado en las 10 superficies del ecosistema (`widget-registration-enforcer`).

3. **Embudo Híbrido Pixel + CAPI con Deduplicación Exacta (`@eco/comercio` + Ecommerce)**:
   - Eventos cliente: `PageView`, `ViewContent` (SKU exacto como `TIN-VAR-7`), `AddToCart`, `InitiateCheckout`, `Lead` y `Purchase` con `event_id` compartido.
   - Eventos servidor CAPI con *Advanced Matching* SHA-256 (`em`, `ph`, `fn`, `ln`, `country: 'ec'`, `_fbc`, `_fbp`, `ctwa_clid`):
     - Pago con tarjeta aprobado en PLUX (`acciones-plux.ts`).
     - Aprobación operativa de pedidos por Transferencia Bancaria / QR DeUna (`acciones-logistica.ts`).
     - Emisión de Proformas de Eventos (`Lead` en `acciones-logistica.ts`).

4. **Feed XML Vivo para Facebook, Instagram y WhatsApp Business (`/api/catalogo/meta-feed.xml`)**:
   - Habilitado en las 4 apps (`tinkay-web`, `margaritas-web`, `fastfix-web`, `tranqi-web`) filtrando productos activos y en vigencia temporal (`SIEMPRE`, `RANGO_FECHAS`, `ESTACIONAL_ANUAL`) con enlace profundo `?variante=SKU`.

5. **Atribución Publicitaria e Intención Comercial para ARIA (Web y WhatsApp YCloud)**:
   - Captura en navegador (30 días) de `utm_*`, `fbclid` (`_fbc`, `_fbp`), categoría y arreglo visto, adaptando saludo inicial, mensaje contextual de WhatsApp e instrucciones de tono para ARIA (ej. tono sobrio sin emojis festivos en `CONDOLENCIAS`; consultivo/proforma en `EVENTOS`).
   - Extracción de `inboundWa.referral` en `procesarWebhookYcloudOmnicanalAction` (`acciones-omnicanal.ts`) para anuncios Click-to-WhatsApp, visible para asesoras humanas e inyectado en el prompt de ARIA.
