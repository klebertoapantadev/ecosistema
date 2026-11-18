// Service Worker PWA + Web Push Estilo WhatsApp para Tinkay (/panel, /panel/conversaciones, /panel/chat-equipo, /panel/entregas, /panel/taller)
const CACHE_NAME = "eco-portal-operaciones-v4";
const RUTAS_PRECACHE = [
  "/panel",
  "/panel/entregas",
  "/panel/taller",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RUTAS_PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Recepción de Notificación Web Push en segundo plano (estilo WhatsApp)
self.addEventListener("push", (event) => {
  let datos = {
    title: "Tinkay · Nuevo mensaje",
    body: "Tienes un mensaje pendiente en Tinkay.",
    url: "/panel/conversaciones",
    tag: "tinkay-chat",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        datos = {
          title: parsed.title || datos.title,
          body: parsed.body || datos.body,
          url: parsed.url || datos.url,
          tag: parsed.tag || datos.tag,
          icon: parsed.icon || datos.icon,
          badge: parsed.badge || datos.badge,
        };
      }
    } catch {
      try {
        datos.body = event.data.text() || datos.body;
      } catch {}
    }
  }

  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: datos.icon,
      badge: datos.badge,
      tag: datos.tag,
      renotify: true,
      vibrate: [160, 70, 160],
      data: { url: datos.url },
    })
  );
});

// Al tocar la notificación en Android / iOS / Escritorio: abrir directamente el chat correspondiente en la App de Tinkay
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rutaRelativa =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/panel/conversaciones";
  const urlDestino = new URL(rutaRelativa, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientes) => {
        for (const cliente of clientes) {
          try {
            const urlCliente = new URL(cliente.url);
            if (urlCliente.origin === self.location.origin) {
              cliente.postMessage({
                tipo: "ECO_ABRIR_RUTA_PUSH",
                url: rutaRelativa,
              });
              if ("navigate" in cliente && urlCliente.href !== urlDestino) {
                return cliente
                  .navigate(urlDestino)
                  .then((c) => (c ? c.focus() : cliente.focus()))
                  .catch(() => cliente.focus());
              }
              return cliente.focus();
            }
          } catch {}
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlDestino);
        }
        return undefined;
      })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esRutaOperativaOActivo =
    url.pathname === "/panel" ||
    url.pathname.startsWith("/panel/entregas") ||
    url.pathname.startsWith("/panel/taller") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".png");

  if (!esRutaOperativaOActivo) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((cached) => cached || caches.match("/panel/entregas") || caches.match("/panel"))
      )
  );
});
