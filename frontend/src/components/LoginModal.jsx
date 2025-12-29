import { useState } from 'react'
import { X, Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function LoginModal({ isOpen, onClose, onSuccess }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = login(email, password)

    setTimeout(() => {
      setLoading(false)
      if (result.success) {
        onSuccess(result.user)
        onClose()
      } else {
        setError(result.error)
      }
    }, 500)
  }

  const fillCredentials = (type) => {
    if (type === 'user') {
      setEmail('user@eigenparse.com')
      setPassword('eigenparse')
    } else {
      setEmail('verifier@eigenparse.com')
      setPassword('zkproof')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Sign In</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center text-red-400">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-12"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-12"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-sm text-gray-500 text-center mb-3 font-mono">// Quick Login</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillCredentials('user')}
                className="p-3 bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 rounded-lg text-sm text-[#5B9A5B] hover:bg-[#5B9A5B]/20 transition-all"
              >
                <div className="font-medium font-mono">PROVER</div>
                <div className="text-xs text-[#5B9A5B]/70 mt-0.5">Generate proofs</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('verifier')}
                className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-all"
              >
                <div className="font-medium font-mono">VERIFIER</div>
                <div className="text-xs text-gray-500 mt-0.5">Verify proofs</div>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
