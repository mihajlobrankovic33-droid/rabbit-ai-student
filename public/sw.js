const CACHE_NAME = "study-buddy-cache-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/logo.svg",
  "/auth",
  "/dashboard",
];

// Install: Pre-cache foundational app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("Precaching non-fatal warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for app assets, Network-First for APIs
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for Ollama local requests and Gemini API requests so live local AI works without stale cache
  if (
    url.port === "11434" ||
    url.hostname === "localhost" && url.port === "11434" ||
    url.hostname === "127.0.0.1" && url.port === "11434" ||
    url.hostname.includes("generativelanguage.googleapis.com") ||
    request.method !== "GET"
  ) {
    return;
  }

  // Handle SPA navigation: return cached index.html if offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("/index.html") || await cache.match("/");
        return cachedIndex || new Response("Offline - Study Buddy is ready in cache", {
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }

  // Assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for custom messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "DOWNLOAD_APP_OFFLINE") {
    const urlsToCache = event.data.urls || PRECACHE_URLS;
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        let completed = 0;
        for (const url of urlsToCache) {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (e) {
            console.warn("Failed to download resource for offline cache:", url, e);
          }
          completed++;
          // Send progress back to clients
          const clients = await self.clients.matchAll();
          for (const client of clients) {
            client.postMessage({
              type: "DOWNLOAD_PROGRESS",
              completed,
              total: urlsToCache.length,
              url,
            });
          }
        }
        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({
            type: "DOWNLOAD_COMPLETE",
          });
        }
      })
    );
  }
});
