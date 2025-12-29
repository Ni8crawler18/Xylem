import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Loader2, Copy, FileCode, History, Sparkles } from 'lucide-react'
import { api } from '../lib/api'

function Verify() {
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

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-6">
            <Shield className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-purple-400">Proof Verification</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Verify a Proof</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Validate zero-knowledge proofs without accessing any personal data
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Verification Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mr-3">
                  <FileCode className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Paste Proof</h2>
                  <p className="text-sm text-gray-400">Enter the ZK proof JSON</p>
                </div>
              </div>

              <textarea
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                className="input font-mono text-sm h-48 mb-4"
                placeholder='{"proof": {...}, "publicSignals": [...], "nullifier": "...", "verificationType": "age"}'
              />

              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={verifyProof}
                disabled={loading || !proofInput.trim()}
                className="btn-primary w-full flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    Verify Proof
                  </>
                )}
              </button>
            </div>

            {/* Verification Result */}
            {verificationResult && (
              <div className={`card border ${verificationResult.verified ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center mb-6">
                  {verificationResult.verified ? (
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mr-4">
                      <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mr-4">
                      <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                  )}
                  <div>
                    <h3 className={`text-xl font-bold ${verificationResult.verified ? 'text-green-400' : 'text-red-400'}`}>
                      {verificationResult.verified ? 'Proof Valid' : 'Proof Invalid'}
                    </h3>
                    <p className="text-gray-400">Attribute: {verificationResult.attribute}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Verification Time</div>
                    <div className="text-white font-medium">{verificationResult.verificationTime}</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">PII Exposed</div>
                    <div className="text-green-400 font-medium">None</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">DPDP Compliant</div>
                    <div className="text-green-400 font-medium">Yes</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Verification ID</div>
                    <div className="text-white font-mono text-xs">{verificationResult.verificationId?.slice(0, 8)}...</div>
                  </div>
                </div>
              </div>
            )}

            {/* What Verifier Learns */}
            <div className="card bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border-cyan-500/20">
              <div className="flex items-center mb-4">
                <Sparkles className="h-5 w-5 text-cyan-400 mr-2" />
                <h3 className="text-white font-semibold">Privacy Preserved</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2">You Learn:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>- Whether the claim is valid (yes/no)</li>
                    <li>- Proof was issued by trusted source</li>
                    <li>- Proof hasn't been used before</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-2">You DON'T Learn:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>- User's actual name</li>
                    <li>- User's date of birth</li>
                    <li>- User's ID number or address</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Verifications */}
            <div className="card">
              <div className="flex items-center mb-4">
                <History className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="text-white font-semibold">Recent Verifications</h3>
              </div>
              {history.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.slice(0, 10).map((v, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                      <div className="flex items-center">
                        {v.result ? (
                          <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 mr-2" />
                        )}
                        <span className="text-sm text-white capitalize">{v.type}</span>
                      </div>
                      <span className="text-xs text-gray-500">{v.verificationTimeMs}ms</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No verifications yet</p>
              )}
            </div>

            {/* Info Card */}
            <div className="card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <Shield className="h-8 w-8 text-purple-400 mb-3" />
              <h3 className="text-white font-semibold mb-2">Zero-Knowledge Verification</h3>
              <p className="text-sm text-gray-400">
                As a verifier, you mathematically confirm claims without ever accessing the underlying personal data. This is the future of privacy-preserving verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Verify
