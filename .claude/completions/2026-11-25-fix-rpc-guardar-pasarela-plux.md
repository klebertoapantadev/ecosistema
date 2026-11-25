# Cierre de Tarea — Corrección `permission denied` al Guardar Credenciales PLUX / Payphone

**Fecha:** 2026-11-25  
**Requerimientos:** `PLT-009`, `TNK-002`  
**Rama:** `master`

## Causa Raíz
- La migración de endurecimiento `20261105000001_comun_comercio_credenciales_y_visibilidad_todos.sql` revocó correctamente el `SELECT` a nivel de tabla en `comun_comercio.com_pasarela_configuracion` para proteger `psc_credenciales_privadas`.
- En Vercel (sin `service_role` en Next.js por Regla #3), `guardarConfiguracionPluxAction` y `guardarConfiguracionPasarelaAction` ejecutaban `.upsert(...)` directo como `authenticated`, lo cual requiere permiso `SELECT` en el conflicto/retorno en PostgreSQL y devolvía `permission denied for table com_pasarela_configuracion`.

## Solución Aplicada
- Creada y aplicada en Supabase (`oaybbpdxhlxjbpwnoymy`) la migración `supabase/migrations/20261125000005_rpc_guardar_configuracion_pasarela.sql` con la RPC transaccional `SECURITY DEFINER` `comun_comercio.com_fn_guardar_configuracion_pasarela(p_negocio, p_pasarela, p_payload)`:
  - Verifica sesión y rol operador/administrador/superadmin (`seg_fn_es_operador_o_admin_negocio`).
  - Hace upsert seguro preservando o fusionando `psc_credenciales_privadas` sin exponer jamás su lectura al cliente.
  - Desactiva la pasarela alterna si corresponde y sincroniza `cfg_negocio.cfg_detalle_configuracion.tienda_checkout.tarjetaCreditoHabilitada`.
- Actualizadas `guardarConfiguracionPluxAction` y `guardarConfiguracionPasarelaAction` en `packages/comercio/src/acciones.ts` para invocar esta RPC como vía principal.
