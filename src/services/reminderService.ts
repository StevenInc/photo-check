import { supabase } from '../lib/supabase'
import type { Reminder, Photo } from '../lib/supabase'

export class ReminderService {
  private static isRunning = false
  private static currentUserId: string | null = null
  private static lastNotificationTime: number = 0
  private static nextNotificationTime: number = 0
  private static serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private static audioContext: AudioContext | null = null
  private static messageListenerSetUp = false



    // Initialize service worker registration
  private static async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.serviceWorkerRegistration && 'serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', this.serviceWorkerRegistration);

        // Check if there's a waiting service worker and update it
        if (this.serviceWorkerRegistration.waiting) {
          console.log('🔄 Service Worker: Found waiting service worker, updating...');
          this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Set up message listener for service worker communication (only once during registration)
        console.log('🔔 Setting up message listener during initial service worker registration...');
        this.setupServiceWorkerMessageListener();

        return this.serviceWorkerRegistration;
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        return null;
      }
    }
    return this.serviceWorkerRegistration;
  }

        // Set up message listener for service worker
  private static setupServiceWorkerMessageListener(): void {
    // Only set up once to avoid interference
    if (this.messageListenerSetUp) {
      console.log('🔔 Main app: Message listener already set up, skipping...');
      return;
    }

    if ('serviceWorker' in navigator) {
      console.log('🔔 Main app: Setting up message listener for Service Worker');

      // Remove any existing listeners first
      navigator.serviceWorker.removeEventListener('message', this.handleServiceWorkerMessage);

      // Add the message listener
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);

      // Mark as set up
      this.messageListenerSetUp = true;

      console.log('✅ Main app: Message listener set up successfully');
    } else {
      console.log('⚠️ Main app: Service Worker not supported');
    }
  }

      // Handle service worker messages
  private static handleServiceWorkerMessage = (event: MessageEvent): void => {
    console.log('🔔 Main app received message from Service Worker:', event.data);

    if (event.data.type === 'NOTIFICATION_SENT') {
      // Update the last notification time when service worker sends a notification
      this.lastNotificationTime = event.data.timestamp;
      console.log('✅ Updated lastNotificationTime to:', new Date(this.lastNotificationTime));
      console.log('✅ New countdown should be:', this.getTimeUntilNextNotification(), 'ms');

      // Play fallback notification sound in main app
      //this.playFallbackNotificationSound();
      this.playWebAudioBeep(); // Uses default tone (600Hz) and duration (0.8s)
    } else if (event.data.type === 'PLAY_SOUND') {
      // Handle sound playback request from service worker
      console.log('🔊 Main app: Received PLAY_SOUND request from Service Worker');
      console.log('🔊 Main app: Sound payload:', event.data.payload);

      // Play the requested sound with custom parameters
      const { tone = 600, duration = 0.8 } = event.data.payload || {};
      this.playWebAudioBeep(tone, duration);
    } else if (event.data.type === 'COMMUNICATION_TEST_RESPONSE') {
      // Handle communication test response
      console.log('✅ Main app: Received communication test response');
    } else if (event.data.type === 'TEST_MESSAGE') {
      // Handle test message from service worker
      console.log('🧪 Main app: Received TEST_MESSAGE from Service Worker');
      console.log('🧪 Test message payload:', event.data.payload);

      // Send a response back to confirm communication is working
      if ('serviceWorker' in navigator && this.serviceWorkerRegistration?.active) {
        this.serviceWorkerRegistration.active.postMessage({
          type: 'TEST_MESSAGE_RESPONSE',
          payload: { received: true, timestamp: Date.now() }
        });
        console.log('✅ Main app: Sent TEST_MESSAGE_RESPONSE back to Service Worker');
      }
    } else if (event.data.type === 'INSERT_REMINDER') {
      // Handle insert reminder message from service worker
      console.log('📝 AAA: Main app: Received INSERT_REMINDER message from Service Worker');
      console.log('📝 Insert reminder payload:', event.data);

      // Insert reminder into database
      this.insertReminderFromNotification(event.data.userId, event.data.timestamp);


    } else if (event.data.type === 'NEXT_NOTIFICATION_TIME') {
      // Handle next notification time update from service worker
      console.log('⏰ Main app: Received NEXT_NOTIFICATION_TIME message from Service Worker');
      console.log('⏰ Next notification scheduled for:', new Date(event.data.nextNotificationTime).toLocaleString());
      this.nextNotificationTime = event.data.nextNotificationTime;
    } else if (event.data.type === 'NOTIFICATION_SERVICE_STARTED') {
      // Handle notification service started message from service worker
      console.log('🚀 Main app: Received NOTIFICATION_SERVICE_STARTED message from Service Worker');
      console.log('🚀 Service message:', event.data.message);
    } else {
      console.log('⚠️ Main app: Received unknown message type:', event.data.type);
    }
  }



    // Web Audio API fallback
  private static playWebAudioBeep(tone: number = 600, duration: number = 0.8): void {
    console.log('🔊 playWebAudioBeep: Trying Web Audio API beep...');
    console.log('🔊 playWebAudioBeep: Tone:', tone, 'Hz, Duration:', duration, 's');

    try {
      // Create a new audio context each time to avoid state issues
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Use the provided tone and duration, or defaults
      oscillator.frequency.setValueAtTime(tone, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      console.log('✅ playWebAudioBeep: Web Audio API beep played successfully');

    } catch (error) {
      console.log('❌ playWebAudioBeep: All audio methods failed:', error);
    }
  }

    // Start the notification service to run every 3 minutes using Service Worker
  static async startNotificationService(userId: string): Promise<void> {
    console.log('🔔 Starting notification service - will run every 3 minutes')

    // If already running, stop it first and then restart
    if (this.isRunning) {
      console.log('🔄 Notification service is already running, stopping first...')
      console.log('🔍 This is likely what is stopping your recurring notifications!');
      await this.stopNotificationService();
    }

    // Get service worker registration
    const registration = await this.getServiceWorkerRegistration();
    if (!registration) {
      console.error('❌ Cannot start notification service: Service Worker not available');
      return;
    }

    // Message listener is already set up during service worker registration
    console.log('🔔 Message listener already set up, skipping redundant setup...');

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    this.isRunning = true
    this.currentUserId = userId
    this.lastNotificationTime = Date.now()

          // Send message to service worker to start background notifications
      if (registration.active) {
        registration.active.postMessage({
          type: 'START_NOTIFICATION_SERVICE',
          userId: userId,
          intervalMinutes: 0, // 0 means use random 6-30 second intervals (DEBUG MODE)
          durationHours: 1 // Run for 1 hour for debugging
        });
        console.log('✅ Message sent to Service Worker to start background notifications for 1 hour with 6-30 second intervals (DEBUG MODE)');
      }

        // Log the service setup
    console.log('✅ Notification service started using Service Worker')
    console.log('🔍 Will run for 4 hours with 3-minute intervals')
  }

  // Stop the notification service
  static async stopNotificationService(): Promise<void> {
    console.log('🔔 stopNotificationService called');
    console.log('🔔 Current isRunning state:', this.isRunning);
    console.log('🔔 Current user ID:', this.currentUserId);

    if (!this.isRunning) {
      console.log('🔔 Notification service is not running')
      return
    }

    console.log('🔔 Stopping notification service for user:', this.currentUserId);

    // Reset next notification time
    this.nextNotificationTime = 0;

    // Send message to service worker to stop background notifications
    if (this.serviceWorkerRegistration?.active) {
      console.log('🔔 Service worker is active, sending stop message...');
      this.serviceWorkerRegistration.active.postMessage({
        type: 'STOP_NOTIFICATION_SERVICE',
        userId: this.currentUserId
      });
      console.log('✅ Message sent to Service Worker to stop background notifications');

      // Wait a bit for the service worker to process the message
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      console.log('⚠️ Service Worker not available for stopping notifications');
    }

    // Force stop the local service state
    this.isRunning = false
    this.currentUserId = null
    this.lastNotificationTime = 0
    console.log('🔔 Notification service stopped locally')
  }

  // Check if the notification service is running
  static isNotificationServiceRunning(): boolean {
    return this.isRunning
  }

  // Get the current user ID for the service
  static getCurrentServiceUserId(): string | null {
    return this.currentUserId
  }

      // Get time until next notification
  static getTimeUntilNextNotification(): number | null {
    // If we have the actual next notification time from the service worker, use that
    if (this.nextNotificationTime > 0) {
      const timeUntil = this.nextNotificationTime - Date.now();
      // If the time has passed, return 0 (notification should appear soon)
      if (timeUntil <= 0) {
        return 0;
      }
      return timeUntil;
    }

    // Fallback: if no next notification time available, estimate based on last notification
    if (this.lastNotificationTime === 0) {
      return 45 * 1000; // 45 seconds (average of 30-60 second range)
    }

    // Calculate time since last notification and estimate next one
    const timeSinceLast = Date.now() - this.lastNotificationTime;
    const averageInterval = 45 * 1000; // 45 seconds average (30-60 second range)
    const timeUntilNext = averageInterval - timeSinceLast;

    // If we're past due, return 0 (notification should appear soon)
    if (timeUntilNext <= 0) {
      return 0;
    }

    return timeUntilNext;
  }

  // Check service worker status
  static async checkServiceWorkerStatus(): Promise<any> {
    const registration = await this.getServiceWorkerRegistration();
    if (!registration?.active) {
      return { error: 'Service Worker not active' };
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      registration.active.postMessage({
        type: 'GET_SERVICE_STATUS'
      }, [messageChannel.port2]);
    });
  }

      // Test service worker communication
  static async testServiceWorkerCommunication(): Promise<boolean> {
    const registration = await this.getServiceWorkerRegistration();
    if (!registration?.active) {
      console.error('❌ Service Worker not active for communication test');
      return false;
    }

    console.log('🧪 Testing service worker communication...');

    return new Promise((resolve) => {
      let resolved = false;

      // Set up a one-time listener for the test response
      const testMessageHandler = (event: MessageEvent) => {
        if (event.data.type === 'COMMUNICATION_TEST_RESPONSE' && !resolved) {
          resolved = true;
          navigator.serviceWorker.removeEventListener('message', testMessageHandler);
          console.log('✅ Service Worker communication test successful');
          resolve(true);
        }
      };

      navigator.serviceWorker.addEventListener('message', testMessageHandler);

      // Send test message to service worker
      registration.active.postMessage({
        type: 'COMMUNICATION_TEST'
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          navigator.serviceWorker.removeEventListener('message', testMessageHandler);
          console.error('❌ Service Worker communication test timed out');
          resolve(false);
        }
      }, 5000);
    });
  }

  // Test notification sending from service worker
  static async testNotificationSending(): Promise<boolean> {
    const registration = await this.getServiceWorkerRegistration();
    if (!registration?.active) {
      console.error('❌ Service Worker not active for notification test');
      return false;
    }

    console.log('🧪 Testing notification sending from service worker...');

    return new Promise((resolve) => {
      // Set up a one-time listener for the notification sent message
      const notificationMessageHandler = (event: MessageEvent) => {
        if (event.data.type === 'NOTIFICATION_SENT') {
          navigator.serviceWorker.removeEventListener('message', notificationMessageHandler);
          console.log('✅ Service Worker notification test successful');
          console.log('✅ Received NOTIFICATION_SENT message with timestamp:', event.data.timestamp);
          resolve(true);
        }
      };

      navigator.serviceWorker.addEventListener('message', notificationMessageHandler);

      // Send message to service worker to send a notification
      registration.active.postMessage({
        type: 'SEND_NOTIFICATION_NOW',
        userId: 'test-user'
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', notificationMessageHandler);
        console.error('❌ Service Worker notification test timed out');
        resolve(false);
      }, 10000);
    });
  }

      // Send a notification immediately using the same logic as testNotification
  static async sendNotification(userId: string): Promise<void> {
    //add audio notification
    this.playWebAudioBeep();

    // Try to use service worker first, fallback to direct notification
    const registration = await this.getServiceWorkerRegistration();
    if (registration?.active) {
      console.log('✅ Service Worker available, sending SEND_NOTIFICATION_NOW message');
      registration.active.postMessage({
        type: 'SEND_NOTIFICATION_NOW',
        userId: userId
      });
      console.log('✅ Message sent to Service Worker to send notification now');
      // IMPORTANT: Return here to prevent duplicate reminder insertion
      // The service worker will handle the notification and send INSERT_REMINDER message
      return;
    }

    // Fallback to direct notification if service worker not available
    console.log('⚠️ Service Worker not available, using fallback notification');
    try {
      console.log('🔔 Sending automated notification for user:', userId)

      if (Notification.permission === 'granted') {
        // First, create a real reminder in the database
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes from now

        const { data: reminder, error: reminderError } = await supabase
          .from('reminders')
          .insert({
            user_id: userId,
            scheduled_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            status: 'active'
          })
          .select()
          .single()

        if (reminderError) {
          console.error('❌ Failed to create reminder for automated notification:', reminderError)
          return
        }

        console.log('✅ Created reminder for automated notification:', reminder.id)

        // Play notification sound using Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()

          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)

          oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // 800Hz tone
          oscillator.type = 'sine'

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)

          console.log('🔊 Automated notification sound played successfully!')
        } catch (e) {
          console.log('🔊 Audio creation failed:', e)
          // Fallback: try to play a simple beep using HTML5 audio
          try {
            const audio = new Audio()
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHOq+8+OWT'
            audio.volume = 0.5
            audio.play().catch(e => console.log('🔊 Fallback audio failed:', e))
          } catch (fallbackError) {
            console.log('🔊 All audio methods failed:', fallbackError)
          }
        }

        // Create the notification with the real reminder ID
        const notification = new Notification('📸 Photo Check Reminder!', {
          body: 'Time to take a photo! Click to start.',
          icon: '/camera-icon.svg',
          badge: '/camera-icon.svg',
          tag: reminder.id, // Use the real reminder ID
          requireInteraction: true
        })

        // Handle notification click
        notification.onclick = () => {
          window.focus()
          console.log('🔔 Automated photo reminder notification clicked!')
          // Navigate to photo capture page with real reminder ID
          window.location.href = `/capture/${reminder.id}`
          notification.close()
        }

        // Auto-close after 8 seconds (same as testNotification)
        setTimeout(() => {
          notification.close()
        }, 8000)

        console.log('✅ Automated notification sent successfully with reminder ID:', reminder.id)
      } else {
        console.log('⚠️ Notification permission not granted')
      }
    } catch (error) {
      console.error('❌ Failed to send automated notification:', error)
    }
  }

  // Request notification permission
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // Schedule a random reminder
  static async scheduleRandomReminder(userId: string): Promise<Reminder> {
    // Generate random time within next 24 hours
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const randomTime = new Date(now.getTime() + Math.random() * (tomorrow.getTime() - now.getTime()))

    // Set expiration to 5 minutes after scheduled time
    const expiresAt = new Date(randomTime.getTime() + 5 * 60 * 1000)

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        scheduled_at: randomTime.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    // Schedule the actual notification
    this.scheduleNotification(data, randomTime)

    return data
  }

  // Schedule a notification for a specific time
  private static scheduleNotification(reminder: Reminder, scheduledTime: Date): void {
    const now = new Date()
    const delay = scheduledTime.getTime() - now.getTime()

    if (delay <= 0) {
      // If time has passed, show notification immediately
      this.showNotification(reminder)
      return
    }

    setTimeout(() => {
      this.showNotification(reminder)
    }, delay)
  }

  // Show the photo reminder notification
  private static showNotification(reminder: Reminder): void {
    if (Notification.permission === 'granted') {
      const notification = new Notification('📸 Photo Time!', {
        body: 'You have 5 minutes to take and upload a photo! Click to start.',
        icon: '/camera-icon.png',
        badge: '/camera-icon.png',
        tag: reminder.id,
        requireInteraction: true
      })

              // Handle notification click
        notification.onclick = () => {
          window.focus()
          // Navigate directly to photo capture page
          window.location.href = `/capture/${reminder.id}`
          notification.close()
        }

      // Auto-close after 5 minutes
      setTimeout(() => {
        notification.close()
        this.expireReminder(reminder.id)
      }, 5 * 60 * 1000)
    }
  }

  // Mark reminder as expired
  static async expireReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'expired' })
      .eq('id', reminderId)

    if (error) throw error
  }

  // Mark reminder as active when user starts taking photo
  static async activateReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'active' })
      .eq('id', reminderId)

    if (error) throw error
  }

  // Complete reminder when photo is uploaded
  static async completeReminder(reminderId: string, photoUrl: string, userId: string): Promise<Photo> {
    // First, complete the reminder
    const { error: reminderError } = await supabase
      .from('reminders')
      .update({ status: 'completed' })
      .eq('id', reminderId)

    if (reminderError) throw reminderError

    // Then create the photo record
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .insert({
        user_id: userId,           // ✅ Add the missing user_id
        reminder_id: reminderId,
        photo_url: photoUrl,
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single()

    if (photoError) throw photoError

    return photo
  }

  // Get user's active reminders
  static async getActiveReminders(userId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('scheduled_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Get user's photo history
  static async getPhotoHistory(userId: string): Promise<Photo[]> {
    const { data, error } = await supabase
      .from('photos')
      .select(`
        *,
        reminders (
          scheduled_at,
          status
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Reset message listener (useful for debugging or service worker updates)
  static resetMessageListener(): void {
    if (this.messageListenerSetUp) {
      console.log('🔄 Resetting message listener...');
      navigator.serviceWorker.removeEventListener('message', this.handleServiceWorkerMessage);
      this.messageListenerSetUp = false;
      console.log('✅ Message listener reset successfully');
    }
  }

  // Check if message listener is set up
  static isMessageListenerSetUp(): boolean {
    return this.messageListenerSetUp;
  }

  // Manually set up message listener (useful for debugging)
  static forceSetupMessageListener(): void {
    console.log('🔔 Force setting up message listener...');
    this.messageListenerSetUp = false; // Reset flag to allow setup
    this.setupServiceWorkerMessageListener();
  }

  // Ensure message listener is active (without resetting if already set up)
  static ensureMessageListenerActive(): void {
    if (!this.messageListenerSetUp) {
      console.log('🔔 Message listener not set up, setting it up now...');
      this.setupServiceWorkerMessageListener();
    } else {
      console.log('🔔 Message listener already active, no setup needed');
    }
  }

  // Test if message listener is working by sending a test message
  static testMessageListener(): void {
    console.log('🧪 Testing message listener...');
    console.log('🧪 Message listener status:', this.messageListenerSetUp);

    if ('serviceWorker' in navigator && this.serviceWorkerRegistration?.active) {
      console.log('🧪 Sending test message to service worker...');
      this.serviceWorkerRegistration.active.postMessage({
        type: 'TEST_MESSAGE',
        payload: { test: true, timestamp: Date.now() }
      });
      console.log('🧪 Test message sent, check console for response');
    } else {
      console.log('❌ Cannot test: service worker not available');
    }
  }

  // Test notification method with delay and sound
  static testNotification(): void {
    if (Notification.permission === 'granted') {
      console.log('🔔 Test notification scheduled! Will appear in 10 seconds...')

      // Show countdown in console
      let countdown = 10
      const countdownInterval = setInterval(() => {
        countdown--
        if (countdown > 0) {
          console.log(`⏰ Notification in ${countdown} seconds...`)
        }
      }, 1000)

      // Wait 10 seconds, then show notification and play sound
      setTimeout(() => {
        clearInterval(countdownInterval)

        // Play notification sound using Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()

          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)

          oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // 800Hz tone
          oscillator.type = 'sine'

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)

          console.log('🔊 Notification sound played successfully!')
        } catch (e) {
          console.log('🔊 Audio creation failed:', e)
          // Fallback: try to play a simple beep using HTML5 audio
          try {
            const audio = new Audio()
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
            audio.volume = 0.5
            audio.play().catch(e => console.log('🔊 Fallback audio failed:', e))
          } catch (fallbackError) {
            console.log('🔊 All audio methods failed:', fallbackError)
          }
        }

        // Create the notification
        const notification = new Notification('🧪 ReminderService Test', {
          body: 'This notification was sent from the ReminderService class after a 10-second delay! All notification systems are working correctly!',
          icon: '/camera-icon.svg',
          badge: '/camera-icon.svg',
          tag: 'test-reminder-id',
          requireInteraction: true
        })

        // Handle notification click
        notification.onclick = () => {
          window.focus()
          console.log('🔔 ReminderService test notification clicked!')
          // Navigate directly to photo capture page
          window.location.href = '/capture/test-reminder-id'
          notification.close()
        }

        // Auto-close after 8 seconds
        setTimeout(() => {
          notification.close()
        }, 8000)

        console.log('🔔 ReminderService test notification sent successfully!')
      }, 10000)

    } else {
      console.warn('🔔 Cannot send test notification: notifications not permitted')
    }
  }

                // Insert a reminder into the database when a notification is sent
  private static async insertReminderFromNotification(userId: string, timestamp: number): Promise<void> {

    try {
      console.log('📝 Inserting reminder into database for user:', userId, 'at timestamp:', timestamp);
      console.log('📝 User ID type:', typeof userId, 'Value:', userId);
      console.log('📝 Timestamp type:', typeof timestamp, 'Value:', timestamp);


      // Calculate scheduled_at and expires_at times
      const scheduledAt = new Date(timestamp);
      const expiresAt = new Date(timestamp + (5 * 60 * 1000)); // 5 minutes from notification time

      console.log('📝 Scheduled at:', scheduledAt.toISOString());
      console.log('📝 Expires at:', expiresAt.toISOString());

      // Log the data being inserted
      const insertData = {
        user_id: userId,
        scheduled_at: scheduledAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'active'
      };
      console.log('📝 Data to insert:', insertData);

      const { data, error } = await supabase
        .from('reminders')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌❌❌ Failed to insert reminder into database:', error);
        console.error('❌❌❌ Error details:', JSON.stringify(error, null, 2));
        return;
      }

      console.log('✅ AAA: Successfully inserted reminder into database:', data);

    } catch (error) {
      console.error('❌ Error inserting reminder into database:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }

  // Test method for database insertion (public for testing)
  static async testDatabaseInsertion(userId: string, timestamp: number): Promise<void> {
    console.log('🧪 Testing database insertion with user ID:', userId, 'and timestamp:', timestamp);
    await this.insertReminderFromNotification(userId, timestamp);
  }

  // Clean up old expired reminders (public for maintenance)
  static async cleanupExpiredReminders(): Promise<void> {
    try {
      console.log('🧹 Cleaning up expired reminders...');

      const { data, error } = await supabase
        .from('reminders')
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('❌ Failed to cleanup expired reminders:', error);
        return;
      }

      console.log('✅ Successfully cleaned up expired reminders:', data);

    } catch (error) {
      console.error('❌ Error cleaning up expired reminders:', error);
    }
  }

    // Get next notification time for debugging
  static getNextNotificationTime(): number {
    return this.nextNotificationTime;
  }
}
