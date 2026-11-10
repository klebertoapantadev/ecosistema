# Cierre de Tarea — PWA Instalable, Modo Offline y Notificaciones Web Push con Navegador Cerrado (`PLT-013`)

**Fecha:** 2026-11-10

## Cambios Realizados

1. **Web App Manifest e Íconos (`apps/tranqi-web/app/manifest.ts`, `public/icons/*`, `app/layout.tsx`)**:
   - Se implementó el manifiesto PWA en `/manifest.webmanifest` con `display: "standalone"`, `start_url: "/panel"`, `theme_color: "#5000BA"`, atajos directos (`Panel de Inicio`, `Agendar Cita`, `Mi Cuenta`) e íconos `192x192`, `512x512` (`any` y `maskable`) y `apple-touch-icon.png` (`180x180`).
   - Se actualizó [`layout.tsx`](../../apps/tranqi-web/app/layout.tsx) con metadatos `appleWebApp`, `viewport` e integración de [`GestorPwaCliente.tsx`](../../apps/tranqi-web/app/componentes/GestorPwaCliente.tsx).

2. **Service Worker Offline y Recepción Push en Segundo Plano (`public/sw.js` y `public/offline.html`)**:
   - Se implementó [`sw.js`](../../apps/tranqi-web/public/sw.js) con caché híbrida (*Stale-While-Revalidate* para activos estáticos y *Network-First* con respaldo en caché local para navegación de `/panel` y endpoints de lectura) y pantalla de respaldo [`offline.html`](../../apps/tranqi-web/public/offline.html).
   - Se incorporaron los listeners `push` y `notificationclick` para despertar al Service Worker cuando llega una alerta push aunque el navegador esté cerrado y abrir directamente la ruta del panel al tocar la notificación.

3. **Motor Criptográfico Web Push VAPID + RFC 8291 (`aes128gcm`) sin Dependencias Externas (`lib/web-push-vapid.ts`, `/api/pwa/suscripcion`)**:
   - Se construyó [`web-push-vapid.ts`](../../apps/tranqi-web/lib/web-push-vapid.ts) con `node:crypto` nativo (firma JWT `ES256` VAPID y cifrado ECDH P-256 `aes-128-gcm`), persistiendo las suscripciones por dispositivo en `comun_seguridad.seg_usuario.usu_detalle_usuario.push_subscriptions`.
   - Se conectó el despacho Web Push automático en [`app/api/notificaciones/route.ts`](../../apps/tranqi-web/app/api/notificaciones/route.ts) y los controles `📲 Instalar App`, `🔔 Activar Push` y `⚡ Probar Push` en [`CampanaNotificaciones.tsx`](../../packages/notificaciones/src/CampanaNotificaciones.tsx).
