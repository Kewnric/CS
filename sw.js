/* StudySession Pro — service worker (network-first, offline fallback).
   Online: always serves fresh from the network (so live edits show up and
   nothing goes stale). Offline: falls back to the last cached copy, and to
   the cached app shell for navigations. Bump CACHE to invalidate. */
const CACHE = 'ssp-v65';
const SHELL = ['./index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDNs pass through

  // Network-first still went through the browser's own HTTP cache, which may
  // hold a script or stylesheet for as long as its max-age allows — ten
  // minutes on GitHub Pages. That reads as "my change did not deploy". Asking
  // for revalidation makes an updated file land on the very next load and
  // costs only a 304 when nothing changed. Navigations are left alone: a
  // Request in navigate mode cannot be reconstructed.
  let hit = req;
  if (req.mode !== 'navigate' && /\.(?:js|css)$/.test(url.pathname)) {
    try { hit = new Request(req, { cache: 'no-cache' }); } catch (e) { hit = req; }
  }

  event.respondWith(
    fetch(hit)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        })
      )
  );
});
