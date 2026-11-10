/* eslint-disable no-restricted-globals */
/**
 * Service Worker de tranqi PWA (PLT-013)
 * - Soporte de instalación (Web App Manifest + standalone)
 * - Caché híbrida para funcionamiento Offline (/panel, activos estáticos, API GET y /offline.html)
 * - Recepción de Notificaciones Web Push en segundo plano (incluso con el navegador cerrado)
 */

const SW_VERSION = "tranqi-pwa-v1.2";
const CACHE_STATIC = `${SW_VERSION}-static`;
const CACHE_PAGES = `${SW_VERSION}-pages`;
const CACHE_API = `${SW_VERSION}-api`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/assets/tranqi-white.svg",
  "/assets/tranqi-black.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES && k !== CACHE_API)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Ignorar endpoints de autenticación y mutaciones
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/pwa/")) {
    return;
  }

  // 1. Consultas API de lectura (notificaciones y planes): Network-First con respaldo en caché para modo Offline
  if (
    url.pathname.startsWith("/api/notificaciones/usuario") ||
    url.pathname.startsWith("/api/planes-publicos")
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ ok: true, offline: true, notificaciones: [] }), {
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // 2. Activos estáticos (_next/static, imágenes, íconos, fuentes): Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/imagenes/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_STATIC).then((c) => c.put(request, clone)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // 3. Navegación de documentos HTML (/panel, etc.): Network-First con respaldo en página cacheada o /offline.html
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_PAGES).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const cachedPanel = await caches.match("/panel");
          if (cachedPanel && url.pathname.startsWith("/panel")) return cachedPanel;
          const offlineFallback = await caches.match("/offline.html");
          return (
            offlineFallback ||
            new Response("Modo sin conexión — tranqi", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        })
    );
  }
});

// ── NOTIFICACIONES PUSH EN SEGUNDO PLANO (CON NAVEGADOR CERRADO) ──────────
self.addEventListener("push", (event) => {
  let payload = {
    title: "tranqi — Nueva notificación",
    body: "Tienes una actualización importante en tu portal jurídico.",
    url: "/panel",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "tranqi-notif-" + Date.now(),
    id: "",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        title: parsed.title || parsed.titulo || payload.title,
        body: parsed.body || parsed.mensaje || parsed.cuerpo || payload.body,
        url: parsed.url || parsed.url_accion || payload.url,
        icon: parsed.icon || payload.icon,
        badge: parsed.badge || payload.badge,
        tag: parsed.tag || parsed.id || payload.tag,
        id: parsed.id || "",
      };
    } catch {
      try {
        payload.body = event.data.text() || payload.body;
      } catch {}
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    vibrate: [180, 80, 180],
    data: {
      url: payload.url || "/panel",
      id: payload.id || "",
      RecibidoEn: new Date().toISOString(),
    },
    actions: [
      { action: "open", title: "Abrir en tranqi" },
      { action: "close", title: "Cerrar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "/panel";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl).catch(() => client);
            }
            return client;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
