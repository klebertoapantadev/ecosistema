# Cierre de Tarea — Tipos de Oferta Comercial Administrables & Renta de Mobiliario (`RENTA`)

**Fecha:** 2026-11-13  
**Requerimientos:** `PLT-009.29`, `TNK-002`, `TNK-004`

## Resumen de Cambios
1. **Base de Datos y RPCs (`supabase/migrations/20261113000002_comun_comercio_tipos_oferta_y_renta.sql`):**
   - Tabla `comun_comercio.com_tipo_oferta` (prefijo `tof_`) con RLS estricto y auditoría `aud_fn_auditar_tabla()`.
   - Semilla idempotente con `RENTA` (*Renta de Mobiliario / Alquiler para Eventos*) pre-configurada por defecto.
   - RPCs `com_fn_obtener_tipos_oferta_con_uso`, `com_fn_guardar_tipo_oferta` y `com_fn_eliminar_tipo_oferta` (con bloqueo anti-orfandad si tiene productos activos asignados).
2. **Motor Híbrido y Consola Administrativa (`@eco/comercio`):**
   - `tiposOferta.ts` + pruebas unitarias `tiposOferta.test.ts` + Server Actions `acciones-tipos-oferta.ts` con respaldo automático en PostgreSQL (`com_logistica_negocio` JSONB) + caché `localStorage`.
   - `ModalGestionTiposOferta.tsx` y botones `+ Nueva` / `⚙ Gestionar` junto a *Tipo de Oferta Comercial* en `ModalEditarProducto.tsx`, `ModalCrearProducto.tsx` y barra de `CatalogoProductosComercio.tsx`.
   - Sub-panel `PanelCondicionesRentaProducto` (`periodo`, `deposito_garantia_usd`, `incluye_retiro`, `nota_condiciones`) al elegir una oferta de renta.
3. **E-Commerce y Agente ARIA (`apps/tinkay-web`, `packages/agentes-ia`):**
   - Insignia `🪑 EN RENTA`, periodo de alquiler y aviso de condiciones en `TarjetaProductoConCarrusel.tsx`, `ModalDetalleProducto.tsx` y `DrawerCarritoFloristeria.tsx`.
   - Exposición de `tipo_oferta`, `es_renta` y `condiciones_renta` en MCP (`consultar_catalogo` y `detalle_producto`).

