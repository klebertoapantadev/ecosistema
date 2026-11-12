# Cierre de Tarea — Logística de Entrega a Domicilio, Zonas de Cobertura en Pichincha y Tarifación por Km (Tinkay & Plataforma)

**Fecha:** 2026-11-12  
**Requerimientos:** `PLT-009` (§23), `PLT-011`, `TNK-002`, `TNK-004`, `TNK-005`  
**Rama:** `master`

## Resumen de lo implementado

1. **Motor Geoespacial Isomórfico (`packages/comercio/src/logistica.ts` + `logistica.test.ts`):**
   - Algoritmo Ray-Casting `puntoEnPoligono` sobre 7 polígonos pre-sembrados de Pichincha (`Centro-Norte de Quito` gratis `$0.00`, `Cumbayá / Nayón`, `Tumbaco / Puembo`, `Valle de los Chillos`, `Sur de Quito`, `Calderón / Carapungo`, `Pomasqui / Mitad del Mundo`).
   - Extractor y expansor de enlaces de **Google Maps** (incluyendo URLs cortas `maps.app.goo.gl/...` priorizando `!3d!4d`), **Apple Maps**, **Waze** y coordenadas directas.
   - Enrutamiento vial real en automóvil con **OSRM** desde el taller de Tinkay (`-0.1648075, -78.466175`) con respaldo topográfico (`Haversine × 1.32`) y búsqueda de direcciones en Pichincha con **Nominatim**.
   - Fórmula híbrida fuera de zona fija: `Máx($1.00, (Distancia Vial km × $0.50) − $3.00 de subsidio base absorbido)`.
   - 12 pruebas unitarias nuevas en `logistica.test.ts` (25/25 tests en verde en `@eco/comercio`).

2. **Esquema SQL y Respaldo Transparente (`supabase/migrations/20261112000003_com_logistica_cobertura_zonas_y_tarifas.sql` + `acciones-logistica.ts`):**
   - Tablas `comun_comercio.com_logistica_negocio` y `comun_comercio.com_zona_cobertura` con RLS al 100%, triggers `aud_fn_auditar_tabla()`, RPC transaccional `com_fn_guardar_logistica_negocio` y espejo automático en `comun_configuracion.cfg_negocio.cfg_detalle_configuracion.logistica`.
   - Registro y pre-asignación del widget `configuracion_logistica` (`/panel/logistica`) en los 10 puntos obligatorios de `widget-registration-enforcer`.

3. **Consola Administrativa y Configuración por Producto:**
   - `FormularioLogisticaCobertura.tsx` + `MapaCoberturaPichincha.tsx` integrados en `/panel/logistica` y en `ConsolaConfiguracionUnificada` (`@eco/configuracion-negocio`).
   - `ModalEditarProducto.tsx` carga automáticamente el sector de envío gratis del negocio (`Centro-Norte de Quito`), permite definir `recargo_transporte_usd` opcional por producto y enlaza directo a `/panel/logistica`.

4. **E-Commerce Web, Chat Mía y Servidor MCP WhatsApp/ARIA:**
   - `SelectorUbicacionEntrega.tsx` integrado en `DrawerCarritoFloristeria.tsx` (entrega unificada e individual) y `ChatAriaFlotante.tsx` (botón `📍` en chat + detección automática de URLs en `/api/chat`).
   - Herramienta MCP `cotizar_envio_domicilio` expuesta en `@eco/agentes-ia` (`mcp-catalogo.ts`) y activa en `/api/mcp/catalogo` para uso inmediato desde WhatsApp (YCloud) y ARIA.

