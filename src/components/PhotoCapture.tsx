import React, { useRef, useState, useEffect } from 'react'
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

  useEffect(() => {
    if (!reminderId || !user) {
      navigate('/')
      return
    }

    // Activate the reminder (skip for test reminder IDs)
    if (!reminderId.startsWith('test-')) {
      ReminderService.activateReminder(reminderId)
    }

    // Start countdown timer
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

    // Start camera
    startCamera()

    return () => {
      clearInterval(timer)
      stopCamera()
    }
  }, [reminderId, user, navigate])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
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
    setIsCapturing(true)
  }

  const uploadPhoto = async () => {
    if (!capturedImage || !reminderId || !user) return

    setIsUploading(true)
    setError(null)

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()

      // Generate unique filename with better structure
      const timestamp = Date.now()
      const fileName = `${user.id}/${reminderId}_${timestamp}.jpg`

      // Log the file path components for debugging
      console.log('🔍 File path components:')
      console.log('  User ID:', user.id)
      console.log('  Reminder ID:', reminderId)
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

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)

        // Try with a simpler file path if the first one fails
        if (uploadError.message && uploadError.message.includes('400')) {
          console.log('🔄 Trying with simplified file path...')
          const simpleFileName = `${user.id.substring(0, 8)}/${reminderId.substring(0, 8)}_${timestamp}.jpg`

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
          // Use the retry data instead
          const { data: retryUrlData } = supabase.storage
            .from('photos')
            .getPublicUrl(simpleFileName)

          // Continue with the retry URL data
          urlData = retryUrlData
        } else {
          throw uploadError
        }
      }

      // Get public URL (urlData might be set by retry logic above)
      let urlData
      if (!urlData) {
        const { data: urlResult } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName)
        urlData = urlResult
      }

      // Log the URL to console for debugging
      console.log('📸 Reminder photo uploaded successfully!')
      console.log('📁 File path:', fileName)
      console.log('🔗 Public URL:', urlData.publicUrl)
      console.log('📊 Storage data:', uploadData)
      console.log('⏰ Reminder ID:', reminderId)

      // Complete the reminder (skip for test reminder IDs)
      if (!reminderId.startsWith('test-')) {
        await ReminderService.completeReminder(reminderId, urlData.publicUrl, user.id)
        console.log('✅ Photo uploaded and reminder completed successfully!')
      } else {
        // For test reminders, just show success message
        console.log('🧪 Test photo uploaded successfully! (No database update)')
      }

      // Navigate back to dashboard for all successful uploads
      navigate('/')
    } catch (err) {
      setError('Failed to upload photo. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleTimeExpired = () => {
    if (reminderId && !reminderId.startsWith('test-')) {
      ReminderService.expireReminder(reminderId)
    }
    navigate('/expired')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!reminderId || !user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header with timer */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">📸 Take Your Photo!</h1>
        <div className="text-4xl font-mono font-bold text-red-500">
          {formatTime(timeLeft)}
        </div>
        <p className="text-gray-400">Time remaining to capture and upload</p>
      </div>

      {/* Camera view */}
      {!capturedImage && (
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
              onClick={uploadPhoto}
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
}

export default PhotoCapture
