# Cierre de Tarea — Inventario IA de Rosas, Galería Entrega Inmediata (1–2h) y Entregas Georreferenciadas Offline + Informes IESS

- **Fecha:** 2026-11-15
- **Requerimiento:** `TNK-005` (`100%`) / `PLT-009` / `PLT-011`
- **Entregables completados:**
  1. **Migración SQL Idempotente (`supabase/migrations/20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql`)**:
     - `comun_comercio.com_inventario_corte` + sincronización automática a `com_insumo`, `com_inventario` y `com_kardex`.
     - Colección `entrega-inmediata`, RPCs `com_fn_listar_entrega_inmediata`, `com_fn_publicar_entrega_inmediata`, `com_fn_descartar_entrega_inmediata` y trigger automático `trg_com_proforma_descontar_inmediata` al venderse en web.
     - `comun_comercio.com_convenio_entrega` (semilla *Exequiales del IESS*), `com_entrega_evidencia` (doble flujo `ORDEN_TRABAJO_CONVENIO` vs `PEDIDO_TIENDA` con idempotencia offline `ent_uuid_cliente`) y `com_informe_entregas` (numeración + snapshot histórico).
     - Pre-configuración de widgets `inventario_rosas`, `galeria_inmediata` y `confirmacion_entregas` en BDD y en las 10 superficies de UI.
  2. **Componentes Compartidos en `@eco/comercio`**:
     - `ConsolaInventarioRosas.tsx` (conteo multimodal por foto vía `@eco/agentes-ia` `imageUrls` + cabecera permanente `Lunes 16Nov 8:00AM`).
     - `ConsolaEntregaInmediata.tsx` + integración directa en `ConsolaVentasOmnicanal.tsx`, `ChatAriaFlotante.tsx` y `apps/tinkay-web/app/api/chat/route.ts`.
     - `ConsolaConfirmacionEntregas.tsx` + `pdf-informe-iess.ts` (`INFORME DE SERVICIO PROVEEDORES`) + cola offline `IndexedDB` + PWA `manifest.ts` y `sw-operaciones.js`.
