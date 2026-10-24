// Josheterra offline support.
// App files are served from the cache straight away and refreshed in the background,
// so the app opens instantly, works offline, and picks up updates on the next launch.
const VERSION = 'josheterra-v2';
const CORE = [
  './', 'index.html', 'map.html', 'flags.html', 'manifest.webmanifest',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
const EXTERNAL = [
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    for (const url of EXTERNAL) {
      try { await cache.add(new Request(url, { mode: 'cors' })); } catch (e) { /* fetched again on first use */ }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
