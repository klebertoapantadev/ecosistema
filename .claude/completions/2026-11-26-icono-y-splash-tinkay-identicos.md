# Cierre: Ícono de la app y Frame 0 del splash 100% unificados

- **Fecha:** 2026-11-26
- **Resumen:**
  1. **Íconos unificados con el splash sin bordes:**
     - `tinkay-icon-512.png` (`512x512`, `purpose: "any"`, fondo transparente) y `tinkay-icon-192.png` (`192x192`, fondo transparente) generados desde el SVG exacto de la caja abierta con bouquet de rosas, para que en el splash nativo de Android floten directo sobre `background_color: "#FAF7F2"` sin recuadro ni costura.
     - `tinkay-icon-maskable-512.png` (`512x512`, `purpose: "maskable"`) y `tinkay-apple-touch-icon.png` (`180x180`) sobre fondo sólido exacto `#FAF7F2` con margen seguro para íconos adaptativos Android/iOS.
     - Se sobrescribieron también `icon-512.png`, `icon-192.png` y `apple-touch-icon.png` para mantener consistencia con cualquier referencia previa (notificaciones push, marcadores).
  2. **Frame 0 del splash idéntico al ícono (`SplashAnimadoTinkay.tsx`):**
     - Fondo sólido `#FAF7F2` idéntico al `background_color` del manifest.
     - Arranca desde el Frame 0 en `opacity: 1` con la **misma caja abierta y rosas** (sin pantalla vacía ni retroceso a caja cerrada), animando un suave pulso floral, saludo de tapa, pétalos flotantes, destellos dorados y revelación del logotipo `Tinkay`.
  3. **Nuevas rutas de archivo en manifest/layout/SW:**
     - Actualizados `manifest.ts`, `layout.tsx` y `sw-operaciones.js` (`eco-portal-operaciones-v9`) con los nuevos nombres de archivo (`/icons/tinkay-icon-*.png`) para forzar actualización limpia del WebAPK.
