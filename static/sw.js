/* Keeper League Service Worker — Push Notifications */

self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data = {title: event.data.text()}; }
  }
  var title = data.title || 'Keeper League';
  var options = {
    body: data.body || '',
    icon: '/static/favicon.svg',
    badge: '/static/favicon.svg',
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
