# Cierre de Tarea — Ficha Unificada del Cliente (Estrellas, Notas, Nombre Editable) y Puente Bidireccional Web ↔ WhatsApp

**Fecha:** 2026-11-22  
**Requerimientos:** `TNK-002`, `TNK-004` (`PLT-010`)  
**Rama:** `master`

## Entregables Implementados

1. **Ficha Unificada del Cliente en Todos los Canales (`ModalFichaClienteOmnicanal.tsx` + `ConsolaVentasOmnicanal.tsx`):**
   - Clic directo sobre el avatar/nombre del cliente en la cabecera del chat, en la tarjeta lateral `Contacto directo` o en el directorio `Usuarios y Clientes` abre la ficha integral del cliente (modal centrado en escritorio, Bottom Sheet táctil en móvil).
   - **Nombre editable para registro interno** (`nombrePersonalizado` + `cnv_remitente_nombre`, protegido frente a sobrescritura de webhooks posteriores), **WhatsApp / Teléfono** (con copiado en 1 clic y apertura directa `wa.me`), **Correo electrónico** (con copiado).
   - **Calificación interactiva de 1 a 5 estrellas (`★`)** visible también en la cabecera del chat y lista lateral.
   - **Notas permanentes del cliente** con chips rápidos (`Cliente de eventos`, `Cliente frecuente`, `Recomendado Nancy`, `Cliente problemático`, `Corporativo / Factura SRI`), sincronizadas automáticamente entre todos los canales asociados al mismo cliente (teléfono normalizado, correo, `usuarioId`, `clienteId` o `refWeb`).
   - Persistencia transaccional híbrida vía RPC `comun_comercio.com_fn_omnicanal_guardar_ficha_cliente` (`20261122000003_ficha_cliente_omnicanal_y_puente_web_whatsapp.sql`) + respaldo resiliente inmediato.

2. **Accesos Directos Web → WhatsApp (Cabecera + Chat Mía reemplazando Pin de Ubicación):**
   - En `ChatAriaFlotante.tsx`: reemplazado el pin inferior izquierdo `<MapPin />` y el chip de cotización por el ícono vectorial oficial de WhatsApp + botón `WhatsApp` en cabecera y chip `WhatsApp directo`.
   - En `EncabezadoEcommerce.tsx`: botón `WhatsApp` con ícono vectorial oficial (`btn-responsive-accion` modo solo ícono en móvil `<640px`).

3. **Correlación Bidireccional Web ↔ WhatsApp (`puente-omnicanal-cliente.tsx` + `/api/omnicanal/puente-web`):**
   - **Web → WhatsApp (`TNK-XXXXXX`):** registra la sesión web y el arreglo consultado antes de abrir `wa.me`; cuando el mensaje ingresa por el webhook YCloud, vincula ambos hilos, copia la ficha del cliente, prellena `datos_venta` (`producto`, `precioProducto`) e informa a Mía (ARIA) y al equipo mediante nota interna.
   - **WhatsApp → Web (`?wref=WA-XXXXXX`):** los enlaces de productos enviados desde el selector de catálogo o por Mía incluyen `wref=WA-XXXXXX`; cuando el cliente abre la tienda o inspecciona un producto en `ModalDetalleProducto.tsx`, se registra en vivo en su hilo de WhatsApp qué arreglo está viendo.

4. **Rediseño de Acciones en Detalle de Producto (`ModalDetalleProducto.tsx`):**
   - **Fila 1 (Botón grande principal):** `Comprar ahora · $XX.XX` (compra directa al checkout).
   - **Fila 2 (2 botones simétricos):** `Agregar al carrito` y `Más info WhatsApp` (con ícono oficial de WhatsApp y enlace del producto con `ref=TNK-XXXXXX`).
