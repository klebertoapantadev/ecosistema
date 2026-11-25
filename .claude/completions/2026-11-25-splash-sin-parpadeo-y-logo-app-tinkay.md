# Cierre: Splash PWA sin parpadeo y nuevo ícono de la app con gráfico de la animación

- **Fecha:** 2026-11-25
- **Resumen:**
  1. **Eliminado el parpadeo del portal antes de la animación:**
     - Se agregó un script síncrono pre-pintado en `<head>` de `apps/tinkay-web/app/layout.tsx` que detecta `display-mode: standalone` / `fullscreen` / `navigator.standalone` (o `?splash=1`) **antes del primer paint**, añade `html.tinkay-splash-activo` y registra `window.__tinkaySplashInicioMs` (con fail-safe de 4.5 s).
     - En `apps/tinkay-web/app/globals.css`, `#tinkay-splash-root` arranca oculto (`display: none`) en navegadores web normales y `display: flex` desde el Frame 0 cuando `html.tinkay-splash-activo` está presente.
     - `SplashAnimadoTinkay.tsx` ahora renderiza el overlay desde SSR (sin hydration mismatch) y descuenta el tiempo ya transcurrido desde el primer paint para fundirse directamente en el portal hidratado sin flash intermedio ni doble espera.
  2. **Logo de la app igual al gráfico de la animación:**
     - Se regeneraron `apps/tinkay-web/public/icons/icon-512.png` (512×512), `icon-192.png` (192×192) y `apple-touch-icon.png` (180×180) directamente desde el SVG oficial de la caja abierta con bouquet de rosas y fondo crema `#FAF7F2` (sin recuadro blanco).
     - Se actualizó el versionado a `?v=3` en `manifest.ts`, `layout.tsx` y `sw-operaciones.js` (`CACHE_NAME = "eco-portal-operaciones-v8"`).
