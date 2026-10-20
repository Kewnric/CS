/* StudySession Pro — service worker.

   THE STRATEGY, AND WHY IT CHANGED.

   This was network-first, and it additionally re-requested every .js and .css
   with `cache: 'no-cache'` so an edit would land on the very next load. The
   cost of that is one network round trip per file before the app can run, and
   this page loads 127 scripts and 37 stylesheets — so every reload paid 164
   round trips, in a queue, before a single line of the app executed. Locally
   that is invisible; over the network it is the reload being slow.

   It is now cache-first with a background refresh (stale-while-revalidate) for
   static assets: a reload is served entirely from cache with no network in the
   critical path, and each file is re-fetched afterwards so the next load has
   the new copy. Freshness is delayed by one load rather than paid for on every
   one.

   That is safe here because the cache is versioned and the version is bumped on
   every change (see CLAUDE.md). A deploy installs a new worker, which builds a
   new cache from the network and deletes the old one, so a release is never
   served from a stale cache — the revalidation was insuring against a risk the
   version bump already covers.

   Navigations stay network-first, so a new index.html — and with it a new
   worker — is noticed as soon as the network allows, with the cached shell as
   the offline fallback. */
const CACHE = 'ssp-v409';
// The bundled comic font too, so comic notes letter correctly offline even
// before one has been shown online.
const SHELL = ['./index.html', './manifest.json', './fonts/comic-neue-bold.woff2'];

/* Third-party libraries the page loads. Every URL in index.html pins an exact
   version, so a cached copy never goes stale and cache-first is safe. Without
   this the worker let them all pass, and an offline start had no icons,
   Markdown or editor -- the shell came from cache and nothing it needed did.
   Fonts (unversioned CSS) are left to the browser. */
const CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'cdn.quilljs.com', 'www.gstatic.com'];

/** Static assets are content we hold; everything else goes to the network. */
function isStatic(url) {
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|mp3|ogg|wav)$/i.test(url.pathname);
}

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
  if (url.origin !== self.location.origin) {
    if (!CDN_HOSTS.includes(url.hostname)) return;
    /* Fetched in CORS mode, not as the page's no-cors request: an opaque
       response hides its status, so a one-off CDN error would be cached and
       served for good -- online too -- until the next CACHE bump. All four
       hosts send Access-Control-Allow-Origin: *. If one ever stops, the
       request still goes through as the page made it, just uncached. */
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req.url, { mode: 'cors', credentials: 'omit' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => fetch(req)))
    );
    return;
  }

  /* Navigations: network-first. This is the request that carries a new release
     into the browser, so it is worth one round trip; the cached shell answers
     when there is no network. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || new Response('', { status: 504 })))
    );
    return;
  }

  if (!isStatic(url)) return; // anything else behaves as though there were no worker

  /* Cache-first, refreshed behind the response. The page never waits on the
     network for these; the copy it gets is the one the last visit fetched. */
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit || new Response('', { status: 504, statusText: 'Offline' }));

      // A hit answers now and the refresh continues in the background. Without
      // waitUntil the worker can be killed before that write lands, and the
      // cache would never move forward.
      if (hit) {
        event.waitUntil(fetching.catch(() => {}));
        return hit;
      }
      return fetching;
    })
  );
});
