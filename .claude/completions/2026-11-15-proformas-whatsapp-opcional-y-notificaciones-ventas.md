# Cierre de Tarea — WhatsApp Opcional en Proforma, Flujo No Registrados y Alertas de Proformas/Ventas

- **Fecha:** 2026-11-15
- **Requerimientos actualizados:** `PLT-001` (Regla 3), `PLT-009` (Regla 30), `PLT-013` (Regla 4)

## Cambios realizados

1. **WhatsApp opcional y auto-aceptación LOPDP en generación de proformas (`DrawerProformaEvento.tsx`, `acciones-logistica.ts`, `pdf-proforma.ts`):**
   - Campo `Número de WhatsApp (opcional)` sin atributo HTML5 `required`.
   - Al escribir dígitos en WhatsApp, se marca automáticamente `autorizaWhatsapp = true`; si se limpia, queda en `false` y la proforma PDF se despacha directamente al correo electrónico del solicitante sin sobrescribir teléfonos previos en `seg_usuario`.
2. **Experiencia para visitantes no registrados (`VistaProformaEventoCliente.tsx`, `app/proforma/[token]/page.tsx`):**
   - Cuando el visitante no posee membresía activa en Tinkay (`!usuarioRegistrado`), se despliega un bloque destacado con descarga directa del archivo PDF (`Descargar Proforma`) y botón de contacto directo vía WhatsApp al número oficial de la tienda **`+593 99 292 2343`** (`https://wa.me/593992922343`), corrigiendo además el teléfono placeholder anterior.
3. **Notificaciones de proforma a Vendedores, Operadores y Administradores (`notificar-usuario.ts`, `acciones-logistica.ts`):**
   - Si el cliente está registrado en el negocio **y/o** entrega su número de WhatsApp, `generarProformaEventoAction` notifica (`IN_APP`, `PUSH`, `EMAIL`) a todos los perfiles `VENDEDOR`, `VENTAS`, `ASESOR`, `OPERADOR`, `ADMINISTRADOR`, `ADMIN` y `SUPERADMIN` del negocio indicando qué usuario generó la proforma de evento.
4. **Notificaciones de compra / venta a Operadores y Administradores (`notificar-usuario.ts`, `acciones-logistica.ts`, `acciones-plux.ts`, `acciones.ts`):**
   - Al concretarse una venta o confirmación de compra (checkout de tienda por transferencia, confirmación de orden de proforma, pago PLUX o pago Payphone), `notificarStaffNuevoPedido` alerta (`IN_APP`, `PUSH`, `EMAIL`) a los `OPERADOR`, `ADMINISTRADOR` y `SUPERADMIN` del negocio activo.
