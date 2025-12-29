import { useState, useEffect } from 'react'
import {
  Shield, CheckCircle, XCircle, Loader2, FileCode,
  Clock, LogOut, User, AlertCircle, History, Terminal
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

function VerifierDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('verify')
  const [proofInput, setProofInput] = useState('')
  const [verificationResult, setVerificationResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const data = await api.getVerificationHistory()
      setHistory(data.verifications || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const verifyProof = async () => {
    setLoading(true)
    setError(null)
    setVerificationResult(null)

    try {
      const proofData = JSON.parse(proofInput)
      const { proof, publicSignals, nullifier, verificationType } = proofData

      if (!proof || !publicSignals || !nullifier || !verificationType) {
        throw new Error('Invalid proof format')
      }

      const result = await api.verifyProof(verificationType, {
        proof,
        publicSignals,
        nullifier
      })

      setVerificationResult(result)
      loadHistory()
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format')
      } else {
        setError(err.message || 'Verification failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: history.length,
    valid: history.filter(v => v.result).length,
    invalid: history.filter(v => !v.result).length,
    avgTime: history.length > 0
      ? Math.round(history.reduce((acc, v) => acc + v.verificationTimeMs, 0) / history.length)
      : 0
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#0D0D0D] border-r border-white/10 p-6 hidden lg:flex flex-col">
        <div className="flex items-center space-x-3 mb-8">
          <img src="/logo.png" alt="Eigenparse" className="h-8 w-8" />
          <span className="text-xl font-bold text-white">Eigenparse</span>
        </div>

        <nav className="space-y-2 flex-1">
          <button
            onClick={() => setActiveTab('verify')}
            className={activeTab === 'verify' ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
          >
            <Shield className="h-5 w-5 mr-3" />
            Verify Proof
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={activeTab === 'history' ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
          >
            <History className="h-5 w-5 mr-3" />
            History
          </button>
        </nav>

        <div className="pt-6 border-t border-white/10">
          <div className="p-3 bg-white/5 rounded-lg mb-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mr-3">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{user?.name}</div>
                <div className="text-xs text-gray-500 font-mono">VERIFIER</div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center text-gray-500 hover:text-red-400 transition-colors text-sm w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Eigenparse" className="h-8 w-8" />
            <span className="text-xl font-bold text-white">Eigenparse</span>
          </div>
          <button onClick={logout} className="text-gray-500 hover:text-red-400">
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card">
            <div className="text-2xl font-bold text-white font-mono">{stats.total}</div>
            <div className="text-xs text-gray-500">total</div>
          </div>
          <div className="stat-card">
            <div className="text-2xl font-bold text-[#5B9A5B] font-mono">{stats.valid}</div>
            <div className="text-xs text-gray-500">valid</div>
          </div>
          <div className="stat-card">
            <div className="text-2xl font-bold text-red-400 font-mono">{stats.invalid}</div>
            <div className="text-xs text-gray-500">invalid</div>
          </div>
          <div className="stat-card">
            <div className="text-2xl font-bold text-white font-mono">{stats.avgTime}ms</div>
            <div className="text-xs text-gray-500">avg_time</div>
          </div>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center space-x-2 border border-white/10 rounded-full px-3 py-1 mb-4">
            <span className="text-xs text-gray-500 font-mono">// {activeTab === 'verify' ? 'verifier' : 'history'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'verify' ? 'Verify ZK Proof' : 'Verification History'}
          </h1>
        </div>

        {activeTab === 'verify' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mr-3">
                    <FileCode className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white font-mono">proof_input</h2>
                    <p className="text-xs text-gray-500">Paste ZK proof JSON</p>
                  </div>
                </div>

                <textarea
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  className="input font-mono text-sm h-48 mb-4 text-[#5B9A5B]"
                  placeholder='{"proof": {...}, "publicSignals": [...], "nullifier": "...", "verificationType": "age"}'
                />

                {error && (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                    <p className="text-red-400 text-sm font-mono">{error}</p>
                  </div>
                )}

                <button
                  onClick={verifyProof}
                  disabled={loading || !proofInput.trim()}
                  className="btn-primary w-full flex items-center justify-center font-mono"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      verify()
                    </>
                  ) : (
                    <>
                      <Terminal className="h-5 w-5 mr-2" />
                      verify(proof)
                    </>
                  )}
                </button>
              </div>

              {/* Verification Result */}
              {verificationResult && (
                <div className={`card border-2 ${verificationResult.verified ? 'border-[#5B9A5B]/50 bg-[#5B9A5B]/5' : 'border-red-500/50 bg-red-500/5'}`}>
                  <div className="flex items-center mb-6">
                    {verificationResult.verified ? (
                      <div className="w-12 h-12 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-4">
                        <CheckCircle className="h-6 w-6 text-[#5B9A5B]" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center mr-4">
                        <XCircle className="h-6 w-6 text-red-400" />
                      </div>
                    )}
                    <div>
                      <h3 className={`text-xl font-bold font-mono ${verificationResult.verified ? 'text-[#5B9A5B]' : 'text-red-400'}`}>
                        {verificationResult.verified ? 'VALID' : 'INVALID'}
                      </h3>
                      <p className="text-gray-500 text-sm">attribute: {verificationResult.attribute}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-600 mb-1 font-mono">verify_time</div>
                      <div className="text-white font-mono">{verificationResult.verificationTime}</div>
                    </div>
                    <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-600 mb-1 font-mono">pii_exposed</div>
                      <div className="text-[#5B9A5B] font-mono">0</div>
                    </div>
                    <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-600 mb-1 font-mono">dpdp_compliant</div>
                      <div className="text-[#5B9A5B] font-mono">true</div>
                    </div>
                    <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                      <div className="text-xs text-gray-600 mb-1 font-mono">id</div>
                      <div className="text-white font-mono text-xs">{verificationResult.verificationId?.slice(0, 8)}...</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Info */}
              <div className="card card-green">
                <div className="text-xs text-gray-500 font-mono mb-4">// Zero-knowledge verification</div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm font-mono text-[#5B9A5B] mb-2">verifier.learns()</div>
                    <ul className="text-sm text-gray-400 space-y-1 font-mono">
                      <li>- claim_validity: bool</li>
                      <li>- issuer_verified: bool</li>
                      <li>- proof_unique: bool</li>
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-mono text-red-400 mb-2">verifier.cannot_learn()</div>
                    <ul className="text-sm text-gray-400 space-y-1 font-mono">
                      <li>- prover.name</li>
                      <li>- prover.dob</li>
                      <li>- prover.id_number</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center mb-4">
                  <Clock className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="font-semibold text-white font-mono">recent</h3>
                </div>
                {history.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {history.slice(0, 5).map((v, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-lg flex items-center justify-between border border-white/5">
                        <div className="flex items-center">
                          {v.result ? (
                            <CheckCircle className="h-4 w-4 text-[#5B9A5B] mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400 mr-2" />
                          )}
                          <span className="text-sm text-white font-mono">{v.type}</span>
                        </div>
                        <span className="text-xs text-gray-600 font-mono">{v.verificationTimeMs}ms</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm font-mono">// empty</p>
                )}
              </div>

              <div className="card">
                <Shield className="h-8 w-8 text-[#5B9A5B] mb-3" />
                <h3 className="font-semibold text-white mb-2 font-mono">ZK-SNARK</h3>
                <p className="text-sm text-gray-500">
                  Mathematically verify claims without accessing underlying data.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl">
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((v, idx) => (
                  <div key={idx} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {v.result ? (
                          <div className="w-8 h-8 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-3">
                            <CheckCircle className="h-4 w-4 text-[#5B9A5B]" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center mr-3">
                            <XCircle className="h-4 w-4 text-red-400" />
                          </div>
                        )}
                        <div>
                          <code className="text-[#5B9A5B] text-sm font-mono">{v.type}_verification</code>
                          <div className="text-xs text-gray-600">
                            {new Date(v.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-xs text-gray-500 font-mono">{v.verificationTimeMs}ms</span>
                        <span className={`badge font-mono text-xs ${v.result ? 'badge-success' : 'badge-error'}`}>
                          {v.result ? 'valid' : 'invalid'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12">
                <History className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No verifications yet</h3>
                <p className="text-gray-500 mb-4 font-mono text-sm">Verify your first proof</p>
                <button onClick={() => setActiveTab('verify')} className="btn-primary">
                  Verify Proof
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifierDashboard
