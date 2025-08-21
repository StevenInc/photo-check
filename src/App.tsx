import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import PhotoCapture from './components/PhotoCapture'
import './index.css'

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/auth" replace />
}

// Success page component
const SuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl mb-6">✅</div>
        <h1 className="text-3xl font-bold text-green-900 mb-4">Photo Uploaded!</h1>
        <p className="text-green-700 mb-8 text-lg">
          Great job! Your photo has been successfully uploaded.
        </p>
        <a
          href="/"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

// Expired page component
const ExpiredPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl mb-6">⏰</div>
        <h1 className="text-3xl font-bold text-red-900 mb-4">Time Expired!</h1>
        <p className="text-red-700 mb-8 text-lg">
          The 5-minute window has expired. Better luck next time!
        </p>
        <a
          href="/"
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

// Main app component
const AppContent: React.FC = () => {
  const { user } = useAuth()

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/capture/:reminderId" element={
          <ProtectedRoute>
            <PhotoCapture />
          </ProtectedRoute>
        } />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/expired" element={<ExpiredPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  )
}

// Root app component with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
