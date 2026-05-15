import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ColorModeProvider } from './theme/ColorMode.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import Login from './pages/Login.jsx'
import TravelFeedback from './pages/TravelFeedback.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Preserve the intended destination so Login can redirect back after auth
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Handles the /login route: shows Login when unauthenticated,
// redirects to the intended destination (state.from) when already authenticated.
// This prevents the "already authenticated" re-render from overriding the
// post-login navigate() call in Login.jsx by always honouring state.from.
function LoginRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Login />;
  }
  // Authenticated — go to the intended destination or default to root
  const to = location.state?.from || '/';
  return <Navigate to={to} replace />;
}

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  const basename = import.meta.env.VITE_BASE_PATH || '/';

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
    <Router basename={basename}>
      <Routes>
        {/* Public routes — no auth required */}
        <Route path="/travel-feedback/:token" element={<TravelFeedback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/login"
          element={<LoginRoute />}
        />
        {/* All other routes require authentication */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <App />
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
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
