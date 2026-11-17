# Cierre de Tarea — Menú y Espacio E-Commerce de Cliente + Cobertura Gratuita Exclusiva para Registrados

**Fecha:** 2026-11-17  
**Requerimientos:** `TNK-002`, `PLT-008`, `PLT-009`, `PLT-011`, `PLT-014`

## Resumen de Cambios

1. **Eliminación del Menú de Gestión Oscuro para el Rol `CLIENTE` y Homologación E-Commerce (`MarcoEcommerceClienteTinkay.tsx`, `app/panel/layout.tsx`, `EncabezadoEcommerce.tsx`):**
   - Los usuarios con rol `CLIENTE` ya no ven la barra lateral negra de administración (`MarcoPanelLateral`), sino la cabecera botánica editorial de la tienda e-commerce (`--crema`, `--verde`, `--rosa`, `--dorado`), con menú integrado horizontal y móvil para:
     - **Catálogo** (`/#catalogo`)
     - **Mis Pedidos** (`/panel?vista=pedidos`)
     - **Mi Carrito** (`/panel?vista=carrito` + drawer rápido)
     - **Mis Proformas** (`/panel?vista=proformas`)
     - **Promociones** (`/panel?vista=promociones`)
     - **Mi Cuenta** (`/panel/cuenta`)
   - El personal operativo (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `VENTAS`, `TALLER`, `DELIVERY`, `DELIVERY_EXTERNO`) conserva su consola administrativa intacta.

2. **Expediente Completo de Pedidos, Edición de Carrito, Edición de Proformas y Promociones (`EspacioClienteEcommerceTinkay.tsx`, `ModalEditarProformaCliente.tsx`, `acciones-logistica.ts`):**
   - **Mis Pedidos:** Ficha completa por orden (`obtenerExpedientePedidosClienteAction`) con progreso en 4 etapas, ítems, tarjetas de dedicatoria, obsequio de bienvenida, datos de entrega/pago, **Confirmación de Entrega con Fotografía GPS** (`com_entrega_evidencia`) ampliable y descargable, y **Factura Electrónica SRI** (`fac_comprobante`) con visualización y descarga de RIDE PDF en 1 clic.
   - **Mi Carrito:** Edición en línea de cantidades, tarjetas de dedicatoria, complementos sugeridos, modalidad de envío/retiro y paso directo a checkout PLUX/Transferencia.
   - **Mis Proformas:** Edición tanto del borrador activo como de proformas guardadas antes del pago (`actualizarProformaEventoClienteAction` + RPC `com_fn_actualizar_proforma_cliente`).
   - **Promociones:** Separación clara entre **Promociones y Beneficios para Clientes Registrados** (Zona de Cobertura Gratuita `$0.00`, Obsequio 1ra Compra `$0.00`, campañas `CLIENTES`) y **Promociones Generales** (Entrega Inmediata 1–2h con descuento, Sets `-X% OFF`, precios por volumen y Retiro Gratis en Tienda).

3. **Zona de Cobertura Gratuita Exclusiva para Clientes Registrados (`logistica.ts`, `SelectorUbicacionEntrega.tsx`, `FormularioLogisticaCobertura.tsx`, `contexto-carrito.tsx`, `ModalCheckoutTinkay.tsx`):**
   - Para **clientes no registrados** (`clienteRegistrado === false`), no aplica zona de cobertura gratuita: todo envío a domicilio cobra **tarifa mínima de `$1.00` + `$0.50` por kilómetro** (`tarifaBaseNoRegistradoUsd` + `tarifaPorKmNoRegistradoUsd × km`).
   - Se muestra al visitante el ahorro exacto que obtendría al registrarse y se recalcula automáticamente a `$0.00` (en `Centro-Norte de Quito`) en cuanto inicia sesión o completa su registro.

4. **Migración SQL Idempotente y Gobernanza:**
   - `supabase/migrations/20261117000005_portal_cliente_ecommerce_proformas_y_cobertura_registrados.sql`
   - Gobernanza actualizada en `gobernanza/productos/tinkay/especificacion-funcional.md` y `gobernanza/productos/plataforma/especificacion-funcional.md`.
