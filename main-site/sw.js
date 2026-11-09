// Bump CACHE_VERSION on every deploy that changes anything this worker
// serves. The browser compares this file byte for byte: if nothing here
// changes, no reader is ever told a new version exists. Treat a forgotten
// bump as a build error, not a habit. See update-bar-spec.md.
const CACHE_VERSION = 'v10';
const CACHE_NAME = `gftv-policyspot-${CACHE_VERSION}`;

// The app shell. Served cache-first, so a reader keeps the version they
// opened until they accept the update notice and the page reloads.
const APP_SHELL_FILES = [
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

// All document types and their API endpoints
const DOCUMENT_ENDPOINTS = [
  { sections: '/api/policy/sections',       section: '/api/policy/section'       },
  { sections: '/api/policy/news/sections',  section: '/api/policy/news/section'  },
  { sections: '/api/policy/prs/sections',   section: '/api/policy/prs/section'   },
  { sections: '/api/policy/rules/sections', section: '/api/policy/rules/section' },
  { sections: '/api/policy/join/sections',  section: '/api/policy/join/section'  },
  { sections: '/api/policy/legal/sections', section: '/api/policy/legal/section' },
];

/**
 * Downloads every section list and every individual section of every
 * document and stores them in the cache, so the whole site can be read offline.
 */
async function prefetchAllContent(cache) {
  for (const documentEndpoint of DOCUMENT_ENDPOINTS) {
    let slugs = [];
    try {
      const sectionsResponse = await fetch(documentEndpoint.sections);
      if (!sectionsResponse.ok) {
        continue;
      }
      const responseCopy = sectionsResponse.clone();
      await cache.put(documentEndpoint.sections, responseCopy);
      const responseJson = await sectionsResponse.json();
      const sectionList = responseJson.sections || [];
      slugs = sectionList
        .map(function (section) { return section.slug; })
        .filter(Boolean);
    } catch {
      continue;
    }

    await Promise.allSettled(
      slugs.map(async (slug) => {
        const sectionUrl = `${documentEndpoint.section}?slug=${encodeURIComponent(slug)}`;
        try {
          const sectionResponse = await fetch(sectionUrl);
          if (sectionResponse.ok) {
            await cache.put(sectionUrl, sectionResponse);
          }
        } catch {
          // skip individual failures silently
        }
      })
    );
  }
}

/**
 * Fetches a request from the network and, when it succeeds, stores a copy
 * in the cache for later. The original network response is returned.
 */
function fetchAndCache(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseCopy = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
    }
    return networkResponse;
  });
}

// No skipWaiting() here. The new worker installs and then waits; the only
// thing that promotes it is the message handler below, sent when a reader
// presses Reload on the update notice.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // The shell is fetched fresh, so a stale HTTP cache cannot install an
      // old copy under a new version.
      const freshRequests = APP_SHELL_FILES.map((fileUrl) => new Request(fileUrl, { cache: "reload" }));
      return cache.addAll(freshRequests);
    })
  );
});

// No clients.claim() here. Claiming on activation would take over open pages
// mid-session, which is exactly what the update notice exists to ask about.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Delete every cache that belongs to an older version
        const oldCacheNames = cacheNames.filter((cacheName) => cacheName !== CACHE_NAME);
        return Promise.all(oldCacheNames.map((cacheName) => caches.delete(cacheName)));
      })
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => prefetchAllContent(cache))
  );
});

self.addEventListener("message", (event) => {
  // The page may send either a plain string or an object with a "type" field
  let messageType = undefined;
  if (typeof event.data === "string") {
    messageType = event.data;
  } else if (event.data) {
    messageType = event.data.type;
  }

  // The only place either of these is ever called.
  if (messageType === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // API calls: network-first, fall back to cache, then offline response
  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(
      fetchAndCache(event.request).catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('{"ok":false,"error":"Offline"}', {
            headers: { "Content-Type": "application/json" },
          });
        })
      )
    );
    return;
  }

  // SPA routes (/the-charter, /news/..., ...) are all served by index.html.
  // Any navigation that is not a real file falls back to the cached shell.
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetchAndCache(event.request).catch(() =>
          caches.match("/index.html").then((cachedShell) => {
            if (cachedShell) {
              return cachedShell;
            }
            return caches.match("/");
          })
        );
      })
    );
    return;
  }

  // Everything else (shell files, images, fonts): cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetchAndCache(event.request).catch(() => Response.error());
    })
  );
});
