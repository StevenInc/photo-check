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
    console.log('💓 Service Worker: Current time:', new Date().toLocaleString());

    // Log all active intervals
    for (const [userId, intervalId] of notificationIntervals.entries()) {
      console.log(`  User ${userId}: Timeout ${intervalId}`);
    }

    // Check if any timeouts are still valid and log their expected times
    for (const [userId, timeoutId] of notificationIntervals.entries()) {
      try {
        // Try to access the timeout to see if it's still valid
        console.log(`  User ${userId}: Timeout ${timeoutId} - checking validity...`);
      } catch (error) {
        console.error(`  User ${userId}: Timeout ${timeoutId} is invalid:`, error);
      }
    }


  }, 10000); // Every 10 seconds for more frequent checking

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
  try {
    console.log('🔔 Service Worker: Received message:', event.data);
    console.log('🔔 Service Worker: Message type:', event.data?.type);
    console.log('🔔 Service Worker: Message data:', JSON.stringify(event.data));

      if (event.data?.type === 'START_NOTIFICATION_SERVICE') {
    console.log('🚀 Service Worker: Processing START_NOTIFICATION_SERVICE message');
    console.log('🚀 Service Worker: User ID:', event.data.userId);
    console.log('🚀 Service Worker: Min minutes range:', event.data.minMinutesRange);
    console.log('🚀 Service Worker: Max minutes range:', event.data.maxMinutesRange);
    console.log('🚀 Service Worker: Duration hours:', event.data.durationHours);

    // Check if service is already running for this user
    if (notificationIntervals.has(event.data.userId)) {
      console.log('🔄 Service Worker: Service already running for user, stopping first...');
      stopBackgroundNotificationService(event.data.userId);
    }

    startBackgroundNotificationService(event.data.userId, event.data.minMinutesRange, event.data.maxMinutesRange, event.data.durationHours);
    } else if (event.data?.type === 'STOP_NOTIFICATION_SERVICE') {
      console.log('⏹️ Service Worker: Processing STOP_NOTIFICATION_SERVICE message');
      console.log('⏹️ Service Worker: User ID:', event.data.userId);
      console.log('⏹️ Service Worker: Current notification intervals:', notificationIntervals.size);
      console.log('⏹️ Service Worker: Active intervals:', Array.from(notificationIntervals.entries()));
      stopBackgroundNotificationService(event.data.userId);

    } else if (event.data?.type === 'SEND_NOTIFICATION_NOW') {
      console.log('📤 Service Worker: Processing SEND_NOTIFICATION_NOW message');
      console.log('📤 Service Worker: Testing immediate notification...');

      sendBackgroundNotification(event.data.userId, true); // true = insert into database for manual notifications
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
  } catch (error) {
    console.error('❌ Service Worker: Error in message handler:', error);
  }
});

// Start background notification service
function startBackgroundNotificationService(userId, minMinutesRange = 20, maxMinutesRange = 40, durationHours = 4) {
  console.log('🔔 Service Worker: FUNCTION CALLED - startBackgroundNotificationService');
  console.log('🔔 Service Worker: Starting background notification service for user:', userId);
  console.log('🔔 Service Worker: Duration set to:', durationHours, 'hours with random 2-4 min intervals');

  // Clear any existing timeout for this user
  if (notificationIntervals.has(userId)) {
    console.log('🔄 Service Worker: Clearing existing timeout for user:', userId);
    clearTimeout(notificationIntervals.get(userId));
    notificationIntervals.delete(userId);
  }

  // Calculate end time (4 hours from now)
  const endTime = Date.now() + (durationHours * 60 * 60 * 1000);
  console.log('🔔 Service Worker: Service will run until:', new Date(endTime).toLocaleString());

  // Send notification immediately (but don't insert into database - this is just the initial notification)
  console.log('📤 Service Worker: Sending immediate notification...');
  sendBackgroundNotification(userId, false); // false = don't insert into database

  // Notify main app that service started and will send first scheduled notification
  self.clients.matchAll().then(clients => {
    if (clients.length > 0) {
      const targetClient = clients[0];
      try {
        targetClient.postMessage({
          type: 'NOTIFICATION_SERVICE_STARTED',
          userId: userId,
          message: 'Service started - first scheduled notification will be sent in 30-60 seconds'
        });
        console.log('📤 Service Worker: Sent NOTIFICATION_SERVICE_STARTED message to main app');
      } catch (error) {
        console.error('❌ Service Worker: Failed to send NOTIFICATION_SERVICE_STARTED message:', error);
      }
    }
  });

  // Function to schedule next random notification
  const scheduleNextNotification = () => {
      // Check if we've exceeded the duration (1 hour for debugging)
  if (Date.now() >= endTime) {
    console.log('⏰ Service Worker: Duration reached, stopping notification service');
    stopBackgroundNotificationService(userId);
    return;
  }

    // Use the interval from main app if provided, otherwise use random 2-4 minutes
    let nextIntervalMs;

    // Generate random interval range between minMinutesRange-maxMinutesRange seconds
    const randomSeconds = Math.floor(Math.random() * (maxMinutesRange - minMinutesRange + 1)) + minMinutesRange;
    nextIntervalMs = randomSeconds * 1000;
    console.log('🔔 Service Worker: Using random interval:', randomSeconds, 'seconds (', nextIntervalMs, 'ms)');


    // Schedule the notification
    console.log('⏰ Service Worker: Scheduling notification for user:', userId, 'in', (nextIntervalMs / 1000).toFixed(1), 'seconds');
    console.log('⏰ Service Worker: Setting timeout for', nextIntervalMs, 'milliseconds...');

        const timeoutId = setTimeout(() => {
      console.log('⏰ Service Worker: Timeout fired for user:', userId, '- sending notification');
      console.log('⏰ Service Worker: Current time when timeout fired:', new Date().toLocaleString());

      //SEND NOTIFICATION HERE:
      sendBackgroundNotification(userId, true); // true = insert into database for scheduled notifications
      // Schedule the next one recursively
      console.log('🔄 Service Worker: Scheduling next notification for user:', userId);
      try {
        scheduleNextNotification();
        console.log('✅ Service Worker: Next notification scheduled successfully');
      } catch (error) {
        console.error('❌ Service Worker: Failed to schedule next notification:', error);
      }
    }, nextIntervalMs); //setTimeout

    // Store the timeout ID
    notificationIntervals.set(userId, timeoutId);
    console.log('⏰ Service Worker: Timeout stored with ID:', timeoutId, 'for user:', userId);
    console.log('⏰ Service Worker: Current time:', new Date().toLocaleString());
    console.log('⏰ Service Worker: Expected notification at:', new Date(Date.now() + nextIntervalMs).toLocaleString());

    // Notify main app of next notification time
    const nextNotificationTime = Date.now() + nextIntervalMs;
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        // Send to the first client only
        const targetClient = clients[0];
        try {
          targetClient.postMessage({
            type: 'NEXT_NOTIFICATION_TIME',
            userId: userId,
            nextNotificationTime: nextNotificationTime,
            minMinutesRange: minMinutesRange,
            maxMinutesRange: maxMinutesRange,
            durationHours: durationHours
          });
          console.log('📤 Service Worker: Sent NEXT_NOTIFICATION_TIME message to main app:', new Date(nextNotificationTime).toLocaleString());
        } catch (error) {
          console.error('❌ Service Worker: Failed to send NEXT_NOTIFICATION_TIME message:', error);
        }
      }
    });
  }; // Close the scheduleNextNotification function

  // Start the recursive scheduling loop
  console.log('🔄 Service Worker: About to start recursive scheduling loop...');
  try {
    scheduleNextNotification();
    console.log('✅ Service Worker: Recursive scheduling loop started successfully');
  } catch (error) {
    console.error('❌❌❌ Service Worker: Failed to start recursive scheduling loop:', error);
  }
  console.log('✅ Service Worker: Background notification service started with 6-30 second intervals for 1 hour (DEBUG MODE)');
}

// Stop background notification service
function stopBackgroundNotificationService(userId) {
  console.log('🔔 Service Worker: Stopping background notification service for user:', userId);
  console.log('🔔 Service Worker: Current notification intervals before stop:', notificationIntervals.size);
  console.log('🔔 Service Worker: Active intervals before stop:', Array.from(notificationIntervals.entries()));

    // Clear any existing timeout for this user
  if (notificationIntervals.has(userId)) {
    const timeoutId = notificationIntervals.get(userId);
    clearTimeout(timeoutId);
    notificationIntervals.delete(userId);
    console.log('✅ Service Worker: Cleared timeout with ID:', timeoutId, 'for user:', userId);
  } else {
    console.log('⚠️ Service Worker: No notification interval found for user:', userId);
  }

  // Close any active notifications for this user
  self.registration.getNotifications().then(notifications => {
    console.log('🔔 Service Worker: Found', notifications.length, 'active notifications');
    let closedCount = 0;
    notifications.forEach(notification => {
      if (notification.tag && notification.tag.includes(`background-${userId}`)) {
        notification.close();
        closedCount++;
        console.log('✅ Service Worker: Closed notification with tag:', notification.tag);
      }
    });
    console.log('🔔 Service Worker: Closed', closedCount, 'notifications for user:', userId);
  });

  console.log('🔔 Service Worker: Notification intervals after stop:', notificationIntervals.size);
  console.log('✅ Service Worker: Background notification service completely stopped for user:', userId);
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
        // Send notification sent message
        client.postMessage({
          type: 'NOTIFICATION_SENT',
          userId: userId,
          timestamp: Date.now()
        });
        console.log('✅ Service Worker: NOTIFICATION_SENT message sent to client successfully');
      } catch (error) {
        console.error('❌ Service Worker: Failed to send message to client:', error);
      }
    });
  }).catch(error => {
    console.error('❌ Service Worker: Error finding clients:', error);
  });
}

// Send a background notification
async function sendBackgroundNotification(userId, shouldInsertReminder = true) {
  console.log('🔔🔔🔔 AAA: Service Worker: Sending background notification for user:', userId, 'shouldInsertReminder:', shouldInsertReminder);
  try {
    console.log('🔔 Service Worker: Sending background notification for user:', userId, 'shouldInsertReminder:', shouldInsertReminder);

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

    // System notification sound is handled automatically (silent: false)
    console.log('🔊 System notification sound enabled');

    // Notify the main app that a notification was sent
    console.log('📤 Service Worker: About to notify main app of notification sent for user:', userId);
    notifyMainAppOfNotificationSent(userId);

    // Send message to insert reminder in database (only if shouldInsertReminder is true)
    if (shouldInsertReminder) {
      console.log('📤 AAA: Service Worker: About to send INSERT_REMINDER message for user:', self.clients);
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          // Only send to the most recently focused client to prevent duplicate insertions
          // Sort by focus time and only send to the most recent one
          const sortedClients = clients.sort((a, b) => {
            // If focusTime is available, use it; otherwise fall back to URL sorting
            if (a.focusTime && b.focusTime) {
              return b.focusTime - a.focusTime;
            }
            // Fallback: prefer the first client (usually the main tab)
            return 0;
          });

          // Only send to the first (most recently focused) client
          const targetClient = sortedClients[0];
          try {
            targetClient.postMessage({
              type: 'INSERT_REMINDER',
              userId: userId,
              timestamp: Date.now()
            });
            console.log('✅ AAA: Service Worker: INSERT_REMINDER message sent to primary client:', targetClient.url);
          } catch (error) {
            console.error('❌ AAA: Service Worker: Failed to send INSERT_REMINDER message to primary client:', error);
          }
        } else {
          console.error('⚠️ AAA: Service Worker: No clients found for INSERT_REMINDER message');
        }
      }).catch(error => {
        console.error('❌ AAA: Service Worker: Error finding clients for INSERT_REMINDER message:', error);
      });
    } else {
      console.error('📤 AAA: Service Worker: Skipping database insertion for this notification (shouldInsertReminder = false)');
    }

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

// Request main app to play notification sound
function playNotificationSound() {
  console.log('🔊 Service Worker: Requesting main app to play notification sound');

  // Send message to main app to request sound playback
  self.clients.matchAll().then(clients => {
    if (clients.length === 0) {
      console.log('⚠️ Service Worker: No clients found for sound request');
      return;
    }

        // Only send sound requests to Dashboard page (root path)
    const dashboardClients = clients.filter(client =>
      client.url.endsWith('/') || client.url.endsWith('/#/') || client.url.includes('localhost:5174/')
    );

    console.log('🔍 Service Worker: Found clients:', clients.map(c => c.url));
    console.log('🔍 Service Worker: Dashboard clients:', dashboardClients.map(c => c.url));

    if (dashboardClients.length === 0) {
      console.log('ℹ️ Service Worker: No Dashboard clients found, skipping sound request');
      return;
    }

    dashboardClients.forEach(client => {
      try {
        console.log('📤 Service Worker: Sending PLAY_SOUND message to:', client.url);
        client.postMessage({
          type: 'PLAY_SOUND',
          payload: { tone: 600, duration: 0.8 }
        });
        console.log('✅ Service Worker: Sound request sent to Dashboard:', client.url);
      } catch (error) {
        console.error('❌ Service Worker: Failed to send sound request to Dashboard:', error);
      }
    });
  }).catch(error => {
    console.error('❌ Service Worker: Error finding clients for sound request:', error);
  });
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
        // Send notification sent message
        client.postMessage({
          type: 'NOTIFICATION_SENT',
          userId: userId,
          timestamp: Date.now()
        });
        console.log('✅ Service Worker: NOTIFICATION_SENT message sent to client successfully');
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
