import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NotificationResponse: React.FC = () => {
  const { reminderId } = useParams<{ reminderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!reminderId || !user) {
      navigate('/')
      return
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [reminderId, user, navigate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTakePhoto = () => {
    navigate(`/capture/${reminderId}`)
  }

  const handleSkip = () => {
    navigate('/')
  }

  if (!reminderId || !user) {
    return <div>Loading...</div>
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">⏰</div>
          <h1 className="text-3xl font-bold text-red-900 mb-4">Time's Up!</h1>
          <p className="text-red-700 mb-8 text-lg">
            The 5-minute window has expired. Don't worry, you'll get another chance soon!
          </p>
          <button
            onClick={handleSkip}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        {/* Urgent header */}
        <div className="mb-8">
          <div className="text-6xl mb-4 animate-pulse">📸</div>
          <h1 className="text-4xl font-bold mb-2">Photo Time!</h1>
          <p className="text-xl text-blue-200">
            You have a photo challenge waiting
          </p>
        </div>

        {/* Large countdown timer */}
        <div className="mb-8">
          <div className="text-8xl font-mono font-bold text-yellow-300 mb-2 animate-pulse">
            {formatTime(timeLeft)}
          </div>
          <p className="text-lg text-blue-200">
            Time remaining to take your photo
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-yellow-400 to-red-500 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${(timeLeft / 300) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-300 mt-2">
            {Math.round((timeLeft / 300) * 100)}% time remaining
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-4">
          <button
            onClick={handleTakePhoto}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors transform hover:scale-105 shadow-lg"
          >
            📸 Take Photo Now
          </button>

          <button
            onClick={handleSkip}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
          >
            Skip This Time
          </button>
        </div>

        {/* Motivational text */}
        <div className="mt-8 p-4 bg-blue-800/30 rounded-lg border border-blue-700">
          <p className="text-sm text-blue-200">
            💡 <strong>Quick tip:</strong> Capture whatever you're doing right now -
            these spontaneous moments make the best memories!
          </p>
        </div>

        {/* Warning for low time */}
        {timeLeft <= 60 && (
          <div className="mt-4 p-3 bg-red-800/50 rounded-lg border border-red-600 animate-pulse">
            <p className="text-sm text-red-200">
              ⚠️ <strong>Hurry!</strong> Less than 1 minute remaining!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationResponse
