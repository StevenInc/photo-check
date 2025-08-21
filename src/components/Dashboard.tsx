import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ReminderService } from '../services/reminderService'
import type { Reminder, Photo } from '../lib/supabase'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([])
  const [photoHistory, setPhotoHistory] = useState<Photo[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!user) return

    loadDashboardData()
    checkNotificationPermission()
  }, [user])

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

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={scheduleRandomReminder}
            disabled={isScheduling || notificationPermission !== 'granted'}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg text-lg transition-colors flex items-center justify-center"
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
            onClick={() => navigate('/history')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            📚 View Photo History
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
