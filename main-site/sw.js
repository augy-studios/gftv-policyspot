// Bump CACHE_VERSION on every deploy that changes anything this worker
// serves. The browser compares this file byte for byte: if nothing here
// changes, no reader is ever told a new version exists. Treat a forgotten
// bump as a build error, not a habit. See update-bar-spec.md.
const CACHE_VERSION = 'v6';
const CACHE = `gftv-policyspot-${CACHE_VERSION}`;

// The app shell. Served cache-first, so a reader keeps the version they
// opened until they accept the update notice and the page reloads.
const ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/style.css",
  "/script.js",
  "/official-bar.js",
  "/assets/fonts/ProximaNova-Regular.woff2",
  "/gftv-flag.png",
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

// No skipWaiting() here. The new worker installs and then waits; the only
// thing that promotes it is the message handler below, sent when a reader
// presses Reload on the update notice.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // The shell is fetched fresh, so a stale HTTP cache cannot install an
      // old copy under a new version.
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })))
    )
  );
});

// No clients.claim() here. Claiming on activation would take over open pages
// mid-session, which is exactly what the update notice exists to ask about.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => caches.open(CACHE))
      .then((cache) => prefetchAllContent(cache))
  );
});

self.addEventListener("message", (event) => {
  const type = typeof event.data === "string" ? event.data : event.data?.type;

  // The only place either of these is ever called.
  if (type === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

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

  // SPA routes (/the-charter, /news/..., ...) are all served by index.html.
  // Any navigation that is not a real file falls back to the cached shell.
  if (e.request.mode === "navigate") {
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
          .catch(() => caches.match("/index.html").then((shell) => shell || caches.match("/")));
      })
    );
    return;
  }

  // Everything else (shell files, images, fonts): cache-first
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
        .catch(() => Response.error());
    })
  );
});
