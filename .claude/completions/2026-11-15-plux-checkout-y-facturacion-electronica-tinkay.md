# Cierre de Tarea — Solución Checkout PLUX (`com_proforma`) y Facturación Electrónica SRI Multiempresa (`PLT-006` / `TNK-002`)

**Fecha:** 2026-11-15  
**Rama:** `master`

## 1. Problema Resuelto
- Al intentar pagar con tarjeta en `tinkay-web` (`ModalCheckoutTinkay`) como comprador invitado (`anon`) o cuando las migraciones RPC aún no estaban aplicadas en remoto, el fallback intentaba un `INSERT` directo sobre `comun_comercio.com_proforma`, bloqueado por RLS con `permission denied for table com_proforma`.
- El motor de Facturación Electrónica (`WidgetFacturacionElectronica`) usaba datos quemados de Tranqi (`1790016919001`, IVA 15% fijo) y carecía de pantallas administrativas para configurar el emisor tributario SRI, régimen (`RIMPE_EMPRENDEDOR`, `RIMPE_NEGOCIO_POPULAR`, `GENERAL`), serie `001-001`, secuenciales, ambiente (`Pruebas CELCER` / `Producción CEL`) y firma electrónica `.p12` en Vault.

## 2. Solución Implementada
1. **Checkout PLUX resiliente para invitados y autenticados:**
   - Token criptográfico compacto firmado en servidor (`HMAC-SHA256` + `zlib` en `packages/comercio/src/token-orden-firmada.ts`) que respalda órdenes y proformas sin exponer ni permitir manipular montos/ítems si una migración RPC aún está pendiente, eliminando por completo `permission denied for table com_proforma`.
   - Migración consolidada e idempotente `supabase/migrations/20261115000005_tinkay_plux_checkout_proformas_y_facturacion_sri.sql` con todos los RPCs `SECURITY DEFINER` de pedidos, proformas, PLUX multiempresa y facturación SRI.
2. **Facturación Electrónica SRI en Tinkay y demás negocios (`@eco/comercio`):**
   - Motor puro `packages/comercio/src/ride-sri.ts` (Clave de Acceso de 49 dígitos Módulo 11, desglose `Subtotal 0%` + `Subtotal 15%` + `IVA 15%` + líneas detalladas de pedido y envío, renderizador RIDE HTML/PDF con los datos reales del negocio).
   - Tarjeta de descarga e impresión inmediata del RIDE PDF al aprobarse el pago con PLUX en `ModalCheckoutTinkay.tsx` y `VistaProformaEventoCliente.tsx`, además de vista cliente en `/panel/cuenta` y consola operativa en `/panel/facturacion`.
3. **Pantallas de Configuración de Parámetros de Facturación SRI (`configuracion_facturacion_sri`):**
   - Componente compartido `ConfiguracionFacturacionSri.tsx` y Server Actions `acciones-facturacion-sri.ts` con validación `node-forge` PKCS#12 y custodia cifrada en Supabase Vault.
   - Integrado en `/panel/facturacion-sri` (`ConsolaConfiguracionUnificada` para `tinkay-web`, `margaritas-web`, `fastfix-web`) y `/panel/configuracion?widget=configuracion_facturacion_sri` (`tranqi-web`) con registro completo de los 10 puntos de `widget-registration-enforcer`.
