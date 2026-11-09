# Cierre de Tarea: Historial de Pagos para Cliente, Widget de Facturación Electrónica SRI, Emisión Automática con Tarjeta y Registro Manual de Pagos

**Fecha:** 2026-11-08
**Requerimiento:** `PLT-006` / `PLT-009` / `PLT-011`

## Resumen de Cambios Implementados

1. **Visibilidad del Historial de Pagos y Menú Herramientas para el Cliente**:
   - En [`PanelCuentaModular.tsx`](../../apps/tranqi-web/app/panel/cuenta/PanelCuentaModular.tsx): se incorporó y pre-configuró el widget `historial_pagos` (**"Historial de Pagos & Facturas Electrónicas"**) dentro de `Mi Cuenta` (`/panel/cuenta`) para `CLIENTE` y todos los perfiles.
   - En [`NavegacionSidebar.tsx`](../../apps/tranqi-web/app/panel/NavegacionSidebar.tsx): se habilitó la sección **Herramientas** (`/panel/herramientas`) en la barra lateral para el rol `CLIENTE` y `ABOGADO`.

2. **Nuevo Widget de Facturación Electrónica (`WidgetFacturacionElectronica.tsx`) en Herramientas, Mi Cuenta y Administrar**:
   - Creado [`WidgetFacturacionElectronica.tsx`](../../packages/comercio/src/componentes/WidgetFacturacionElectronica.tsx) y conectado a [`HistorialTransaccionesPago.tsx`](../../packages/comercio/src/componentes/HistorialTransaccionesPago.tsx).
   - Incluye tarjetas KPI de **Valores Generados (Facturado)** con desglose de Base Imponible + IVA 15%, **Valores Pagados (Recaudado)**, comparativa **Tarjeta vs. Transferencia/Efectivo** y **Comprobantes SRI Emitidos (`001-001-...`)**.
   - La tabla muestra el **N° de Factura Electrónica (`001-001-000000XXX`)**, **Clave de Acceso SRI de 49 dígitos**, **Detalle del Rubro Facturado**, **Cliente / Adquirente**, **Medio de Pago**, **Subtotal / IVA / Valor Pagado** y el visor/impresor **RIDE de Factura Electrónica SRI**.

3. **Emisión Automática de Factura Electrónica con Tarjeta de Crédito (`PLUX` / `Payphone`)**:
   - Migración [`20261108000004_facturacion_automatica_pagos_manuales_y_widget.sql`](../../supabase/migrations/20261108000004_facturacion_automatica_pagos_manuales_y_widget.sql): semilla de `fac_emisor` activa por negocio, mejora de `fac_fn_emitir_interno` y `fac_fn_facturar_pago` y retro-emisión de comprobantes para pagos aprobados previos.
   - Sincronización inmediata en [`acciones.ts`](../../packages/comercio/src/acciones.ts) (`asegurarFacturaElectronicaParaPago`) y [`acciones-plux.ts`](../../packages/comercio/src/acciones-plux.ts) (`confirmarPagoPluxAction`).

4. **Registro Manual de Pago por el Operador + Emisión Inmediata de Factura Electrónica**:
   - Modal **"Registrar Pago Manual y Emitir Factura Electrónica"** accesible desde el botón `Registrar Pago` y respaldado por `registrarPagoManualOperadorAction` y la RPC `comun_comercio.com_fn_registrar_pago_manual_y_facturar`.
   - Permite elegir un cliente registrado o ingresar sus datos fiscales (Cédula, RUC, Pasaporte, Consumidor Final), seleccionar un rubro del catálogo o rubro libre, indicar el medio de pago (`TRANSFERENCIA`, `EFECTIVO`, `DEUNA`, `DEPOSITO`, `TARJETA_POS`, `CHEQUE`) y referencia, y emite automáticamente la Factura Electrónica (`001-001-...`) tras registrar el pago.

5. **Corrección del Titular/Adquirente real para el Operador y Análisis 360° del Cliente (`Cliente 360°`)**:
   - En [`acciones.ts`](../../packages/comercio/src/acciones.ts) (`obtenerHistorialTransaccionesAction`): al sintetizar pagos desde `tranqui_legal.trq_cita` o enriquecer `com_transaccion_pago`, ahora se resuelve siempre el **cliente propietario real** (`cit_cliente_id` / `pag_cliente_id`) en `comun_seguridad.seg_usuario` (`usu_nombres`, `usu_apellidos`, `usu_correo`, `usu_whatsapp`, `usu_detalle_usuario`), evitando que la vista del Operador muestre erróneamente los datos del usuario operador en sesión (`satcom latinoamerica`).
   - En [`WidgetFacturacionElectronica.tsx`](../../packages/comercio/src/componentes/WidgetFacturacionElectronica.tsx) y `obtenerExpedienteCliente360Action`: se incluyeron enlaces interactivos sobre el nombre del cliente, su correo electrónico (`tinkay.uio@gmail.com`) y el botón **`Cliente 360°`**, que abren el **Modal de Expediente Cliente 360°** con sus datos personales y fiscales, plan activo, casos judiciales (`trq_caso_judicial`), reuniones/citas (`trq_cita`), historial de pagos/facturas electrónicas y documentos en billetera (`trq_billetera_documento`), además de accesos directos para **Registrar Pago** a ese cliente o **Ir al CRM** (`/panel/clientes`).

6. **Registro y Trazabilidad Exacta del Mecanismo de Pago (`PagoPlux / PLUX`)**:
   - En [`acciones-plux.ts`](../../packages/comercio/src/acciones-plux.ts) y [`ModalCheckoutPayphone.tsx`](../../packages/comercio/src/componentes/ModalCheckoutPayphone.tsx): `confirmarPagoPluxAction` y `consultarPagoPluxAction` ahora devuelven `pagoId` (`pag_id`) y `pasarela: "PLUX"` para que `FormularioAgendar.tsx` enlace `cit_pago_id` en `trq_cita` directamente con la transacción `PLUX`, además de respaldar los datos de autorización en `seg_usuario.usu_detalle_usuario.pagos_plux_confirmados`.
   - En [`acciones.ts`](../../packages/comercio/src/acciones.ts) y [`WidgetFacturacionElectronica.tsx`](../../packages/comercio/src/componentes/WidgetFacturacionElectronica.tsx): se eliminó el valor fijo `PAYPHONE` al reconstruir pagos de citas agendadas, vinculándolos con la transacción `PLUX` (`TRQ-PLX-...`) del cliente y mostrando claramente **`PagoPlux (PLUX)`** con tipo de tarjeta, marca, últimos 4 dígitos y código de autorización.



