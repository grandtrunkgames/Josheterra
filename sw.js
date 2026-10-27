// Josheterra offline support.
// When online, the app's own files are checked against the website on every launch,
// so updates appear right away. When offline, the saved copies are used instead.
const VERSION = 'josheterra-v10';
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
    // cache:'reload' skips the phone's ordinary web cache so the newest files are stored.
    await cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    for (const url of EXTERNAL) {
      try { await cache.add(new Request(url, { mode: 'cors' })); } catch (e) { /* fetched on first use */ }
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

function timeout(ms) { return new Promise(r => setTimeout(() => r(null), ms)); }

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (url.origin === self.location.origin) {
      // Network first: ask the website whether the file changed (cheap when it hasn't).
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      const cached = await cache.match(req, { ignoreSearch: true });
      // With no saved copy, wait as long as it takes; otherwise give the network a few seconds.
      const res = cached ? await Promise.race([net, timeout(4000)]) : await net;
      if (res && res.ok) return res;
      if (cached) { event.waitUntil(net); return cached; }
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return res || Response.error();
    }
    // Libraries and fonts from other sites: saved copy first, fetched once otherwise.
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (e) { return Response.error(); }
  })());
});
