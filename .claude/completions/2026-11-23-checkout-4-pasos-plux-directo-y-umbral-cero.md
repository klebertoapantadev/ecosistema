# Cierre de tarea — Checkout en 4 Pasos, Umbral Configurable en $0 y Botón Oficial PLUX Directo

- **Fecha:** 2026-11-23
- **Rama:** `master`
- **Requerimiento:** `TNK-002` ([especificacion-funcional.md](../../gobernanza/productos/tinkay/especificacion-funcional.md))

## Cambios implementados

1. **Checkout guiado en 4 pasos (`ModalCheckoutTinkay.tsx`, `estilos-ecommerce.css`):**
   - **Paso 1 — Pedido:** Visualiza los productos del carrito, permite cambiar cantidades (`-`/`+`), eliminar productos (`Eliminar`), gestionar el obsequio de bienvenida y revisar totales antes de continuar.
   - **Paso 2 — Entrega:** Envío a Domicilio (mapa/GPS opcional) o Retiro en Tienda (`$0.00`), con fecha y rango horario.
   - **Paso 3 — Contacto:** Solicita únicamente el **número de WhatsApp** como dato personal obligatorio para coordinar la entrega.
   - **Paso 4 — Pago:** Resumen compacto con acceso rápido `Editar pedido`, selector con `Transferencia / DeUna` por defecto y `Tarjeta (PLUX)`.
2. **Restricción por monto configurable con `0 = sin control` (`configuracion-tienda-checkout.ts`, `ConfiguracionPasarelaPayphone.tsx`, `ModalCheckoutTinkay.tsx`):**
   - Cuando `montoMaximoPagoSinDatosUsd` es `0` (valor por defecto, configurable en `/panel/pasarelas`), no se aplica ningún control por monto y los datos de factura quedan 100% opcionales.
   - Solo si el administrador configura un valor mayor a `0`, se exige Nombre y Cédula/RUC en compras desde ese monto.
3. **Visualización directa del botón oficial `"Pagar ahora"` de PLUX al seleccionar Tarjeta (`ModalCheckoutTinkay.tsx`):**
   - Al elegir `Tarjeta (PLUX)` en el Paso 4, se prepara automáticamente la orden mostrando un spinner (`Preparando botón seguro de PLUX…`) y se monta `<BotonPagoPlux autoIniciar autoAbrirModal={false} />`, mostrando directamente el botón oficial azul **`Pagar ahora`** de PLUX con logos de tarjetas. Al pulsarlo, se muestra el spinner hasta que abre el modal cifrado de PLUX.

## Verificación

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter tinkay-web build`
- Sin clases utilitarias de Tailwind CSS en el diff.
