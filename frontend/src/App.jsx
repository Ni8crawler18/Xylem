import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginModal from './components/LoginModal'
import Home from './pages/Home'
import Slides from './pages/Slides'
import UserDashboard from './pages/UserDashboard'
import VerifierDashboard from './pages/VerifierDashboard'

function Navigation({ onLoginClick }) {
  const { user, logout } = useAuth()

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center space-x-3 group">
              <img src="/logo.png" alt="Eigenparse" className="h-8 w-8" />
              <span className="text-xl font-bold text-white">Eigenparse</span>
            </a>
          </div>

          {/* Center - Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => scrollToSection('protocol')}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              Protocol
            </button>
            <button
              onClick={() => scrollToSection('circuits')}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              Circuits
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              Architecture
            </button>
            <a
              href="https://github.com/Ni8crawler18/Xylem"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              GitHub
            </a>
            <a
              href="#docs"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              Docs
            </a>
            <Link
              to="/slides"
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono flex items-center space-x-1.5"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h20v14H2z" /><path d="M8 21h8" /><path d="M12 17v4" />
              </svg>
              <span>Slides</span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">
                  <span className="font-medium text-white">{user.name}</span>
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button onClick={onLoginClick} className="px-4 py-1.5 bg-[#5B9A5B] text-white text-sm rounded-lg hover:bg-[#4A7F4A] transition-all font-medium">
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B9A5B]" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'user' ? '/dashboard' : '/verifier'} replace />
  }

  return children
}

function AppContent() {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleLoginSuccess = (userData) => {
    if (userData.role === 'user') {
      navigate('/dashboard')
    } else if (userData.role === 'verifier') {
      navigate('/verifier')
    }
  }

  useEffect(() => {
    if (user) {
      if (window.location.pathname === '/') {
        navigate(user.role === 'user' ? '/dashboard' : '/verifier')
      }
    }
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-black">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Navigation onLoginClick={() => setShowLoginModal(true)} />
              <main className="pt-16">
                <Home onLoginClick={() => setShowLoginModal(true)} />
              </main>
            </>
          }
        />

        <Route
          path="/slides"
          element={
            <>
              <Navigation onLoginClick={() => setShowLoginModal(true)} />
              <Slides />
            </>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/verifier"
          element={
            <ProtectedRoute allowedRole="verifier">
              <VerifierDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
