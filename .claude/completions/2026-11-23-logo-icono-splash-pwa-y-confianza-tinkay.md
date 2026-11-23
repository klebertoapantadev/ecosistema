# Cierre de tarea — Barra superior móvil, Nuestros Clientes + `/Confianza`, nuevo logo/ícono Tinkay y Splash animado PWA

**Fecha:** 2026-11-23  
**Alcance:** `apps/tinkay-web`, `packages/comercio`, `gobernanza/productos/tinkay`

## Cambios realizados

1. **Ocultar barra superior en móvil (`estilos-ecommerce.css`)**
   - Se oculta `.barra-superior-anuncio { display: none !important; }` en pantallas móviles (`<= 768px` y `<= 640px`), despejando la cabecera tanto en la tienda pública como en el espacio del cliente registrado.

2. **Botón `Nuestros Clientes` en Hero + Respuesta rápida `/Confianza`**
   - `CarruselHeroDestacados.tsx`: En el slide *Visita Nuestro Taller Floral*, se reemplazó el botón externo `Abrir en Google Maps` por **`Nuestros Clientes`** con scroll suave hacia `#testimonios`.
   - `CarruselTestimoniosClientes.tsx`: Se añadió `id="testimonios"` con `scrollMarginTop: '96px'` y soporte automático al cargar la página con hash `#testimonios` o `#nuestros-clientes`.
   - `packages/comercio/src/configuracion-tienda-checkout.ts`: Se añadió `CONFIANZA` a `ComandoChatPagoDetectado`, detección de `/Confianza` en `parsearComandoChatPago()` y la función `construirMensajeConfianzaChat()` con el enlace directo a `/#testimonios` y al álbum oficial de entregas reales de Tinkay.
   - `packages/comercio/src/componentes/ConsolaVentasOmnicanal.tsx`: Se integró `/Confianza` en el autocompletado `/` (con aliases `/confianza`, `/testimonios`, `/clientes`, `/resenas`), en el envío directo por Enter y en el menú rápido `＋ Opciones`.
   - `packages/comercio/src/configuracion-tienda-checkout.test.ts`: Pruebas unitarias añadidas para `parsearComandoChatPago("/Confianza")` y `construirMensajeConfianzaChat()`.

3. **Nuevo logotipo, nuevo ícono de caja de regalo y Splash animado para la App instalada (PWA)**
   - Se procesaron y recortaron los nuevos artes oficiales:
     - Logotipo (`tinkay-logo.png`, `tinkay-logo.jpg`, `referencias-ia/logo-tinkay.jpg`) eliminando el duplicado fantasma inferior y preservando transparencia nítida.
     - Ícono de caja de regalo (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `tinkay-isotipo.png`, `tinkay-isotipo.jpg`) centrado sobre crema Tinkay `#FAF7F2` con margen seguro para íconos adaptativos (`maskable`).
   - Se actualizaron `EncabezadoEcommerce.tsx`, `LandingEcommerceTinkay.tsx`, `MarcoEcommerceClienteTinkay.tsx`, `app/panel/layout.tsx`, `app/manifest.ts`, `app/layout.tsx` y `public/sw-operaciones.js` (`eco-portal-operaciones-v7`) con cache-busting `?v=2`.
   - Se creó `apps/tinkay-web/componentes/SplashAnimadoTinkay.tsx` (montado en `app/layout.tsx`): animación vectorial SVG + CSS (cero Tailwind) que se reproduce al abrir la app instalada (`display-mode: standalone` / `navigator.standalone`, o previsualizable con `?splash=1`), mostrando la caja de regalo Tinkay abriéndose, un bouquet de rosas emergiendo con pétalos y destellos dorados, y el nuevo logotipo Tinkay.

## Verificación
- `pnpm typecheck`
- `pnpm --filter @eco/comercio test`
- `pnpm --filter tinkay-web build`
- Comprobación de cero clases Tailwind en el diff.
