const CACHE_NAME = 'camino-frances-v1';

const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// ── Install: pre-cache all static assets ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old cache versions ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static assets ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Block any requests not on the allowlist (defence-in-depth)
  const allowedOrigins = [
    self.location.origin,
    'https://cdnjs.cloudflare.com'
  ];
  if (!allowedOrigins.some(o => url.origin === new URL(o).origin)) {
    event.respondWith(
      new Response('Blocked by service worker policy', { status: 403 })
    );
    return;
  }

  // Cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            if (
              response.ok &&
              (url.origin === self.location.origin ||
               url.origin === 'https://cdnjs.cloudflare.com')
            ) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline — resource unavailable', { status: 503 });
          });
      })
  );
});
