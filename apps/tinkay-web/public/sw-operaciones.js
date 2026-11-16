// Service Worker Offline-First para la PWA unificada de Tinkay (/panel, /panel/entregas, /panel/taller, /panel/conversaciones)
const CACHE_NAME = "eco-portal-operaciones-v3";
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
