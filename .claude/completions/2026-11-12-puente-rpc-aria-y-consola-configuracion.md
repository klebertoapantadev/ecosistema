# Cierre: Puente RPC Vault-ARIA (`cfg_fn_invocar_aria`) y Rediseño Unificado de Configuración

**Fecha:** 2026-11-12

## Causa raíz del fallo en "Probar Agente" (`/panel/aria`)
- El guardado de `ARIA_AGENT_KEY` en Supabase Vault funcionó (`200 OK`, `cfg_fn_guardar_aria`).
- Al presionar **Probar Agente**, `invocarAgentePorNegocio("tinkay", ...)` llamaba a `/functions/v1/invocar-aria`, la cual devolvía `404` por no estar desplegada aún mediante Supabase CLI. El código interpretaba `404` igual que `409` ("sin credenciales") y lanzaba `ErrorSinConfiguracionAria`.

## Solución implementada
1. **Puente SQL Síncrono (`supabase/migrations/20261112000001_cfg_fn_invocar_aria_rpc.sql`)**:
   - Activa `extensions.http` (`pgsql-http`) con `CURLOPT_TIMEOUT = 45` y `statement_timeout = 50000`.
   - Crea `comun_configuracion.cfg_fn_invocar_aria(p_negocio, p_prompt, p_conversation_id)` (`SECURITY DEFINER`) que lee `vault.decrypted_secrets` dentro de PostgreSQL e invoca `${base_url}/v1/agents/${agente_id}/invoke` sin exponer jamás `api_key`.
   - `packages/agentes-ia/src/index.ts` cae automáticamente en `/rest/v1/rpc/cfg_fn_invocar_aria` cuando `/functions/v1/invocar-aria` devuelve `404`.
2. **Rediseño Ejecutivo y Agrupación del Módulo de Configuración (`@eco/configuracion-negocio`)**:
   - Formularios estructurados en tarjetas sobrias sin colisiones de CSS global (`FormularioConfiguracionNegocio`, `FormularioAria` con prueba interactiva y vista previa de respuesta, `FormularioSmtp`, `GestionTokensMcpWidget`).
   - Consola unificada por pestañas (`ConsolaConfiguracionUnificada`) con indicadores de estado y navegación lateral agrupada (`NavegacionPanelLateral`) en `tinkay-web`, `fastfix-web` y `margaritas-web`.

