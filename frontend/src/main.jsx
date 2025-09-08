import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ColorModeProvider } from './theme/ColorMode.jsx'
import Login from './pages/Login.jsx'

function AuthGate() {
  const token = (() => {
    try {
      return localStorage.getItem('token') || ''
    } catch {
      return ''
    }
  })()

  return (
    <Router>
      <Routes>
        <Route 
          path="/*" 
          element={token ? <App /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/login" 
          element={!token ? <Login /> : <Navigate to="/dashboard" replace />} 
        />
      </Routes>
    </Router>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeProvider>
      <AuthGate />
    </ColorModeProvider>
  </StrictMode>
)
