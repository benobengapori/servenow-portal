/*
 * ServeNow service worker: makes the installed app open instantly and keep working offline
 * for pages already visited. Hashed build assets are cache-first; pages are network-first so
 * a new deploy shows up on the next launch.
 */
const VERSION = 'sn-v1';
const scope = new URL(self.registration.scope).pathname; // e.g. "/servenow-portal/"

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll([`${scope}jobs/`, `${scope}jobs/new/`]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;

  const immutable = url.pathname.includes('/_next/static/') || url.pathname.includes('/icons/');
  if (immutable) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(`${scope}jobs/`))),
  );
});
