const CACHE_NAME = 'photo-check-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Time to take a photo!',
      icon: '/diaper-icon.png',
      badge: '/diaper-icon.png',
      tag: data.tag || 'photo-reminder',
      requireInteraction: true
      // Note: Actions are supported in Service Worker notifications
      // But we'll keep it simple for now
    };

    event.waitUntil(
      self.registration.showNotification(data.title || '📸 Photo Time!', options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  console.log('🔔 Service Worker: Notification clicked!', event.notification.tag);

  // Get reminder ID from notification tag if available
  const reminderId = event.notification.tag;
  const notificationUrl = reminderId ? `/capture/${reminderId}` : '/';

  console.log('🔔 Service Worker: Navigating to:', notificationUrl);

  // Navigate directly to photo capture page or dashboard
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      console.log('🔔 Service Worker: Found clients:', clientList.length);

      for (const client of clientList) {
        console.log('🔔 Service Worker: Client URL:', client.url);
        if (client.url.includes('/') && 'focus' in client) {
          console.log('🔔 Service Worker: Focusing and navigating client to:', notificationUrl);
          client.focus();
          return client.navigate(notificationUrl);
        }
      }

      if (clients.openWindow) {
        console.log('🔔 Service Worker: Opening new window to:', notificationUrl);
        return clients.openWindow(notificationUrl);
      }
    })
  );
});
