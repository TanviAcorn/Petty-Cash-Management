import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ColorModeProvider } from './theme/ColorMode.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import Login from './pages/Login.jsx'
import TravelFeedback from './pages/TravelFeedback.jsx'

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public route — no auth required */}
        <Route path="/travel-feedback/:token" element={<TravelFeedback />} />
        <Route 
          path="/*" 
          element={isAuthenticated ? <App /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />} 
        />
      </Routes>
    </Router>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ColorModeProvider>
  </StrictMode>
)
