/* Easy Photo — service worker (FOUNDATION workstream)
 *
 * Cache-first for the app shell so the app opens offline after first visit.
 * Same-origin GET requests that miss the cache are fetched, cached for next
 * time, and fall back to the shell for navigations when fully offline.
 *
 * Bump CACHE_VERSION to ship a new shell.
 */
var CACHE_VERSION = 'easy-photo-shell-v2';

var SHELL = [
  './',
  './index.html',
  './index.js',
  './manifest.json',
  './shell.css',
  './core/a11y.css',
  './core/a11y.js',
  './core/db.js',
  './core/auth.js',
  './core/trueai.js',
  './core/mary-galleries.js',
  './core/pages.css',
  './galleries/galleries.html',
  './galleries/galleries.js',
  './inbox/inbox.html',
  './clients/clients.html',
  './pipeline/pipeline.html',
  './pipeline/payments.html',
  './calendar/calendar.html',
  './calendar/calendar.js',
  './email/email.html',
  './email/email.js',
  './website/website.html',
  './website/website.js',
  './print/print.html',
  './print/print.js',
  './booking/booking.html',
  './booking/booking.js',
  './settings/settings.html',
  './settings/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k !== CACHE_VERSION; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin: network only

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit; // cache-first for the shell
      return fetch(req).then(function (res) {
        // Cache successful same-origin responses for offline use.
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      }).catch(function () {
        // Offline: navigations get the shell; assets get a plain 503.
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
