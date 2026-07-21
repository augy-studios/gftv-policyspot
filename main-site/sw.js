// Bump CACHE_VERSION on every deploy so stale caches are purged immediately.
const CACHE_VERSION = 'v3';
const CACHE = `gftv-policyspot-${CACHE_VERSION}`;

const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/GHS-main.png",
  "/favicon.ico",
  "/manifest.json",
  "/llms.txt"
];

// All doc types and their API endpoints
const DOCS = [
  { sections: '/api/policy/sections',       section: '/api/policy/section'       },
  { sections: '/api/policy/news/sections',  section: '/api/policy/news/section'  },
  { sections: '/api/policy/prs/sections',   section: '/api/policy/prs/section'   },
  { sections: '/api/policy/rules/sections', section: '/api/policy/rules/section' },
  { sections: '/api/policy/join/sections',  section: '/api/policy/join/section'  },
  { sections: '/api/policy/legal/sections', section: '/api/policy/legal/section' },
];

async function prefetchAllContent(cache) {
  for (const doc of DOCS) {
    let slugs = [];
    try {
      const res = await fetch(doc.sections);
      if (!res.ok) continue;
      const clone = res.clone();
      await cache.put(doc.sections, clone);
      const json = await res.json();
      slugs = (json.sections || []).map(s => s.slug).filter(Boolean);
    } catch {
      continue;
    }

    await Promise.allSettled(
      slugs.map(async (slug) => {
        const url = `${doc.section}?slug=${encodeURIComponent(slug)}`;
        try {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch {
          // skip individual failures silently
        }
      })
    );
  }
}

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
      .then(() => caches.open(CACHE))
      .then((cache) => prefetchAllContent(cache))
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) =>
        clients.forEach((c) => c.postMessage({ type: "SW_UPDATED" }))
      )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API calls: network-first, fall back to cache, then offline response
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(
            (cached) =>
              cached ||
              new Response('{"ok":false,"error":"Offline"}', {
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // App shell: network-first with cache bypass so deploys are always fresh
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

  // Everything else (images, fonts, etc.): cache-first
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
