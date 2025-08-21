import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TestPhotoCapture: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    // Start camera
    startCamera()

    return () => {
      stopCamera()
    }
  }, [user, navigate])

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

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(imageDataUrl)
    setIsCapturing(false)
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setIsCapturing(true)
  }

  const uploadPhoto = async () => {
    if (!capturedImage || !user) return

    setIsUploading(true)
    setError(null)

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()

      // Generate filename that matches the storage policy: {user_id}/filename
      // The policy requires: auth.uid()::text = (storage.foldername(name))[1]
      const fileName = `${user.id}/test_${Date.now()}.jpg`

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      if (uploadError) {
        // Handle specific RLS policy errors
        if (uploadError.message.includes('row-level security policy')) {
          throw new Error(
            'Storage permission denied. Your policy requires photos to be in user ID folders. ' +
            'Current path: ' + fileName
          )
        }
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName)

      // Log the URL to console for debugging
      console.log('📸 Photo uploaded successfully!')
      console.log('📁 File path:', fileName)
      console.log('🔗 Public URL:', urlData.publicUrl)
      console.log('📊 Storage data:', uploadData)

      // Show success message
      alert(`Test photo uploaded successfully!\nURL: ${urlData.publicUrl}`)

      // Navigate back to dashboard
      navigate('/')
    } catch (err: any) {
      console.error('Upload error:', err)

      if (err.message.includes('Storage permission denied')) {
        setError(err.message)
      } else {
        setError(`Failed to upload photo: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setIsUploading(false)
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">📸 Test Photo Capture</h1>
        <p className="text-gray-400">Test the photo capture and upload functionality</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
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
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-4 border-white border-dashed rounded-lg p-8 opacity-50">
              <div className="text-center">
                <div className="text-6xl mb-2">📷</div>
                <div className="text-lg">Position your camera</div>
                <div className="text-sm text-gray-300 mt-2">This is a test - no time limit!</div>
              </div>
            </div>
          </div>
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
            {isCapturing ? 'Capturing...' : '📸 Capture Photo'}
          </button>
        ) : (
          <>
            <button
              onClick={uploadPhoto}
              disabled={isUploading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors"
            >
              {isUploading ? 'Uploading...' : '✅ Upload Test Photo'}
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
          <p className="mt-2 text-gray-400">Uploading test photo...</p>
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 p-4 bg-blue-900 rounded-lg">
        <h3 className="font-semibold mb-2">🧪 Test Mode Features:</h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• No time limit - take your time</li>
          <li>• Photos saved to your user folder: {user.id}/</li>
          <li>• Perfect for testing camera functionality</li>
          <li>• No reminder scheduling required</li>
        </ul>
      </div>

      {/* Storage Setup Info */}
      <div className="mt-4 p-4 bg-green-900 rounded-lg">
        <h3 className="font-semibold mb-2">✅ Storage Policy Configured:</h3>
        <p className="text-sm text-green-200 mb-2">
          Your storage policy is working correctly! Photos are saved to user-specific folders.
        </p>
        <div className="text-sm text-green-200">
          <strong>Current policy:</strong> Users can only upload to their own folder
        </div>
      </div>
    </div>
  )
}

export default TestPhotoCapture
