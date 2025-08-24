import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReminderService } from '../services/reminderService'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PhotoCapture: React.FC = () => {
  const { reminderId } = useParams<{ reminderId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureCountdown, setCaptureCountdown] = useState(0) // 3-second countdown
  const [isLoadingTimer, setIsLoadingTimer] = useState(true)
  const [isExpired, setIsExpired] = useState(false)

  // Function to get the latest reminder and calculate time remaining
  const getLatestReminderAndSetTimer = async () => {
    if (!user) return

    try {
      setIsLoadingTimer(true)
      console.log('🔄 Starting to fetch latest reminder...')

      // Check if Supabase is available
      if (!supabase) {
        console.error('❌ Supabase client not available')
        setTimeLeft(300)
        setIsLoadingTimer(false)
        return
      }

      // Query the reminders table for the latest entry for this user
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )

      const queryPromise = supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const { data: reminders, error } = await Promise.race([queryPromise, timeoutPromise])

      console.log('📊 Supabase response:', { data: reminders, error })

      if (error) {
        console.error('Error fetching latest reminder:', error)
        // Fallback to default 5 minutes if no reminder found
        setTimeLeft(300)
        setIsLoadingTimer(false)
        return
      }

      if (reminders) {
        console.log('📅 Latest reminder found:', reminders)

        // Calculate time remaining based on expires_at
        const now = new Date()
        const expiresAt = new Date(reminders.expires_at)
        const timeRemainingMs = expiresAt.getTime() - now.getTime()

        if (timeRemainingMs > 0) {
          const timeRemainingSeconds = Math.floor(timeRemainingMs / 1000)
          console.log(`⏰ Time remaining: ${timeRemainingSeconds} seconds`)

          // Check if time is greater than 5 minutes (300 seconds)
          if (timeRemainingSeconds > 300) {
            console.log('⏰ Time is greater than 5 minutes, showing expired message')
            setTimeLeft(0)
            setError('⏰ This reminder has expired. The 5-minute window has passed.')
            setIsExpired(true)
          } else {
            setTimeLeft(timeRemainingSeconds)
            setIsExpired(false)
          }
        } else {
          console.log('⏰ Reminder has expired, setting timer to 0')
          setTimeLeft(0)
          setError('⏰ This reminder has expired. The 5-minute window has passed.')
          setIsExpired(true)
        }
      } else {
        console.log('📅 No reminders found, using default 5 minutes')
        setTimeLeft(300)
      }
    } catch (err) {
      console.error('Error in getLatestReminderAndSetTimer:', err)
      // Fallback to default 5 minutes
      setTimeLeft(300)
    } finally {
      console.log('✅ Timer setup complete, setting isLoadingTimer to false')
      setIsLoadingTimer(false)
    }
  }

  // Function to refresh the timer (useful for debugging or manual refresh)
  const refreshTimer = async () => {
    console.log('🔄 Refreshing timer...')
    await getLatestReminderAndSetTimer()
  }

  // Function to update reminder statuses after photo upload
  const updateReminderStatuses = async (userId: string) => {
    try {
      console.log('🔄 Updating reminder statuses for user:', userId)

      // Get all active reminders for the user, ordered by creation date (newest first)
      const { data: activeReminders, error: fetchError } = await supabase
        .from('reminders')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('❌ Error fetching active reminders:', fetchError)
        return
      }

      if (!activeReminders || activeReminders.length === 0) {
        console.log('📝 No active reminders found to update')
        return
      }

      console.log(`📝 Found ${activeReminders.length} active reminders`)

      // Mark the most recent reminder as completed
      const mostRecentReminder = activeReminders[0]
      const { error: completeError } = await supabase
        .from('reminders')
        .update({ status: 'completed' })
        .eq('id', mostRecentReminder.id)

      if (completeError) {
        console.error('❌ Error completing most recent reminder:', completeError)
      } else {
        console.log('✅ Marked most recent reminder as completed:', mostRecentReminder.id)
      }

      // Mark all other active reminders as expired
      if (activeReminders.length > 1) {
        const otherReminderIds = activeReminders.slice(1).map(r => r.id)
        const { error: expireError } = await supabase
          .from('reminders')
          .update({ status: 'expired' })
          .in('id', otherReminderIds)

        if (expireError) {
          console.error('❌ Error expiring other reminders:', expireError)
        } else {
          console.log(`✅ Marked ${otherReminderIds.length} other reminders as expired`)
        }
      }

      console.log('✅ Reminder status updates completed successfully')
    } catch (error) {
      console.error('❌ Error updating reminder statuses:', error)
    }
  }

  // Define handleTimeExpired before using it in useEffect
  const handleTimeExpired = useCallback(() => {
    if (reminderId && !reminderId.startsWith('test-')) {
      ReminderService.expireReminder(reminderId)
    }

    // Show warning message instead of immediately navigating away
    setError('⏰ Time has expired! Please take your photo quickly or you will be redirected.')

    // Give user 10 seconds to take photo before redirecting
    setTimeout(() => {
      navigate('/expired')
    }, 10000)
  }, [reminderId, navigate])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    // Get the latest reminder and set the timer
    getLatestReminderAndSetTimer()

    // Handle different reminder ID scenarios
    if (reminderId) {
      // Activate the reminder (skip for test reminder IDs)
      if (!reminderId.startsWith('test-')) {
        ReminderService.activateReminder(reminderId)
      }
    } else {
      // No reminder ID provided (background notification) - set a default time
      console.log('📸 No reminder ID provided, using default capture mode for background notification');
    }

    // Start camera
    startCamera()

    // Handle page visibility changes (when user navigates away and comes back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Page became visible, restarting camera...')
        // Small delay to ensure the page is fully loaded
        setTimeout(() => startCamera(), 100)
      } else {
        console.log('📱 Page became hidden, stopping camera...')
        stopCamera()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopCamera()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reminderId, user, navigate])

  // Separate useEffect for the countdown timer
  useEffect(() => {
    if (isLoadingTimer) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isLoadingTimer, handleTimeExpired])

  const startCamera = async () => {
    try {
      // First, ensure any existing stream is properly stopped
      if (streamRef.current) {
        stopCamera()
      }

      // Clear any existing video source
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        console.log('📷 Camera started successfully')
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.')
      console.error('Camera error:', err)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Also clear the video element's source
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    console.log('📷 Camera stopped and cleaned up')
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    // Start 3-second countdown
    setCaptureCountdown(3)
    setIsCapturing(true)

    const countdownInterval = setInterval(() => {
      setCaptureCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)

          // Actually capture the photo
          const video = videoRef.current!
          const canvas = canvasRef.current!
          const context = canvas.getContext('2d')!

          // Set canvas dimensions to match video
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          // Draw video frame to canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Convert to data URL
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          console.log('📸 Photo captured! Image data URL length:', imageDataUrl.length)
          setCapturedImage(imageDataUrl)
          setIsCapturing(false)
          setCaptureCountdown(0)

          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setIsCapturing(false)
    // Restart the camera when retaking photo
    startCamera()
  }

  const uploadPhoto = async () => {
    console.log('🚀 Upload function called!')
    console.log('📸 Captured image exists:', !!capturedImage)
    console.log('👤 User exists:', !!user)

    if (!capturedImage || !user) {
      console.log('❌ Early return - missing capturedImage or user')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()

      // Generate unique filename with better structure
      const timestamp = Date.now()
      const fileName = reminderId
        ? `${user.id}/${reminderId}_${timestamp}.jpg`
        : `${user.id}/background_${timestamp}.jpg`

      // Log the file path components for debugging
      console.log('🔍 File path components:')
      console.log('  User ID:', user.id)
      console.log('  Reminder ID:', reminderId || 'background-notification')
      console.log('  Timestamp:', timestamp)
      console.log('  Full file path:', fileName)
      console.log('  File path length:', fileName.length)

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      let urlData: any = null
      let finalFileName = fileName

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)

        // Try with a simpler file path if the first one fails
        if (uploadError.message && uploadError.message.includes('400')) {
          console.log('🔄 Trying with simplified file path...')
          const simpleFileName = reminderId
            ? `${user.id.substring(0, 8)}/${reminderId.substring(0, 8)}_${timestamp}.jpg`
            : `${user.id.substring(0, 8)}/bg_${timestamp}.jpg`

          const { data: retryData, error: retryError } = await supabase.storage
            .from('photos')
            .upload(simpleFileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            })

          if (retryError) {
            console.error('❌ Retry upload also failed:', retryError)
            throw retryError
          }

          console.log('✅ Retry upload succeeded with simplified path:', simpleFileName)
          finalFileName = simpleFileName
        } else {
          throw uploadError
        }
      }

      // Get public URL for the final filename
      if (!urlData) {
        const { data: urlResult } = supabase.storage
          .from('photos')
          .getPublicUrl(finalFileName)
        urlData = urlResult
      }

      // Ensure we have a valid URL before proceeding
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to get public URL for uploaded photo')
      }

      // Log the URL to console for debugging
      console.log('📸 Reminder photo uploaded successfully!')
      console.log('📁 File path:', finalFileName)
      console.log('🔗 Public URL:', urlData.publicUrl)
      console.log('📊 Storage data:', uploadData)
      console.log('⏰ Reminder ID:', reminderId)

      // Complete the reminder (skip for test reminder IDs and background notifications)
      if (reminderId && !reminderId.startsWith('test-')) {
        console.log('🔄 Completing reminder...')
        await ReminderService.completeReminder(reminderId, urlData.publicUrl, user.id)
        console.log('✅ Photo uploaded and reminder completed successfully!')

        // Update reminder statuses: mark most recent as completed, others as expired
        await updateReminderStatuses(user.id)
      } else if (reminderId && reminderId.startsWith('test-')) {
        // For test reminders, just show success message
        console.log('🧪 Test photo uploaded successfully! (No database update)')
      } else {
        // For background notifications (no reminder ID), just show success message
        console.log('🔔 Background notification photo uploaded successfully! (No database update)')

        // Update reminder statuses for background notifications too
        await updateReminderStatuses(user.id)
      }

      // Show success message before navigation
      console.log('🎉 Photo upload completed successfully!')

      // Small delay to ensure all operations complete before navigation
      await new Promise(resolve => setTimeout(resolve, 500))

      // Navigate back to dashboard for all successful uploads
      console.log('🔄 Navigating back to dashboard...')
      try {
        navigate('/')
        console.log('✅ Navigation successful')
      } catch (navError) {
        console.error('❌ Navigation failed:', navError)
        // Fallback: try to reload the page
        window.location.href = '/'
      }
    } catch (err) {
      console.error('❌ Upload error occurred:', err)
      console.error('❌ Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace',
        reminderId,
        hasUser: !!user,
        hasCapturedImage: !!capturedImage
      })
      setError('Failed to upload photo. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!user) {
    return <div>Loading...</div>
  }

  // Add error boundary logging
  console.log('PhotoCapture render state:', {
    user: !!user,
    reminderId,
    timeLeft,
    isLoadingTimer,
    capturedImage: !!capturedImage,
    error
  })

  // Simple fallback to test if component is rendering
  if (isLoadingTimer) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-xl">Setting up timer...</div>
          <div className="text-sm text-gray-400 mt-2">Please wait while we calculate your time remaining</div>
        </div>
      </div>
    )
  }

  try {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header with timer */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {reminderId ? '📸 Take Your Photo!' : '📸 Diaper Check!'}
        </h1>
        {isLoadingTimer ? (
          <div className="text-4xl font-mono font-bold text-blue-500">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-2"></div>
            <div>Calculating...</div>
          </div>
        ) : (
          <div className="text-4xl font-mono font-bold text-red-500">
            {formatTime(timeLeft)}
          </div>
        )}
        <p className="text-gray-400">
          Take a photo of your diaper for your Mommy.
        </p>
        {!isLoadingTimer && timeLeft === 0 && !isExpired && (
          <p className="text-red-400 text-sm mt-1">
            ⚠️ Time has expired! Please take your photo quickly.
          </p>
        )}
        {isExpired && (
          <div className="mt-4 p-4 bg-red-600 text-white rounded-lg text-center">
            <h2 className="text-xl font-bold mb-2">⏰ Reminder Expired</h2>
            <p className="mb-3">This reminder has expired. The 5-minute window has passed.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-white text-red-600 hover:bg-gray-100 font-bold py-2 px-4 rounded transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

      </div>

      {/* Camera view */}
      {!capturedImage && !isExpired && (
        <div className="relative bg-black rounded-lg overflow-hidden mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto max-h-96 object-contain"
            style={{ aspectRatio: 'auto' }}
          />

          {/* Countdown overlay */}
          {captureCountdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="text-center">
                <div className="text-9xl font-bold text-white mb-4 animate-pulse">
                  {captureCountdown}
                </div>
                <div className="text-2xl text-white">Get ready!</div>
              </div>
            </div>
          )}

          {/* Camera guide overlay */}
          {captureCountdown === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-4 border-white border-dashed rounded-lg p-8 opacity-50">
                <div className="text-center">
                  <div className="text-6xl mb-2">📷</div>
                  <div className="text-lg">Position your camera</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Captured image preview */}
      {capturedImage && (
        <div className="mb-6">
          <img
            src={capturedImage}
            alt="Captured photo"
            className="w-full h-auto max-h-96 object-contain rounded-lg"
            style={{ aspectRatio: 'auto' }}
          />
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Action buttons */}
      {!isExpired && (
        <div className="space-y-4">
        {!capturedImage ? (
          <button
            onClick={capturePhoto}
            disabled={isCapturing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
          >
            {captureCountdown > 0 ? `⏰ ${captureCountdown}...` : '📸 Capture Photo'}
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                console.log('🔘 Upload button clicked!')
                uploadPhoto()
              }}
              disabled={isUploading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
            >
              {isUploading ? 'Uploading...' : '✅ Upload Photo'}
            </button>
            <button
              onClick={retakePhoto}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
            >
              🔄 Retake Photo
            </button>
          </>
        )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-600 text-white rounded-lg text-center">
          {error}
        </div>
      )}

      {/* Progress indicator */}
      {isUploading && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-gray-400">Uploading photo...</p>
        </div>
      )}
      </div>
    )
  } catch (error) {
    console.error('Error rendering PhotoCapture:', error)
    return (
      <div className="min-h-screen bg-red-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">⚠️ Error Loading Photo Capture</h1>
          <p className="mb-4">Something went wrong while loading the photo capture page.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            🔄 Reload Page
          </button>
          <pre className="mt-4 text-xs bg-black p-2 rounded overflow-auto">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
      </div>
    )
  }
}

export default PhotoCapture
