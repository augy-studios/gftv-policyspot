// Bump CACHE_VERSION on every deploy so stale caches are purged immediately.
const CACHE_VERSION = 'v7';
const CACHE = `gftv-policyspot-${CACHE_VERSION}`;

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/GHS-main.png",
  "/favicon.ico",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) =>
        clients.forEach((c) => c.postMessage({ type: "SW_UPDATED" }))
      )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always go straight to the network for API calls.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"ok":false,"error":"Offline"}', {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Network-first for the app shell, using cache:'reload' so the HTTP cache is
  // bypassed and F5 always retrieves the latest deployed files.
  const isAppShell = ["/", "/index.html", "/style.css", "/script.js"].includes(
    url.pathname
  );
  if (isAppShell) {
    e.respondWith(
      fetch(new Request(e.request, { cache: "reload" }))
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (images, fonts, etc.).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match("/"));
    })
  );
});
