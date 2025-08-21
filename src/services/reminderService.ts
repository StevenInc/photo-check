import { supabase } from '../lib/supabase'
import type { Reminder, Photo } from '../lib/supabase'

export class ReminderService {
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
        // Navigate to photo capture page
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
  static async completeReminder(reminderId: string, photoUrl: string): Promise<Photo> {
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
          tag: 'reminder-service-test',
          requireInteraction: true
        })

        // Handle notification click
        notification.onclick = () => {
          window.focus()
          console.log('🔔 ReminderService test notification clicked!')
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
}
