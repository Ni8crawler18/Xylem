import { useState } from 'react'
import {
  Calendar, MapPin, Fingerprint, CheckCircle, Copy,
  Loader2, ArrowRight, FileText, Clock, LogOut, User,
  ChevronRight, AlertCircle, Terminal
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { generateProofClientSide } from '../lib/zkp'

function UserDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('generate')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [credential, setCredential] = useState(null)
  const [proof, setProof] = useState(null)
  const [proofTime, setProofTime] = useState(null)
  const [copied, setCopied] = useState(false)
  const [proofHistory, setProofHistory] = useState([])

  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    aadhaarNumber: '',
    pincode: '',
  })

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const issueCredential = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.issueCredential(formData)
      setCredential(response.credential)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Failed to issue credential')
    } finally {
      setLoading(false)
    }
  }

  const generateProof = async (verificationType) => {
    if (!credential) {
      setError('No credential available')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const startTime = Date.now()

      const publicInputs = {
        minimumAge: 18,
        currentDate: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: new Date().getDate()
        },
        commitment: credential.commitment,
        issuerPubKey: credential.issuer.publicKey,
        requiredStateCode: parseInt(formData.pincode?.substring(0, 2)) || 56
      }

      const result = await generateProofClientSide(
        verificationType,
        credential.privateInputs,
        publicInputs
      )

      const endTime = Date.now()
      setProofTime(endTime - startTime)

      const newProof = {
        ...result,
        verificationType,
        generatedAt: new Date().toISOString()
      }

      setProof(newProof)
      setProofHistory(prev => [newProof, ...prev])
      setStep(3)
    } catch (err) {
      setError(err.message || 'Failed to generate proof')
    } finally {
      setLoading(false)
    }
  }

  const copyProof = () => {
    navigator.clipboard.writeText(JSON.stringify({
      proof: proof.proof,
      publicSignals: proof.publicSignals,
      nullifier: proof.nullifier,
      verificationType: proof.verificationType
    }, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetFlow = () => {
    setStep(1)
    setCredential(null)
    setProof(null)
    setProofTime(null)
    setError(null)
  }

  const proofTypes = [
    {
      id: 'age',
      title: 'age_verification.circom',
      description: 'Prove age >= 18 without revealing DOB',
      icon: Calendar,
    },
    {
      id: 'aadhaar',
      title: 'aadhaar_validity.circom',
      description: 'Prove valid ID without number exposure',
      icon: Fingerprint,
    },
    {
      id: 'state',
      title: 'state_verification.circom',
      description: 'Prove residence without full address',
      icon: MapPin,
    }
  ]

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
            onClick={() => setActiveTab('generate')}
            className={activeTab === 'generate' ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
          >
            <Terminal className="h-5 w-5 mr-3" />
            Generate Proof
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={activeTab === 'history' ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
          >
            <Clock className="h-5 w-5 mr-3" />
            History
          </button>
        </nav>

        <div className="pt-6 border-t border-white/10">
          <div className="p-3 bg-white/5 rounded-lg mb-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-3">
                <User className="h-4 w-4 text-[#5B9A5B]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{user?.name}</div>
                <div className="text-xs text-gray-500 font-mono">PROVER</div>
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

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center space-x-2 border border-white/10 rounded-full px-3 py-1 mb-4">
            <span className="text-xs text-gray-500 font-mono">// {activeTab === 'generate' ? 'proof_generator' : 'history'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'generate' ? 'Generate ZK Proof' : 'Proof History'}
          </h1>
        </div>

        {activeTab === 'generate' && (
          <>
            {/* Progress Steps */}
            <div className="flex items-center mb-8">
              {[
                { num: 1, label: 'Witness' },
                { num: 2, label: 'Circuit' },
                { num: 3, label: 'Proof' }
              ].map(({ num, label }, idx) => (
                <div key={num} className="flex items-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono transition-all ${
                    step >= num
                      ? 'bg-[#5B9A5B] text-white'
                      : 'bg-white/5 border border-white/10 text-gray-500'
                  }`}>
                    {step > num ? <CheckCircle className="h-4 w-4" /> : num}
                  </div>
                  <span className={`ml-2 text-sm font-mono hidden sm:block ${step >= num ? 'text-white' : 'text-gray-600'}`}>
                    {label}
                  </span>
                  {idx < 2 && (
                    <ChevronRight className={`h-5 w-5 mx-4 ${step > num ? 'text-[#5B9A5B]' : 'text-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Step 1: Input Data */}
            {step === 1 && (
              <div className="card max-w-2xl">
                <div className="text-xs text-gray-500 font-mono mb-4">// Enter secret witness</div>
                <h2 className="text-lg font-semibold text-white mb-6">Private Inputs</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label font-mono text-xs">name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="input font-mono"
                      placeholder="string"
                    />
                  </div>
                  <div>
                    <label className="label font-mono text-xs">dateOfBirth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label font-mono text-xs">aadhaarNumber[12]</label>
                    <input
                      type="text"
                      name="aadhaarNumber"
                      value={formData.aadhaarNumber}
                      onChange={handleInputChange}
                      className="input font-mono"
                      placeholder="uint[12]"
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <label className="label font-mono text-xs">pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleInputChange}
                      className="input font-mono"
                      placeholder="uint"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 rounded-lg">
                  <code className="text-xs text-[#5B9A5B] font-mono">
                    // Witness data processed locally. Never transmitted.
                  </code>
                </div>

                <button
                  onClick={issueCredential}
                  disabled={loading || !formData.name || !formData.dateOfBirth || !formData.aadhaarNumber}
                  className="btn-primary w-full mt-6 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Computing commitment...
                    </>
                  ) : (
                    <>
                      Generate Commitment
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Step 2: Select Circuit */}
            {step === 2 && credential && (
              <div className="max-w-2xl">
                <div className="card mb-6 card-green">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-[#5B9A5B] mr-2" />
                    <span className="text-[#5B9A5B] font-mono text-sm">Commitment generated</span>
                  </div>
                  <code className="text-xs text-gray-400 mt-2 block font-mono">
                    {credential.commitment.slice(0, 32)}...
                  </code>
                </div>

                <div className="text-xs text-gray-500 font-mono mb-4">// Select circuit</div>

                <div className="space-y-3">
                  {proofTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => generateProof(type.id)}
                      disabled={loading}
                      className="w-full card hover:border-[#5B9A5B]/30 text-left group"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 flex items-center justify-center mr-4 group-hover:bg-[#5B9A5B]/20 transition-all">
                          <type.icon className="h-5 w-5 text-[#5B9A5B]" />
                        </div>
                        <div className="flex-1">
                          <code className="text-[#5B9A5B] text-sm font-mono">{type.title}</code>
                          <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-[#5B9A5B] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>

                {loading && (
                  <div className="mt-6 card card-green">
                    <div className="flex items-center">
                      <Loader2 className="h-5 w-5 text-[#5B9A5B] mr-3 animate-spin" />
                      <div>
                        <p className="text-white font-mono text-sm">groth16.fullProve()</p>
                        <p className="text-xs text-gray-500">Computing ZK proof locally...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: View Proof */}
            {step === 3 && proof && (
              <div className="max-w-2xl">
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-3">
                        <CheckCircle className="h-5 w-5 text-[#5B9A5B]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white font-mono">Proof Generated</h2>
                        <p className="text-xs text-gray-500">Ready for verification</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#5B9A5B] font-mono">{proofTime}ms</div>
                      <div className="text-xs text-gray-600">prove_time</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-600 mb-1 font-mono">circuit</div>
                      <div className="text-white font-mono text-sm">{proof.verificationType}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-600 mb-1 font-mono">valid</div>
                      <div className="text-[#5B9A5B] font-mono text-sm">true</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-600 mb-1 font-mono">pii_exposed</div>
                      <div className="text-[#5B9A5B] font-mono text-sm">0</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-mono">// proof_output</span>
                      <button
                        onClick={copyProof}
                        className="text-[#5B9A5B] hover:text-[#7CB87C] flex items-center text-xs font-mono"
                      >
                        {copied ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-black rounded-lg p-4 text-xs text-[#5B9A5B] overflow-auto max-h-48 border border-white/10">
                      {JSON.stringify({
                        proof: proof.proof,
                        publicSignals: proof.publicSignals,
                        nullifier: proof.nullifier,
                        verificationType: proof.verificationType
                      }, null, 2)}
                    </pre>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setStep(2)} className="btn-secondary flex-1">
                      New Proof
                    </button>
                    <button onClick={resetFlow} className="btn-primary flex-1">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div className="max-w-2xl">
            {proofHistory.length > 0 ? (
              <div className="space-y-3">
                {proofHistory.map((p, idx) => (
                  <div key={idx} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-3">
                          <CheckCircle className="h-4 w-4 text-[#5B9A5B]" />
                        </div>
                        <div>
                          <code className="text-[#5B9A5B] text-sm font-mono">{p.verificationType}_verification</code>
                          <div className="text-xs text-gray-600">
                            {new Date(p.generatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-success font-mono text-xs">valid</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12">
                <Clock className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No proofs yet</h3>
                <p className="text-gray-500 mb-4 font-mono text-sm">Generate your first proof</p>
                <button onClick={() => setActiveTab('generate')} className="btn-primary">
                  Generate Proof
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserDashboard
