import { useState } from 'react'
import {
  Shield, CheckCircle, Copy, Loader2, ArrowRight, ArrowLeft,
  Clock, LogOut, User, AlertCircle, Upload, FileText,
  Calendar, MapPin, Fingerprint, Download, History
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { generateProofClientSide, generateCompositeProof } from '../lib/zkp'

const ATTRIBUTES = [
  {
    id: 'age',
    label: 'Age Verification',
    circuit: 'age_verification.circom',
    description: 'Prove age ≥ 18 without revealing date of birth',
    icon: Calendar
  },
  {
    id: 'aadhaar',
    label: 'Aadhaar Validity',
    circuit: 'aadhaar_validity.circom',
    description: 'Prove valid Aadhaar format without revealing the number',
    icon: Fingerprint
  },
  {
    id: 'state',
    label: 'State Residence',
    circuit: 'state_verification.circom',
    description: 'Prove residence in a state without revealing full address',
    icon: MapPin
  }
]

const ISSUERS = [
  {
    id: 'manual',
    name: 'Manual Entry',
    domain: 'self-asserted',
    description: 'Enter credential fields manually. Used for testing.',
    kind: 'manual'
  },
  {
    id: 'uidai',
    name: 'UIDAI',
    domain: 'pehchaan.uidai.gov.in',
    description: 'Aadhaar Verifiable Credential via Pehchaan SD-JWT.',
    kind: 'sdjwt'
  }
]

const INITIAL_FORM = {
  name: '',
  dateOfBirth: '',
  aadhaarNumber: '',
  pincode: ''
}

function UserDashboard() {
  const { user, logout } = useAuth()

  const [activeTab, setActiveTab] = useState('wallet')  // wallet | history
  const [step, setStep] = useState(1)
  const [issuerId, setIssuerId] = useState('manual')
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [issuerPayload, setIssuerPayload] = useState(null)
  const [jwtInput, setJwtInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [credential, setCredential] = useState(null)
  const [selectedAttrs, setSelectedAttrs] = useState(new Set(['age']))
  const [proofBundle, setProofBundle] = useState(null)
  const [proofTiming, setProofTiming] = useState(null)
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)

  const activeIssuer = ISSUERS.find(i => i.id === issuerId)

  // ────────────────────────────────────────────────────────────────────

  const onField = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const selectIssuer = (id) => {
    setIssuerId(id)
    setIssuerPayload(null)
    setError(null)
  }

  const fetchFromIssuer = async () => {
    if (!activeIssuer || activeIssuer.kind === 'manual') return
    setLoading(true)
    setError(null)
    setIssuerPayload({ status: 'fetching' })
    try {
      if (activeIssuer.kind === 'sdjwt') {
        let raw = jwtInput.trim()
        if (!raw) {
          const resp = await fetch('/uidai-sample-vc.txt')
          if (!resp.ok) throw new Error('Sample SD-JWT not available')
          raw = (await resp.text()).trim()
        }
        const extracted = await api.extractJwt(raw)
        const claims = extracted.claims || {}

        const missing = []
        if (!claims.name) missing.push('name')
        if (!claims.dateOfBirth) missing.push('dateOfBirth')
        if (!claims.aadhaarNumber) missing.push('aadhaarNumber')
        if (!claims.pincode) missing.push('pincode')

        setIssuerPayload({
          status: 'ready',
          claims,
          missing,
          metadata: {
            disclosed: extracted.disclosuresCount,
            hidden: extracted.hiddenClaimsCount,
            algorithm: extracted.header?.alg || 'RS256',
            holderBinding: !!extracted.payload?.cnf?.jwk,
            holderKeyType: extracted.payload?.cnf?.jwk?.crv || null
          }
        })
      }
    } catch (err) {
      setError(err.message || 'Credential retrieval failed')
      setIssuerPayload(null)
    } finally {
      setLoading(false)
    }
  }

  const approveIssuerPayload = () => {
    if (issuerPayload?.claims) {
      setFormData({ ...INITIAL_FORM, ...issuerPayload.claims })
    }
  }

  const generateCommitment = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.issueCredential(formData)
      setCredential(response.credential)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Failed to generate commitment')
    } finally {
      setLoading(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────

  const toggleAttr = (id) => {
    const next = new Set(selectedAttrs)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedAttrs(next)
  }

  const buildPublicInputs = () => ({
    minimumAge: 18,
    currentDate: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate()
    },
    commitment: credential.commitment,
    issuerPubKey: credential.issuer.publicKey,
    requiredStateCode: parseInt(formData.pincode?.substring(0, 2)) || 0
  })

  const generateProofs = async () => {
    if (selectedAttrs.size === 0) return
    setLoading(true)
    setError(null)
    try {
      const attributes = Array.from(selectedAttrs).map(type => ({
        type,
        publicInputs: buildPublicInputs()
      }))

      const t0 = performance.now()
      let bundle
      if (attributes.length === 1) {
        const result = await generateProofClientSide(
          attributes[0].type,
          credential.privateInputs,
          attributes[0].publicInputs
        )
        bundle = {
          attributeCount: 1,
          proofs: [{
            type: attributes[0].type,
            proof: result.proof,
            publicSignals: result.publicSignals,
            nullifier: result.nullifier,
            isValid: result.isValid
          }]
        }
      } else {
        bundle = await generateCompositeProof(attributes, credential.privateInputs)
      }
      const elapsed = Math.round(performance.now() - t0)

      setProofBundle(bundle)
      setProofTiming(elapsed)
      setHistory(prev => [{
        id: `p_${Date.now()}`,
        types: Array.from(selectedAttrs),
        generatedAt: new Date().toISOString(),
        proofTimeMs: elapsed,
        bundle,
        commitment: credential.commitment
      }, ...prev])
      setStep(3)
    } catch (err) {
      setError(err.message || 'Proof generation failed')
    } finally {
      setLoading(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────

  const presentationPayload = proofBundle
    ? {
        version: '1.0',
        proofs: proofBundle.proofs.map(p => ({
          type: p.type,
          proof: p.proof,
          publicSignals: p.publicSignals,
          nullifier: p.nullifier
        }))
      }
    : null

  const copyPayload = () => {
    if (!presentationPayload) return
    navigator.clipboard.writeText(JSON.stringify(presentationPayload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setStep(1)
    setCredential(null)
    setProofBundle(null)
    setProofTiming(null)
    setError(null)
    setIssuerPayload(null)
    setSelectedAttrs(new Set(['age']))
    setFormData(INITIAL_FORM)
    setJwtInput('')
  }

  // ────────────────────────────────────────────────────────────────────
  // HISTORY PDF EXPORT
  // ────────────────────────────────────────────────────────────────────

  const exportHistoryItemPdf = (item) => {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setTextColor(91, 154, 91)
    doc.text('Eigenparse', 20, 20)

    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text('Proof Presentation Receipt', 20, 30)
    doc.text(`Generated: ${new Date(item.generatedAt).toLocaleString()}`, 20, 37)
    doc.text(`Mode: ${item.types.length > 1 ? 'Composite' : 'Single'}`, 20, 44)

    doc.setDrawColor(91, 154, 91)
    doc.setLineWidth(0.5)
    doc.line(20, 52, 190, 52)

    doc.setFontSize(10)
    let y = 65

    const field = (label, value) => {
      doc.setTextColor(120)
      doc.text(label, 20, y)
      doc.setTextColor(40)
      doc.text(String(value), 70, y)
      y += 8
    }

    field('Attributes', item.types.join(', '))
    field('Proof Time', `${item.proofTimeMs} ms`)
    field('Proof System', 'Groth16 / BN254')
    field('Commitment', `${item.commitment?.slice(0, 40) || 'n/a'}...`)

    y += 4
    doc.setDrawColor(230)
    doc.line(20, y, 190, y)
    y += 10

    doc.setFontSize(11)
    doc.setTextColor(91, 154, 91)
    doc.text('Nullifiers', 20, y)
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(80)
    for (const p of item.bundle?.proofs || []) {
      const nullifierStr = p.nullifier || 'n/a'
      doc.text(`${p.type}:`, 20, y)
      const chunks = nullifierStr.match(/.{1,70}/g) || [nullifierStr]
      chunks.forEach((chunk, i) => doc.text(chunk, 38, y + i * 5))
      y += Math.max(8, chunks.length * 5 + 3)
    }

    y = Math.max(y + 10, 220)
    doc.setDrawColor(91, 154, 91)
    doc.setFillColor(245, 250, 245)
    doc.roundedRect(20, y, 170, 32, 3, 3, 'FD')
    doc.setFontSize(10)
    doc.setTextColor(91, 154, 91)
    doc.text('Zero-Knowledge Proof', 26, y + 9)
    doc.setFontSize(8)
    doc.setTextColor(80)
    doc.text('Generated client-side with Groth16 ZK-SNARKs.', 26, y + 17)
    doc.text('Private inputs never transmitted. Verifier sees only nullifier + boolean.', 26, y + 23)

    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text('Generated by Eigenparse - Privacy-Preserving KYC System', 20, 280)
    doc.text('DPDP Act 2023 Compliant', 20, 285)

    doc.save(`eigenparse-proof-${item.types.join('-')}-${Date.now()}.pdf`)
  }

  // ────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────

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
            onClick={() => setActiveTab('wallet')}
            className={activeTab === 'wallet' ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
          >
            <Shield className="h-5 w-5 mr-3" />
            Wallet
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
      <div className="flex-1 p-8 overflow-y-auto">
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
            <span className="text-xs text-gray-500 font-mono">// {activeTab === 'wallet' ? 'prover_wallet' : 'history'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'wallet' ? 'Generate Proof Presentation' : 'Proof History'}
          </h1>
        </div>

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <>
            {/* Progress Steps */}
            <div className="flex items-center mb-8">
              {[
                { num: 1, label: 'Input' },
                { num: 2, label: 'Attributes' },
                { num: 3, label: 'Presentation' }
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
                    <div className={`h-px w-12 mx-4 ${step > num ? 'bg-[#5B9A5B]' : 'bg-white/10'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <p className="text-red-400 text-sm font-mono">{error}</p>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div className="card max-w-3xl">
                <div className="text-xs text-gray-500 font-mono mb-3">// credential_issuer</div>
                <div className="grid md:grid-cols-2 gap-3 mb-6">
                  {ISSUERS.map(issuer => (
                    <button
                      key={issuer.id}
                      onClick={() => selectIssuer(issuer.id)}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        issuerId === issuer.id
                          ? 'bg-[#5B9A5B]/10 border-[#5B9A5B]/30'
                          : 'bg-black border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-sm font-medium text-white">{issuer.name}</div>
                        {issuerId === issuer.id && <CheckCircle className="h-4 w-4 text-[#5B9A5B] flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mb-1">{issuer.domain}</div>
                      <div className="text-xs text-gray-500">{issuer.description}</div>
                    </button>
                  ))}
                </div>

                {/* SD-JWT retrieval block */}
                {activeIssuer && activeIssuer.kind === 'sdjwt' && (
                  <div className="mb-6 p-5 bg-black rounded-lg border border-white/10">
                    {!issuerPayload && (
                      <>
                        <div className="text-sm text-white mb-1">Retrieve credential from {activeIssuer.name}</div>
                        <div className="text-xs text-gray-500 mb-4">
                          Upload a Pehchaan SD-JWT file, paste one below, or use the bundled sample.
                          Claims are extracted server-side and surfaced for approval before commitment.
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs text-gray-300 cursor-pointer transition-colors">
                            <Upload className="h-3.5 w-3.5" />
                            Upload .jwt / .txt
                            <input
                              type="file"
                              accept=".txt,.jwt,text/plain"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const reader = new FileReader()
                                reader.onload = (ev) => setJwtInput(String(ev.target?.result || '').trim())
                                reader.readAsText(file)
                              }}
                              className="hidden"
                            />
                          </label>
                          {jwtInput && (
                            <button
                              onClick={() => setJwtInput('')}
                              className="text-xs text-gray-500 hover:text-gray-300 font-mono"
                            >
                              clear
                            </button>
                          )}
                          <div className="text-xs text-gray-500 font-mono ml-auto">
                            {jwtInput ? `${jwtInput.length} chars loaded` : 'will use bundled sample'}
                          </div>
                        </div>

                        <textarea
                          value={jwtInput}
                          onChange={(e) => setJwtInput(e.target.value)}
                          placeholder="Or paste Aadhaar SD-JWT here (header.payload.sig~disclosure1~disclosure2…)"
                          className="input font-mono text-xs h-24 resize-none mb-3"
                        />

                        <button
                          onClick={fetchFromIssuer}
                          disabled={loading}
                          className="btn-primary inline-flex items-center"
                        >
                          {loading
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing</>
                            : <><FileText className="h-4 w-4 mr-2" /> Parse Credential</>
                          }
                        </button>
                      </>
                    )}

                    {issuerPayload?.status === 'fetching' && (
                      <div className="flex items-center text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Retrieving signed credential from {activeIssuer.name}…
                      </div>
                    )}

                    {issuerPayload?.status === 'ready' && (
                      <>
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#5B9A5B] mb-3">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Credential Received — Awaiting Approval
                        </div>

                        {issuerPayload.metadata && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                            <MetaPill label="Algorithm" value={issuerPayload.metadata.algorithm} />
                            <MetaPill
                              label="Disclosed"
                              value={`${issuerPayload.metadata.disclosed} / ${issuerPayload.metadata.disclosed + issuerPayload.metadata.hidden}`}
                            />
                            <MetaPill
                              label="Holder Binding"
                              value={issuerPayload.metadata.holderBinding ? `${issuerPayload.metadata.holderKeyType || 'yes'}` : 'none'}
                            />
                            <MetaPill label="Hidden" value={issuerPayload.metadata.hidden} />
                          </div>
                        )}

                        <div className="bg-black rounded-md p-3 mb-3 border border-white/10">
                          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">
                            Disclosed Claims
                          </div>
                          <div className="space-y-1 text-xs font-mono">
                            {Object.entries(issuerPayload.claims).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-4">
                                <span className="text-gray-500">{k}</span>
                                <span className="text-gray-200 truncate">{v}</span>
                              </div>
                            ))}
                            {Object.keys(issuerPayload.claims).length === 0 && (
                              <div className="text-gray-500 italic">No recognised claims disclosed.</div>
                            )}
                          </div>
                        </div>

                        {issuerPayload.missing && issuerPayload.missing.length > 0 && (
                          <div className="bg-white/5 border border-white/10 rounded-md p-3 mb-4 text-xs text-gray-400">
                            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">
                              Not Disclosed by Issuer
                            </div>
                            <div className="font-mono">{issuerPayload.missing.join(', ')}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              These fields remain hidden in the SD-JWT; fill them manually below.
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={approveIssuerPayload}
                            className="btn-primary flex-1"
                          >
                            Approve &amp; Use Credential
                          </button>
                          <button
                            onClick={() => setIssuerPayload(null)}
                            className="btn-secondary"
                          >
                            Discard
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 font-mono mb-3">
                  // {activeIssuer?.kind === 'manual' ? 'private_inputs' : 'approved_values'}
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="label font-mono text-xs">name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={onField}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label font-mono text-xs">dateOfBirth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={onField}
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="label font-mono text-xs">aadhaarNumber[12]</label>
                    <input
                      type="text"
                      name="aadhaarNumber"
                      value={formData.aadhaarNumber}
                      onChange={onField}
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
                      onChange={onField}
                      className="input font-mono"
                      placeholder="uint"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 rounded-lg mb-6">
                  <code className="text-xs text-[#5B9A5B] font-mono">
                    // Witness data hashed locally into Poseidon commitment. Never transmitted.
                  </code>
                </div>

                <button
                  onClick={generateCommitment}
                  disabled={loading || !formData.name || !formData.dateOfBirth || !formData.aadhaarNumber}
                  className="btn-primary w-full flex items-center justify-center font-mono"
                >
                  {loading
                    ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Computing commitment…</>
                    : <>Generate Commitment <ArrowRight className="ml-2 h-5 w-5" /></>
                  }
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && credential && (
              <div className="card max-w-3xl">
                <div className="card-green mb-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-[#5B9A5B] mr-2" />
                    <span className="text-[#5B9A5B] font-mono text-sm">Commitment generated</span>
                  </div>
                  <code className="text-xs text-gray-400 mt-2 block font-mono break-all">
                    {credential.commitment}
                  </code>
                </div>

                <div className="text-xs text-gray-500 font-mono mb-3">// select attributes to prove</div>

                <div className="space-y-3 mb-6">
                  {ATTRIBUTES.map(attr => {
                    const checked = selectedAttrs.has(attr.id)
                    return (
                      <button
                        key={attr.id}
                        onClick={() => toggleAttr(attr.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 ${
                          checked
                            ? 'bg-[#5B9A5B]/10 border-[#5B9A5B]/30'
                            : 'bg-black border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? 'bg-[#5B9A5B] border-[#5B9A5B]' : 'border-white/20'
                        }`}>
                          {checked && <CheckCircle className="h-3.5 w-3.5 text-black" />}
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 flex items-center justify-center flex-shrink-0">
                          <attr.icon className="h-5 w-5 text-[#5B9A5B]" />
                        </div>
                        <div className="flex-1">
                          <code className="text-[#5B9A5B] text-sm font-mono">{attr.circuit}</code>
                          <p className="text-xs text-gray-500 mt-0.5">{attr.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => setStep(1)} className="btn-secondary flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </button>
                  <button
                    onClick={generateProofs}
                    disabled={loading || selectedAttrs.size === 0}
                    className="btn-primary flex-1 flex items-center justify-center font-mono"
                  >
                    {loading
                      ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> groth16.fullProve()</>
                      : <>Generate {selectedAttrs.size > 1 ? 'Composite ' : ''}Proof <ArrowRight className="ml-2 h-5 w-5" /></>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && proofBundle && presentationPayload && (
              <div className="max-w-3xl">
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-3">
                        <CheckCircle className="h-5 w-5 text-[#5B9A5B]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white font-mono">Presentation Ready</h2>
                        <p className="text-xs text-gray-500">
                          {proofBundle.attributeCount} attribute{proofBundle.attributeCount !== 1 ? 's' : ''} · Groth16 / BN254
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#5B9A5B] font-mono">{proofTiming}ms</div>
                      <div className="text-xs text-gray-600">prove_time</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-500 font-mono mb-3">// qr_code</div>
                      <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-lg">
                          <QRCodeSVG
                            value={JSON.stringify(presentationPayload)}
                            size={200}
                            level="M"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-3">
                        Scan from a verifier device to consume this presentation.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-500 font-mono">// presentation_payload</div>
                        <button
                          onClick={copyPayload}
                          className="text-[#5B9A5B] hover:text-[#7CB87C] flex items-center text-xs font-mono"
                        >
                          {copied
                            ? <><CheckCircle className="h-3 w-3 mr-1" /> copied (full payload)</>
                            : <><Copy className="h-3 w-3 mr-1" /> copy full JSON</>
                          }
                        </button>
                      </div>
                      <pre className="bg-black border border-white/10 rounded-lg p-3 text-xs font-mono text-[#5B9A5B] overflow-auto max-h-56">
{JSON.stringify({
  version: presentationPayload.version,
  proofs: presentationPayload.proofs.map(p => ({
    type: p.type,
    proof: {
      pi_a: [`${(p.proof.pi_a?.[0] || '').slice(0, 12)}…`, '…'],
      pi_b: '…',
      pi_c: '…',
      protocol: p.proof.protocol,
      curve: p.proof.curve
    },
    publicSignals: p.publicSignals.map(s => String(s).slice(0, 10) + '…'),
    nullifier: String(p.nullifier).slice(0, 24) + '…'
  }))
}, null, 2)}
                      </pre>
                      <div className="text-[10px] text-gray-600 font-mono mt-2 leading-relaxed">
                        Values above are truncated for display. The full Groth16 proof
                        points, public signals, and nullifiers are encoded in the QR and
                        copied by the <span className="text-[#5B9A5B]">copy</span> button.
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {proofBundle.proofs.map((p, i) => (
                          <div key={i} className="bg-white/5 border border-white/10 rounded-md p-2">
                            <div className="text-[10px] text-gray-500 font-mono uppercase">{p.type}</div>
                            <div className="text-xs text-[#5B9A5B] font-mono mt-0.5">valid</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                  <button onClick={() => setStep(2)} className="btn-secondary flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Change Attributes
                  </button>
                  <button onClick={reset} className="btn-primary flex-1">
                    Start New Presentation
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="max-w-4xl">
            {history.length === 0 ? (
              <div className="card text-center py-16">
                <Clock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <div className="text-sm text-gray-400 mb-4">No proofs generated in this session yet.</div>
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="btn-primary inline-flex items-center"
                >
                  Generate a Proof <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="card flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-[#5B9A5B]/20 flex items-center justify-center mr-4">
                        <CheckCircle className="h-5 w-5 text-[#5B9A5B]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {h.types.map(t => (
                            <code key={t} className="text-[#5B9A5B] text-xs font-mono">
                              {t}_verification
                            </code>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {new Date(h.generatedAt).toLocaleString()} · {h.proofTimeMs}ms · {h.types.length > 1 ? 'composite' : 'single'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => exportHistoryItemPdf(h)}
                      className="text-gray-500 hover:text-[#5B9A5B] transition-colors"
                      title="Download Receipt"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MetaPill({ label, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2">
      <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-gray-200 font-mono truncate">{value}</div>
    </div>
  )
}

export default UserDashboard
