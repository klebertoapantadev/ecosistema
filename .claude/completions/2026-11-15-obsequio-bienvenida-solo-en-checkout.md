# Cierre de Tarea — Obsequio de Bienvenida Exclusivo en Checkout con Imagen Real e Ítem Extra $0.00

**Fecha:** 2026-11-15  
**Rama:** `master`

## Cambios Implementados
1. **Eliminación del anuncio en cabecera y drawer del carrito (`EncabezadoEcommerce.tsx`, `DrawerCarritoFloristeria.tsx`):**
   - Retirada la franja promocional superior de la vitrina y el aviso previo en el drawer del carrito para presentar la promoción únicamente cuando el cliente procede al pago.
2. **Invitación de Obsequio de Bienvenida al ir a pagar (`ModalCheckoutTinkay.tsx`):**
   - Si el cliente no está registrado en Tinkay, al abrir el checkout se le indica que aún no está registrado y se le presenta la tarjeta promocional con la fotografía real del producto del catálogo (`Ferrero x1 en Esfera acrílica`, SKU `TIN-VAR-4`), precio referencial tachado (`$1.50`) y valor `$0.00 GRATIS`.
   - Botón `Aceptar Obsequio` redirige a `/registro?destino=%2F%3Fcheckout%3D1%26obsequio%3D1&obsequio=1` y al completar el registro reabre automáticamente el checkout (`contexto-carrito.tsx`) conservando intacto el carrito. Botón `Pagar sin Registro` permite continuar de inmediato como invitado.
3. **Inclusión del extra con valor `$0.00` en el pedido (`acciones-logistica.ts`, `ModalCheckoutTinkay.tsx`, `20261115000010`):**
   - En el resumen del checkout y en `registrarPedidoTiendaAction` se agrega una línea real al pedido (`precio_unitario: 0`, `total_linea: 0`, `variante_nombre: "Extra por registro y primera compra"`) persistida en `com_proforma_item`, `prf_detalle_proforma.items`, bandeja de pedidos del taller (`/panel/pedidos`) y correos de confirmación.
