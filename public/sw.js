const CACHE_NAME = 'photo-check-v2'; // Increment version to force update
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/camera-icon.svg'
];

// Store for background notification intervals
let notificationIntervals = new Map();
let heartbeatInterval = null;

// Keep service worker alive with heartbeat
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    console.log('💓 Service Worker: Heartbeat - keeping alive');
    console.log('📊 Active notification intervals:', notificationIntervals.size);

    // Log all active intervals
    for (const [userId, intervalId] of notificationIntervals.entries()) {
      console.log(`  User ${userId}: Interval ${intervalId}`);
    }
  }, 30000); // Every 30 seconds

  console.log('💓 Service Worker: Heartbeat started');
}

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('🔔 Service Worker: Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the service worker to activate immediately
        console.log('🔔 Service Worker: Installation complete, forcing activation...');
        return self.skipWaiting();
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
  console.log('🔔 Service Worker: Activated');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim().then(() => {
        console.log('🔔 Service Worker: Claimed all clients');
      })
    ])
  );

  // Start heartbeat to keep service worker alive
  startHeartbeat();
});

// Message event - handle communication from main app
self.addEventListener('message', (event) => {
  console.log('🔔 Service Worker: Received message:', event.data);
  console.log('🔔 Service Worker: Message type:', event.data?.type);
  console.log('🔔 Service Worker: Message data:', JSON.stringify(event.data));

  if (event.data?.type === 'START_NOTIFICATION_SERVICE') {
    console.log('🚀 Service Worker: Processing START_NOTIFICATION_SERVICE message');
    startBackgroundNotificationService(event.data.userId, event.data.intervalMinutes);
  } else if (event.data?.type === 'STOP_NOTIFICATION_SERVICE') {
    console.log('⏹️ Service Worker: Processing STOP_NOTIFICATION_SERVICE message');
    stopBackgroundNotificationService(event.data.userId);
  } else if (event.data?.type === 'SEND_NOTIFICATION_NOW') {
    console.log('📤 Service Worker: Processing SEND_NOTIFICATION_NOW message');
    sendBackgroundNotification(event.data.userId);
  } else if (event.data?.type === 'GET_SERVICE_STATUS') {
    console.log('📊 Service Worker: Processing GET_SERVICE_STATUS message');
    // Send back the current status
    const status = {
      activeIntervals: notificationIntervals.size,
      intervals: Array.from(notificationIntervals.entries()),
      heartbeatActive: heartbeatInterval !== null
    };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(status);
    } else {
      console.log('⚠️ Service Worker: No ports available for status response');
    }
  } else if (event.data?.type === 'COMMUNICATION_TEST') {
    console.log('🧪 Service Worker: Processing COMMUNICATION_TEST message');
    // Test communication by sending a response back
    if (event.source) {
      event.source.postMessage({
        type: 'COMMUNICATION_TEST_RESPONSE',
        timestamp: Date.now()
      });
      console.log('✅ Service Worker: Communication test response sent');
    } else {
      console.log('⚠️ Service Worker: No event source for communication test response');
    }
  } else if (event.data?.type === 'SKIP_WAITING') {
    // Skip waiting and activate immediately
    console.log('🔄 Service Worker: Received SKIP_WAITING message, activating...');
    self.skipWaiting();
  } else {
    console.log('⚠️ Service Worker: Unknown message type:', event.data?.type);
  }
});

// Start background notification service
function startBackgroundNotificationService(userId, intervalMinutes = 3) {
  console.log('🔔 Service Worker: Starting background notification service for user:', userId);
  console.log('🔔 Service Worker: User ID:', userId);
  console.log('🔔 Service Worker: Interval minutes:', intervalMinutes);
  console.log('🔔 Service Worker: Interval milliseconds:', intervalMinutes * 60 * 1000);

  // Clear any existing interval for this user
  if (notificationIntervals.has(userId)) {
    console.log('🔄 Service Worker: Clearing existing interval for user:', userId);
    clearInterval(notificationIntervals.get(userId));
  }

  // Send notification immediately
  console.log('📤 Service Worker: Sending immediate notification...');
  sendBackgroundNotification(userId);

  // Set up interval for future notifications
  const interval = setInterval(() => {
    console.log('⏰ Service Worker: Background interval fired for user:', userId);
    sendBackgroundNotification(userId);
  }, intervalMinutes * 60 * 1000); // intervalMinutes * 60 * 1000 for minutes, or just 30000 for 30 seconds

  console.log('⏰ Service Worker: Created interval with ID:', interval);
  notificationIntervals.set(userId, interval);

  console.log('✅ Service Worker: Background notification service started for user:', userId);
  console.log('⏰ Interval ID:', interval, 'for user:', userId);
  console.log('⏰ Next notification scheduled in:', intervalMinutes * 60, 'seconds');

  // Log all active intervals for debugging
  console.log('📊 Active intervals:', Array.from(notificationIntervals.entries()));
  console.log('📊 Total intervals in Map:', notificationIntervals.size);

  // Verify the interval was stored correctly
  if (notificationIntervals.has(userId)) {
    console.log('✅ Service Worker: Interval successfully stored for user:', userId);
  } else {
    console.error('❌ Service Worker: Failed to store interval for user:', userId);
  }
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
      silent: false, // This should trigger system sound
      data: {
        type: 'background-notification',
        userId: userId,
        timestamp: Date.now(),
        action: 'capture-photo'
      }
    };

    // Show the notification
    let notification = null;
    try {
      notification = await self.registration.showNotification(
        '📸 Photo Check Reminder!',
        options
      );
      console.log('✅ Service Worker: Background notification sent successfully');
    } catch (notificationError) {
      console.error('❌ Service Worker: Failed to show notification:', notificationError);
      notification = null;
    }

    // Play notification sound using Web Audio API
    playNotificationSound();

    // Notify the main app that a notification was sent
    console.log('📤 Service Worker: About to notify main app of notification sent for user:', userId);
    notifyMainAppOfNotificationSent(userId);

    // Auto-close after 8 seconds (only if notification was created successfully)
    if (notification && typeof notification.close === 'function') {
      setTimeout(() => {
        try {
          // Double-check that notification still exists and has close method
          if (notification && typeof notification.close === 'function') {
            notification.close();
            console.log('✅ Service Worker: Notification auto-closed successfully');
          } else {
            console.log('⚠️ Service Worker: Notification object invalid during auto-close, skipping');
          }
        } catch (closeError) {
          console.log('⚠️ Service Worker: Failed to auto-close notification:', closeError);
        }
      }, 8000);
    } else {
      console.log('⚠️ Service Worker: Notification object is undefined or invalid, skipping auto-close');
    }

  } catch (error) {
    console.error('❌ Service Worker: Failed to send background notification:', error);
  }
}

// Play notification sound using Web Audio API
function playNotificationSound() {
  try {
    console.log('🔊 Service Worker: Playing notification sound...');

    // Create audio context
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();

    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set sound properties
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz tone
    oscillator.type = 'sine';

    // Set volume and fade
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    // Play sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    console.log('✅ Service Worker: Notification sound played successfully');

  } catch (error) {
    console.log('⚠️ Service Worker: Failed to play notification sound:', error);

    // Fallback: try to play a simple beep using HTML5 audio
    try {
      console.log('🔄 Service Worker: Trying fallback audio method...');

      // Create a simple beep sound using base64 encoded audio
      const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHOq+8+OWT';

      // Note: Service Workers can't directly create Audio objects, so we'll rely on the main app
      // The main app will receive the NOTIFICATION_SENT message and can play sound there
      console.log('ℹ️ Service Worker: Fallback audio will be handled by main app');

    } catch (fallbackError) {
      console.log('❌ Service Worker: All audio methods failed:', fallbackError);
    }
  }
}

// Notify main app that a notification was sent
function notifyMainAppOfNotificationSent(userId) {
  console.log('📤 Service Worker: Attempting to notify main app of notification sent');

  // Try to notify all clients (tabs) that a notification was sent
  self.clients.matchAll().then(clients => {
    console.log('📤 Service Worker: Found clients:', clients.length);

    if (clients.length === 0) {
      console.log('⚠️ Service Worker: No clients found to notify');
      return;
    }

    clients.forEach(client => {
      console.log('📤 Service Worker: Sending message to client:', client.url);
      try {
        client.postMessage({
          type: 'NOTIFICATION_SENT',
          userId: userId,
          timestamp: Date.now()
        });
        console.log('✅ Service Worker: Message sent to client successfully');
      } catch (error) {
        console.error('❌ Service Worker: Failed to send message to client:', error);
      }
    });
  }).catch(error => {
    console.error('❌ Service Worker: Error finding clients:', error);
  });
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
  // Safely close the notification
  try {
    if (event.notification && typeof event.notification.close === 'function') {
      event.notification.close();
      console.log('✅ Service Worker: Notification closed successfully');
    } else {
      console.log('⚠️ Service Worker: Notification object invalid, skipping close');
    }
  } catch (closeError) {
    console.log('⚠️ Service Worker: Failed to close notification:', closeError);
  }

  console.log('🔔 Service Worker: Notification clicked!', event.notification.tag);
  console.log('🔔 Service Worker: Notification data:', event.notification.data);

  // Determine navigation URL based on notification type and data
  let notificationUrl = '/';

  if (event.notification.data && event.notification.data.type === 'background-notification') {
    // Background notification - navigate to generic capture page without specific reminder ID
    notificationUrl = '/capture';
    console.log('🔔 Service Worker: Background notification clicked, navigating to generic capture page');
  } else if (event.notification.tag && event.notification.tag.startsWith('test-')) {
    // Test notification - navigate to test capture page
    notificationUrl = '/capture/test-reminder-id';
    console.log('🔔 Service Worker: Test notification clicked, navigating to test capture page');
  } else if (event.notification.tag && !event.notification.tag.startsWith('background-')) {
    // Regular reminder notification - navigate to specific capture page
    notificationUrl = `/capture/${event.notification.tag}`;
    console.log('🔔 Service Worker: Regular reminder clicked, navigating to:', notificationUrl);
  } else {
    // Default to generic capture page for any other notification
    notificationUrl = '/capture';
    console.log('🔔 Service Worker: Default notification clicked, navigating to generic capture page');
  }

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
