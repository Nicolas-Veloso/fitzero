/**
 * @file sw.js
 * @description Service Worker Offline-First Estrito — FitZero
 * Responsável: Dev 1 (Tech Lead & PWA Core) — [PWA-02]
 * Estratégia: Cache-First estrita com pré-cache de App Shell + Fallback Offline
 */

const CACHE_NAME = 'fitzero-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './workout-session.js',
  './storage.js',
  './manifest.webmanifest',
  './exercises.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

/**
 * Fallback HTML minimalista caso o cache seja limpo manualmente sem rede
 */
const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — FitZero</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #050505;
      color: #f5f5f5;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1.5rem;
    }
    .panel {
      max-width: 380px;
      background: #0d0d0d;
      border: 1px solid #1f1f1f;
      border-radius: 14px;
      padding: 1.75rem;
    }
    .tag {
      display: inline-block;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #d4ff00;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    h1 { color: #f5f5f5; font-size: 1.35rem; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
    p { color: #8a8a8e; line-height: 1.55; font-size: 0.92rem; margin: 0 0 1.25rem; }
    button {
      width: 100%;
      min-height: 48px;
      padding: 0.75rem 1.25rem;
      border: none;
      border-radius: 8px;
      background: #d4ff00;
      color: #050505;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="panel" role="main">
    <span class="tag">FitZero • Modo Offline</span>
    <h1>Sem conexão no momento</h1>
    <p>O FitZero opera 100% offline após o primeiro carregamento. Conecte-se uma única vez para sincronizar o catálogo local no aparelho.</p>
    <button type="button" onclick="window.location.reload()">Recarregar</button>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        try {
          await cache.addAll(PRECACHE_ASSETS);
        } catch (err) {
          console.warn('[SW] Falha parcial no addAll, realizando cache individual:', err);
          await Promise.allSettled(
            PRECACHE_ASSETS.map(async (url) => {
              const response = await fetch(url, { cache: 'reload' });
              if (response.ok) {
                await cache.put(url, response);
              }
            })
          );
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((legacyName) => caches.delete(legacyName))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse =
    (await cache.match(request)) ||
    (await cache.match(request, { ignoreSearch: true }));

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse &&
      networkResponse.status === 200 &&
      (networkResponse.type === 'basic' || networkResponse.type === 'cors')
    ) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const acceptHeader = request.headers.get('accept') || '';
    const url = new URL(request.url);

    if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
      const cachedShell =
        (await cache.match('./index.html')) ||
        (await cache.match('./'));
      if (cachedShell) {
        return cachedShell;
      }
      return new Response(OFFLINE_FALLBACK_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (url.pathname.endsWith('.json') || acceptHeader.includes('application/json')) {
      return new Response(JSON.stringify({ offline: true, exercises: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (url.pathname.endsWith('.svg') || acceptHeader.includes('image/svg+xml')) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0d0d0d"/></svg>',
        {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
        }
      );
    }

    return new Response('Recurso indisponível offline.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(cacheFirstStrategy(request));
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_CACHE_STATUS' && event.ports && event.ports[0]) {
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      event.ports[0].postMessage({
        cacheName: CACHE_NAME,
        cachedCount: keys.length,
        urls: keys.map((req) => req.url)
      });
    });
  }
});
