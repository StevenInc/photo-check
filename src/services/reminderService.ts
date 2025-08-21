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
        body: 'You have 5 minutes to take and upload a photo!',
        icon: '/camera-icon.png',
        badge: '/camera-icon.png',
        tag: reminder.id,
        requireInteraction: true,
        actions: [
          {
            action: 'take-photo',
            title: 'Take Photo'
          }
        ]
      })

      // Handle notification click
      notification.onclick = () => {
        window.focus()
        // Navigate to photo capture page
        window.location.href = `/capture/${reminder.id}`
      }

      // Handle action clicks
      notification.onactionclick = (event) => {
        if (event.action === 'take-photo') {
          window.focus()
          window.location.href = `/capture/${reminder.id}`
        }
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
}
