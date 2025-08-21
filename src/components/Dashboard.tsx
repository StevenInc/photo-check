import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ReminderService } from '../services/reminderService'
import { StorageTest } from '../utils/storageTest'
import type { Reminder, Photo } from '../lib/supabase'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([])
  const [photoHistory, setPhotoHistory] = useState<Photo[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [notificationServiceRunning, setNotificationServiceRunning] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [nextNotificationTime, setNextNotificationTime] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return

    loadDashboardData()
    checkNotificationPermission()
  }, [user])

  // Timer for next notification countdown
  useEffect(() => {
    if (!notificationServiceRunning) {
      setNextNotificationTime(null)
      return
    }

    const timer = setInterval(() => {
      const timeUntil = ReminderService.getTimeUntilNextNotification()
      if (timeUntil) {
        setNextNotificationTime(timeUntil)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [notificationServiceRunning])

  const loadDashboardData = async () => {
    try {
      const [reminders, photos] = await Promise.all([
        ReminderService.getActiveReminders(user!.id),
        ReminderService.getPhotoHistory(user!.id)
      ])

      setActiveReminders(reminders)
      setPhotoHistory(photos)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }

  const requestNotificationPermission = async () => {
    const granted = await ReminderService.requestNotificationPermission()
    if (granted) {
      setNotificationPermission('granted')
    }
  }

  const testNotification = () => {
    if (Notification.permission === 'granted') {
      // Create a test notification (without actions - they're only supported in Service Worker)
      const notification = new Notification('🧪 Test Notification', {
        body: 'This is a test notification from Photo Check! Click to test the notification system.',
        icon: '/camera-icon.svg',
        badge: '/camera-icon.svg',
        tag: 'test-notification',
        requireInteraction: true
      })

      // Handle notification click
      notification.onclick = () => {
        window.focus()
        console.log('🔔 Test notification clicked!')
        alert('Test notification clicked! Notification system is working.')
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close()
      }, 10000)

      console.log('🔔 Test notification sent successfully!')
    } else {
      alert('Please enable notifications first to test the notification system.')
    }
  }

  const startNotificationService = () => {
    if (!user) return
    ReminderService.startNotificationService(user.id)
    setNotificationServiceRunning(true)
  }

  const stopNotificationService = () => {
    ReminderService.stopNotificationService()
    setNotificationServiceRunning(false)
  }

  const scheduleRandomReminder = async () => {
    if (!user) return

    setIsScheduling(true)
    try {
      await ReminderService.scheduleRandomReminder(user.id)
      await loadDashboardData()

      // Show success message
      alert('Random photo reminder scheduled! You\'ll get a notification when it\'s time.')
    } catch (error) {
      console.error('Failed to schedule reminder:', error)
      alert('Failed to schedule reminder. Please try again.')
    } finally {
      setIsScheduling(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📸 Photo Check</h1>
            <p className="text-gray-600">Welcome back, {user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Notification Permission */}
      {notificationPermission !== 'granted' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-yellow-800">
              <p className="font-medium">Enable notifications to get photo reminders</p>
              <p className="text-sm text-yellow-700 mt-1">
                You'll need to allow notifications to receive photo reminders
              </p>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="ml-4 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Enable Notifications
            </button>
          </div>
        </div>
      )}

            {/* Notification Service Status */}
      {notificationPermission === 'granted' && (
        <div className={`border rounded-lg p-4 mb-6 ${
          notificationServiceRunning
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={notificationServiceRunning ? 'text-green-800' : 'text-gray-800'}>
              <p className="font-medium">
                {notificationServiceRunning ? '🔔 Notification Service Running' : '⏸️ Notification Service Stopped'}
              </p>
              <p className={`text-sm mt-1 ${
                notificationServiceRunning ? 'text-green-700' : 'text-gray-700'
              }`}>
                {notificationServiceRunning
                  ? `Next notification in ${nextNotificationTime ? Math.ceil(nextNotificationTime / 1000) : 180} seconds`
                  : 'Click "Start Notification Service" to begin receiving automatic reminders'
                }
              </p>
              {notificationServiceRunning && (
                <p className="text-xs text-green-600 mt-1">
                  Service will continue running in the background
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={scheduleRandomReminder}
            disabled={isScheduling || notificationPermission !== 'granted'}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
          >
            {isScheduling ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Scheduling...
              </>
            ) : (
              <>
                🎲 Schedule Random Reminder
              </>
            )}
          </button>

          <button
            onClick={startNotificationService}
            disabled={notificationPermission !== 'granted'}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            🚀 Start Notification Service (Every 3 min)
          </button>

          <button
            onClick={stopNotificationService}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            ⏹️ Stop Notification Service
          </button>

          <button
            onClick={() => {
              if (user && notificationServiceRunning) {
                console.log('🧪 Manually triggering notification...')
                ReminderService.sendNotification(user.id)
              }
            }}
            disabled={!notificationServiceRunning || !user}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            🧪 Trigger Notification Now
          </button>







          <button
            onClick={() => ReminderService.testNotification()}
            disabled={notificationPermission !== 'granted'}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            🧪 Test Service Notification (10s + Sound)
          </button>

          <button
            onClick={() => navigate('/capture/test-reminder-id')}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            📱 Test Photo Capture
          </button>
        </div>
      </div>

      {/* Active Reminders */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Reminders</h2>
        {activeReminders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No active reminders</p>
        ) : (
          <div className="space-y-3">
            {activeReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      Scheduled for {formatDate(reminder.scheduled_at)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Expires at {formatDate(reminder.expires_at)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    reminder.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {reminder.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Photos */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Photos</h2>
        {photoHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No photos uploaded yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {photoHistory.slice(0, 6).map((photo) => (
              <div key={photo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={photo.photo_url}
                  alt="Uploaded photo"
                  className="w-full h-32 object-cover"
                />
                <div className="p-3">
                  <p className="text-sm text-gray-600">
                    Uploaded {formatDate(photo.uploaded_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {photoHistory.length > 6 && (
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/history')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View All Photos →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
