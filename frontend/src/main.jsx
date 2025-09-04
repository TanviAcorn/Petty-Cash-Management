import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import { BrowserRouter } from 'react-router-dom'

function AuthGate() {
  const token = (() => {
    try {
      return localStorage.getItem('token') || ''
    } catch {
      return ''
    }
  })()
  return token ? <App /> : <Login />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  </StrictMode>,
)
