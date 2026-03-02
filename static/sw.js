/* Keeper League Service Worker — Caching + Push Notifications */

var SHELL_CACHE = 'kl-shell-v1';
var DYNAMIC_CACHE = 'kl-dynamic-v1';
var MAX_DYNAMIC = 50;

var SHELL_ASSETS = [
  '/static/style.css',
  '/static/favicon.svg',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png'
];

/* ── Install: cache app shell ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) {
          return k !== SHELL_CACHE && k !== DYNAMIC_CACHE;
        }).map(function(k) {
          return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: shell=cache-first, pages=network-first ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Shell assets — cache-first
  if (SHELL_ASSETS.some(function(a) { return url.pathname === a; })) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(resp) {
          var clone = resp.clone();
          caches.open(SHELL_CACHE).then(function(c) { c.put(event.request, clone); });
          return resp;
        });
      })
    );
    return;
  }

  // HTML pages — network-first, fallback to cache
  if (event.request.headers.get('Accept') && event.request.headers.get('Accept').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(event.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(DYNAMIC_CACHE).then(function(cache) {
          cache.put(event.request, clone);
          // LRU eviction
          cache.keys().then(function(keys) {
            if (keys.length > MAX_DYNAMIC) {
              cache.delete(keys[0]);
            }
          });
        });
        return resp;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Other static assets (CDN CSS/JS, fonts) — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(resp) {
        if (resp && resp.ok) {
          var clone = resp.clone();
          caches.open(DYNAMIC_CACHE).then(function(c) { c.put(event.request, clone); });
        }
        return resp;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

/* ── Push Notifications ── */
self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data = {title: event.data.text()}; }
  }
  var title = data.title || 'Keeper League';
  var options = {
    body: data.body || '',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-192.png',
    data: { url: data.link || '/' },
    tag: data.tag || 'kl-notification',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(url) !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
