const CACHE_NAME = 'photo-check-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/camera-icon.svg'
];

// Store for background notification intervals
let notificationIntervals = new Map();

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

// Message event - handle communication from main app
self.addEventListener('message', (event) => {
  console.log('🔔 Service Worker: Received message:', event.data);

  if (event.data.type === 'START_NOTIFICATION_SERVICE') {
    startBackgroundNotificationService(event.data.userId, event.data.intervalMinutes);
  } else if (event.data.type === 'STOP_NOTIFICATION_SERVICE') {
    stopBackgroundNotificationService(event.data.userId);
  } else if (event.data.type === 'SEND_NOTIFICATION_NOW') {
    sendBackgroundNotification(event.data.userId);
  }
});

// Start background notification service
function startBackgroundNotificationService(userId, intervalMinutes = 3) {
  console.log('🔔 Service Worker: Starting background notification service for user:', userId);

  // Clear any existing interval for this user
  if (notificationIntervals.has(userId)) {
    clearInterval(notificationIntervals.get(userId));
  }

  // Send notification immediately
  sendBackgroundNotification(userId);

  // Set up interval for future notifications
  const interval = setInterval(() => {
    console.log('⏰ Service Worker: Background interval fired for user:', userId);
    sendBackgroundNotification(userId);
  }, intervalMinutes * 60 * 1000);

  notificationIntervals.set(userId, interval);
  console.log('✅ Service Worker: Background notification service started for user:', userId);
}

// Stop background notification service
function stopBackgroundNotificationService(userId) {
  console.log('🔔 Service Worker: Stopping background notification service for user:', userId);

  if (notificationIntervals.has(userId)) {
    clearInterval(notificationIntervals.get(userId));
    notificationIntervals.delete(userId);
    console.log('✅ Service Worker: Background notification service stopped for user:', userId);
  }
}

// Send a background notification
async function sendBackgroundNotification(userId) {
  try {
    console.log('🔔 Service Worker: Sending background notification for user:', userId);

    // Create notification with sound
    const options = {
      body: 'Time to take a photo! Click to start.',
      icon: '/camera-icon.svg',
      badge: '/camera-icon.svg',
      tag: `background-${userId}-${Date.now()}`,
      requireInteraction: true,
      silent: false // This should trigger system sound
    };

    // Show the notification
    const notification = await self.registration.showNotification(
      '📸 Photo Check Reminder!',
      options
    );

    console.log('✅ Service Worker: Background notification sent successfully');

    // Auto-close after 8 seconds
    setTimeout(() => {
      notification.close();
    }, 8000);

  } catch (error) {
    console.error('❌ Service Worker: Failed to send background notification:', error);
  }
}

// Push notification event (for future push notifications)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Time to take a photo!',
      icon: '/camera-icon.svg',
      badge: '/camera-icon.svg',
      tag: data.tag || 'photo-reminder',
      requireInteraction: true
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
  const notificationUrl = reminderId && !reminderId.startsWith('background-') ? `/capture/${reminderId}` : '/';

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
