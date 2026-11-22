# Cierre: Interruptor maestro para habilitar/deshabilitar procesamiento con tarjeta de crédito/débito

- **Fecha:** 2026-11-22
- **Requerimientos:** `PLT-006`, `PLT-009`, `TRQ-ADM-004`, `TNK-002`
- **Rama:** `master`

## Qué se resolvió
Antes, incluso si un administrador desmarcaba `activo` en `/panel/pasarelas`, el sistema seguía mostrando y permitiendo cobros con tarjeta (PLUX) porque:
1. `obtenerPasarelasCheckoutAction` forzaba un fallback hardcodeado inyectando `PLUX` cuando no encontraba pasarelas activas.
2. `com_fn_preparar_pago_plux_proforma` y `prepararPagoPluxProformaAction` heredaban las credenciales de `tranqi` cuando `tinkay` tenía PLUX inactivo.
3. `ModalCheckoutTinkay` y `VistaProformaEventoCliente` renderizaban el botón `Tarjeta (PLUX)` de manera incondicional.
4. `guardarConfiguracionPasarelaAction` silenciaba errores de persistencia y no había un interruptor maestro de 1 clic para deshabilitar/habilitar tarjetas en el negocio.

## Cambios realizados
- `packages/comercio/src/configuracion-tienda-checkout.ts`: nuevo campo `tarjetaCreditoHabilitada` (normalizado, default `true`).
- `packages/comercio/src/acciones.ts`: nueva acción `cambiarEstadoTarjetaNegocioAction` (con RPC `com_fn_establecer_estado_tarjeta_negocio` + respaldo RLS y sincronización con `cfg_negocio`), propagación estricta de errores en `guardarConfiguracionPasarelaAction` y `guardarConfiguracionPluxAction`.
- `packages/comercio/src/acciones-plux.ts`: `obtenerPasarelasCheckoutAction`, `prepararPagoPluxAction` y `prepararPagoPluxProformaAction` respetan estrictamente `tarjetaCreditoHabilitada` y `psc_activo = false` (cero fallback hacia `tranqi` ni inyección forzada de `PLUX`).
- `packages/comercio/src/componentes/ConfiguracionPasarelaPayphone.tsx`: interruptor maestro de 1 clic (`Habilitar Tarjeta` / `Deshabilitar Tarjeta`) en `/panel/pasarelas` y mensajes de confirmación precisos.
- `packages/comercio/src/componentes/ModalCheckoutPayphone.tsx`: aviso claro y bloqueo de envío cuando el pago con tarjeta está deshabilitado.
- `apps/tinkay-web/modulos/ecommerce/componentes/ModalCheckoutTinkay.tsx`, `apps/tinkay-web/app/proforma/[token]/page.tsx`, `apps/tinkay-web/modulos/ecommerce/componentes/VistaProformaEventoCliente.tsx`, `LandingEcommerceTinkay.tsx` y `EspacioClienteEcommerceTinkay.tsx`: ocultan la opción de tarjeta y conmutan automáticamente a Transferencia / QR DeUna (o WhatsApp si ambos están deshabilitados) cuando el procesamiento con tarjeta está desactivado.
- `supabase/migrations/20261122000001_rpc_estado_tarjeta_y_respeto_plux_inactivo.sql`: RPC transaccional `com_fn_establecer_estado_tarjeta_negocio`, actualización de `com_fn_obtener_pasarelas_activas` y corrección de `com_fn_preparar_pago_plux_proforma`.
- `gobernanza/productos/plataforma/especificacion-funcional.md`: actualización de estado `PLT-006`.
