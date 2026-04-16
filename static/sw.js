/* Keeper League Service Worker — Push Notifications only.
 * Caching has been removed entirely — it caused stale-page bugs after deploys
 * that wasted hours of debugging. The browser's built-in HTTP cache (with the
 * server's Cache-Control: no-store headers on dynamic responses, and long
 * immutable caches on hashed static assets) does the right thing without us. */

var SW_VERSION = 'kl-v29-killswitch';

/* ── Install: take over immediately ── */
self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

/* ── Activate: nuke ALL caches from previous SW versions, claim clients ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* No fetch handler — every request goes straight through to the network. */

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
