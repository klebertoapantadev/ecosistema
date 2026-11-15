# Cierre de Tarea — Pago Directo en Floristería, Umbral Configurable (< $50), Retiro sin Datos y Transferencia + QR DeUna

**Fecha:** 2026-11-15  
**Requerimientos:** `PLT-008`, `PLT-009`  
**Aplicación foco:** `tinkay-web` + paquetes transversales `@eco/comercio` y `@eco/configuracion-negocio`

## Resumen de Cambios

1. **Doble Acción en Productos de Floristería (No Eventos):**
   - En `TarjetaProductoConCarrusel.tsx` y `ModalDetalleProducto.tsx`, todos los productos florales (`!esProductoEvento`) ahora permiten tanto **agregar al carrito** como **pagar directamente** (`Pagar` / `Pagar Directo`), abriendo `ModalCheckoutTinkay` sin pasar por el drawer intermedio.
   - Los productos de eventos (`esProductoEvento`) conservan exclusivamente su flujo de **Proforma**.

2. **Parámetros Configurables de Tienda (`whatsappTienda` y `montoMaximoPagoSinDatosUsd`):**
   - Creados `packages/comercio/src/configuracion-tienda-checkout.ts` y `packages/comercio/src/acciones-tienda-checkout.ts`, persistidos en `comun_configuracion.cfg_negocio.cfg_detalle_configuracion` y pre-sembrados mediante la migración idempotente `20261115000008_tinkay_checkout_parametros_transferencia_y_comprobantes.sql`.
   - Editables desde `/panel/pasarelas` (`ConfiguracionPasarelaPayphone.tsx`) y `/panel/configuracion` (`FormularioConfiguracionNegocio.tsx`).
   - Valores por defecto en Tinkay: `whatsappTienda = "+593 99 292 2343"`, `montoMaximoPagoSinDatosUsd = 50`.

3. **Reglas de Checkout según Monto (`< $50`), Registro y Retiro en Tienda:**
   - Selector integrado de **Envío a Domicilio** vs. **Retiro en Tienda ($0.00)** dentro de `ModalCheckoutTinkay.tsx`.
   - **Pagos menores a `$50` (parámetro):** No se exige nombre, identificación ni correo (opera como SRI Consumidor Final `9999999999999`, con opción voluntaria de factura con datos).
   - **Usuario no registrado con envío a domicilio:** Se exige obligatoriamente el número de WhatsApp informando que es requerido para contactar y coordinar la entrega del pedido.
   - **Retiro en tienda:** No se solicita información de entrega ni WhatsApp (y para `< $50` ninguna información personal es requerida).

4. **Pago vía Transferencia Bancaria + Código QR DeUna + Subida de Comprobante (Imagen o PDF) + WhatsApp:**
   - Incluidos los datos oficiales de Tinkay (*Kleber Toapanta*, Cédula `1714898226`, `tinkay.uio@gmail.com`, *Banco Pichincha* Ahorros `2211739080`, *Produbanco* Ahorros `12054049119`) y el activo visual `/img/qr-deuna-tinkay.png`.
   - Advertencia visible de acreditación previa al envío, subida obligatoria del comprobante (`image/*` con optimización en cliente o `application/pdf`), visualización del comprobante en `BandejaPedidosTienda.tsx` y botón directo para escribir/adjuntar por WhatsApp al `+593 99 292 2343`.
