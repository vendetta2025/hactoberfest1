// Nudgify Web Push Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: '🔔 Nudgify',
    body: 'You have a new schedule update.',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: '🔔 Nudgify',
        body: event.data.text(),
        data: { url: '/' },
      };
    }
  }

  const title = payload.title || '🔔 Nudgify';
  const options = {
    body: payload.body,
    icon: payload.icon || 'https://api.iconify.design/lucide:bell-ring.svg?color=%23d97706',
    badge: payload.badge || 'https://api.iconify.design/lucide:bell.svg?color=%23d97706',
    tag: payload.tag || `nudgify-${payload.data?.taskId || Date.now()}`,
    data: payload.data || { url: '/' },
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle clicking a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Nudgify window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
