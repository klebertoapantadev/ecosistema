# Cierre: Checkout PLUX resiliente, captura de clientes no autorizados y regalo de primera compra

- **Fecha**: 2026-11-15
- **Alcance**:
  1. **Corrección error `com_fn_preparar_pago_plux_proforma` en caché de esquema PostgREST**:
     - `packages/comercio/src/acciones-logistica.ts`: `registrarPedidoTiendaAction` genera y retorna `respaldoFirmado` (HMAC-SHA256) incluso cuando `com_fn_registrar_pedido_tienda` tiene éxito.
     - `packages/comercio/src/acciones-plux.ts`: `prepararPagoPluxProformaAction` acepta `respaldoFirmado` y lo utiliza en el respaldo HMAC si la RPC no está en la caché de esquema y `crearClienteAdmin()` es nulo.
     - `packages/comercio/src/componentes/BotonPagoPlux.tsx` y `apps/tinkay-web/modulos/ecommerce/componentes/ModalCheckoutTinkay.tsx`: propagan `respaldoFirmado`.
  2. **Captura de cliente sin registro (`USUARIO_NO_AUTORIZADO`)**:
     - `supabase/migrations/20261115000006_clientes_invitados_y_regalo_primera_compra.sql`: tabla `comun_comercio.com_cliente` con RLS, trigger de auditoría `aud_fn_auditar_tabla()`, función `com_fn_capturar_cliente_compra` y actualización de `com_fn_registrar_pedido_tienda` para guardar los datos del comprador etiquetado como `USUARIO_NO_AUTORIZADO` o `USUARIO_REGISTRADO`.
     - `packages/comercio/src/acciones-plux.ts`: `confirmarPagoPluxAction` invoca `com_fn_capturar_cliente_compra` al confirmar el pago.
  3. **Anuncio y beneficio de regalo en primera compra (Bombón Ferrero en Esfera)**:
     - `supabase/migrations/20261115000006_clientes_invitados_y_regalo_primera_compra.sql`: RPC `com_fn_verificar_primera_compra_usuario`.
     - `packages/comercio/src/acciones-logistica.ts`: `obtenerEstadoRegaloPrimeraCompraAction`.
     - `apps/tinkay-web/modulos/ecommerce/componentes/EncabezadoEcommerce.tsx`, `DrawerCarritoFloristeria.tsx` y `ModalCheckoutTinkay.tsx`: anuncio superior, incentivo en carrito y checkout, e inclusión automática del regalo (`TIN-VAR-6`, `$0.00`) para usuarios registrados en su primera compra.
