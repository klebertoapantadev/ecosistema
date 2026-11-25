// Service Worker PWA + Web Push Estilo WhatsApp para Tinkay (/panel, /panel/conversaciones, /panel/chat-equipo, /panel/entregas, /panel/taller)
const CACHE_NAME = "eco-portal-operaciones-v8";
const RUTAS_PRECACHE = [
  "/icons/icon-192.png?v=3",
  "/icons/icon-512.png?v=3",
  "/img/logo/tinkay-logo.png?v=2",
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

// Recepción de Notificación Web Push en segundo plano (estilo WhatsApp + Pedidos)
self.addEventListener("push", (event) => {
  let datos = {
    title: "Tinkay · Nueva notificación",
    body: "Tienes una actualización pendiente en Tinkay.",
    url: "/panel",
    notId: null,
    negocio: "tinkay",
    tag: "tinkay-alerta",
    icon: "/icons/icon-192.png?v=3",
    badge: "/icons/icon-192.png?v=3",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        datos = {
          title: parsed.title || datos.title,
          body: parsed.body || datos.body,
          url: parsed.url || datos.url,
          notId: parsed.notId || null,
          negocio: parsed.negocio || datos.negocio,
          tag: parsed.tag || datos.tag,
          icon: parsed.icon || datos.icon,
          badge: parsed.badge || datos.badge,
        };
      }
    } catch {
      try {
        datos.body = event.data.text() || datos.body;
      } catch {
        // Ignorar payload no textual
      }
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
      data: {
        url: datos.url,
        notId: datos.notId,
        negocio: datos.negocio,
      },
    })
  );
});

// Al tocar la notificación en Android / iOS / Escritorio: marcar como leída y abrir directamente el pedido o chat exacto
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dataNotif = (event.notification && event.notification.data) || {};
  const rutaRelativa = dataNotif.url || "/panel";
  const notId = dataNotif.notId || null;
  const negocio = dataNotif.negocio || "tinkay";
  const urlDestino = new URL(rutaRelativa, self.location.origin).href;

  const promesas = [];

  if (notId) {
    promesas.push(
      fetch(
        `/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`,
        {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negocio,
            not_id: notId,
            accion: "aceptar",
          }),
        }
      ).catch(() => undefined)
    );
  }

  promesas.push(
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
                notId,
              });
              if ("navigate" in cliente && urlCliente.href !== urlDestino) {
                return cliente
                  .navigate(urlDestino)
                  .then((c) => (c ? c.focus() : cliente.focus()))
                  .catch(() => cliente.focus());
              }
              return cliente.focus();
            }
          } catch {
            // Continuar con siguiente ventana
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlDestino);
        }
        return undefined;
      })
  );

  event.waitUntil(Promise.all(promesas));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear HTML de navegación (/panel depende del rol/sesión del usuario activo en el teléfono)
  if (req.mode === "navigate") return;

  const esActivoEstatico =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".png");

  if (!esActivoEstatico) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
