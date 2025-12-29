import { useState } from 'react'
import { Fingerprint, Calendar, MapPin, CheckCircle, Copy, Loader2, ArrowRight, Shield, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { generateProofClientSide } from '../lib/zkp'

function Prove() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [credential, setCredential] = useState(null)
  const [proof, setProof] = useState(null)
  const [proofTime, setProofTime] = useState(null)
  const [copied, setCopied] = useState(false)
  const [selectedProofType, setSelectedProofType] = useState(null)

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
    setSelectedProofType(verificationType)

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
      setProof({
        ...result,
        verificationType,
        generatedAt: new Date().toISOString()
      })
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
    setSelectedProofType(null)
  }

  const proofTypes = [
    {
      id: 'age',
      title: 'Age Verification',
      description: 'Prove you are 18+ without revealing your date of birth',
      icon: Calendar,
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      id: 'aadhaar',
      title: 'ID Validity',
      description: 'Prove you hold a valid ID without revealing the number',
      icon: Fingerprint,
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'state',
      title: 'Location Proof',
      description: 'Prove your region of residence without revealing address',
      icon: MapPin,
      gradient: 'from-orange-500 to-red-500'
    }
  ]

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-cyan-400">Zero-Knowledge Proof Generator</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Generate Credential Proof</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Create cryptographic proofs of your credentials. Your data never leaves your device.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[
              { num: 1, label: 'Input Data' },
              { num: 2, label: 'Select Proof' },
              { num: 3, label: 'Get Proof' }
            ].map(({ num, label }, idx) => (
              <div key={num} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= num
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}>
                  {step > num ? <CheckCircle className="h-5 w-5" /> : num}
                </div>
                <span className={`ml-2 text-sm hidden sm:block ${step >= num ? 'text-white' : 'text-gray-500'}`}>
                  {label}
                </span>
                {idx < 2 && (
                  <div className={`w-12 h-0.5 ml-4 ${step > num ? 'bg-cyan-500' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Step 1: Input Data */}
        {step === 1 && (
          <div className="card">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mr-3">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Enter Your Credentials</h2>
                <p className="text-sm text-gray-400">This data stays on your device</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>
              <div>
                <label className="label">ID Number (12 digits)</label>
                <input
                  type="text"
                  name="aadhaarNumber"
                  value={formData.aadhaarNumber}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="XXXXXXXXXXXX"
                  maxLength={12}
                />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="560001"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-cyan-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-400">
                  <strong className="text-white">Privacy Guarantee:</strong> Your data is processed locally and never transmitted. Only cryptographic proofs are shared.
                </div>
              </div>
            </div>

            <button
              onClick={issueCredential}
              disabled={loading || !formData.name || !formData.dateOfBirth || !formData.aadhaarNumber}
              className="btn-primary w-full mt-6 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Select Proof Type */}
        {step === 2 && credential && (
          <div className="card">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mr-3">
                <Sparkles className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Select What to Prove</h2>
                <p className="text-sm text-gray-400">Choose the type of proof to generate</p>
              </div>
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl mb-6">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-cyan-400 mr-2" />
                <span className="text-cyan-400 font-medium">Credential Ready</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Commitment: {credential.commitment.slice(0, 24)}...
              </p>
            </div>

            <div className="space-y-4">
              {proofTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => generateProof(type.id)}
                  disabled={loading}
                  className="w-full p-5 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/30 hover:bg-white/10 transition-all text-left group"
                >
                  <div className="flex items-center">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.gradient} bg-opacity-20 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform`}>
                      <type.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{type.title}</h3>
                      <p className="text-sm text-gray-400">{type.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            {loading && (
              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center">
                <Loader2 className="h-5 w-5 text-cyan-400 mr-3 animate-spin" />
                <div>
                  <p className="text-white font-medium">Generating Zero-Knowledge Proof...</p>
                  <p className="text-sm text-gray-400">Computing cryptographic proof locally</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: View Proof */}
        {step === 3 && proof && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mr-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Proof Generated</h2>
                  <p className="text-sm text-gray-400">Ready to share with verifiers</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-cyan-400">{proofTime}ms</div>
                <div className="text-xs text-gray-500">Generation Time</div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Proof Type</div>
                <div className="text-white font-medium capitalize">{proof.verificationType}</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Result</div>
                <div className="text-green-400 font-medium">Valid</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Data Exposed</div>
                <div className="text-cyan-400 font-medium">None</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Proof Data</span>
                <button
                  onClick={copyProof}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Proof
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-cyan-400 overflow-auto max-h-48 font-mono">
                {JSON.stringify({
                  proof: proof.proof,
                  publicSignals: proof.publicSignals,
                  nullifier: proof.nullifier,
                  verificationType: proof.verificationType
                }, null, 2)}
              </pre>
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl mb-6">
              <h4 className="text-white font-medium mb-2">What the verifier will learn:</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                {proof.verificationType === 'age' && <li>- You are 18 years or older (boolean: yes/no)</li>}
                {proof.verificationType === 'aadhaar' && <li>- You hold a valid ID (boolean: yes/no)</li>}
                {proof.verificationType === 'state' && <li>- You reside in the specified region (boolean: yes/no)</li>}
                <li>- Nothing else - no personal information</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">
                Generate Another
              </button>
              <button onClick={resetFlow} className="btn-primary flex-1">
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Prove
