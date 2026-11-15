# Cierre de Tarea — Proformas de Eventos en Autoservicio + Variaciones Asesor + PDF Correo + PLUX Multiempresa

- **Fecha:** 2026-11-15
- **Requerimientos cubiertos:** `PLT-001`, `PLT-009` (§30), `TNK-002`

## Resumen Técnico

1. **Separación Estricta de Verticales en Tinkay (`apps/tinkay-web`):**
   - **Eventos (`esEvento && !esRenta && !esExtra`):** Oculta tarjeta de dedicatoria y cero extras florales/condolencias; sugiere únicamente otros productos de eventos; reemplaza compra directa por `Agregar a Proforma` / `Proforma`.
   - **Renta (`esRenta`):** Permanece en el Carrito de compra directa, sin tarjeta de dedicatoria ni extras florales, sugiriendo únicamente artículos de renta.
   - **Flores Retail:** Mantiene dedicatoria gratuita y extras florales/gourmet.

2. **Proformas en Autoservicio + Multi-Variación por Asesor de Ventas + Doble PDF por Correo:**
   - Emisión en autoservicio (`V1 · Original`) desde `DrawerProformaEvento.tsx` con sugerencia no bloqueante de registro (`/registro?destino=/?proforma=abierta`), WhatsApp obligatorio y consentimiento LOPDP.
   - Edición asistida por asesor en `BandejaPedidosTienda.tsx` (`ModalEditarVariacionProforma.tsx`), almacenando cada actualización como nueva variación (`TNK-PRF-xxxx-V2`, `V3`, ...) agrupada por `grupo_proforma_id` sin sobrescribir la `V1`.
   - Generación A4 con `pdf-lib@1.17.1` (`packages/comercio/src/pdf-proforma.ts`) y envío por correo con adjuntos base64 (`Proforma_Original` + `Proforma_Actualizada`) vía `@eco/notificaciones/enviar-correo` y Edge Function `supabase/functions/enviar-correo/index.ts`.
   - Vista del cliente `/proforma/[token]` (`VistaProformaEventoCliente.tsx`) y `/panel` (`AccionesProformaPanelCliente.tsx`) con selector de variaciones, descarga de PDF (`/api/proforma/[token]/pdf`), pago 70% / 100% / 30% y eliminación de variaciones no aceptadas o todas (`UNA` / `OTRAS` / `TODAS`) antes de confirmar pedido o pago.

3. **Registro con WhatsApp y Consentimiento LOPDP (`@eco/identidad`):**
   - WhatsApp obligatorio + checkbox de consentimiento LOPDP (`ModalTerminosWhatsapp.tsx`) en `/registro` y `/bienvenida`, preservando `destino` de extremo a extremo y respetando `GRANT UPDATE` por columna en `seg_usuario`.

4. **Pasarela Multiempresa PagoPlux (`tinkay` independiente de `tranqi`):**
   - Fila independiente `PLUX` para `tinkay` en `comun_comercio.com_pasarela_configuracion` (inicializada desde las variables sandbox de `tranqi` con `nombre_comercio = 'Tinkay Floristería'` y prefijo `TNK-PLX-`), consola `/panel/pasarelas`, y cobro real con `BotonPagoPlux` tanto en proformas como en `ModalCheckoutTinkay.tsx`.

