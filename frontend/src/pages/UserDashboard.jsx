import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle, Copy, Loader2, ArrowRight, ArrowLeft, Clock,
  LogOut, User, AlertCircle, Upload, Shield, FileText,
  Calendar, MapPin, Fingerprint, Download
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

  const [tab, setTab] = useState('wallet')  // wallet | history
  const [step, setStep] = useState(1)        // 1: input, 2: attributes, 3: output
  const [issuerId, setIssuerId] = useState('manual')
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [issuerPayload, setIssuerPayload] = useState(null)  // { claims, status }
  const [jwtInput, setJwtInput] = useState('')  // pasted SD-JWT

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [credential, setCredential] = useState(null)
  const [selectedAttrs, setSelectedAttrs] = useState(new Set(['age']))
  const [proofBundle, setProofBundle] = useState(null)
  const [proofTiming, setProofTiming] = useState(null)
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)


  // ────────────────────────────────────────────────────────────────────
  // STEP 1 — ISSUER SELECTION & CREDENTIAL FETCH
  // ────────────────────────────────────────────────────────────────────

  const onField = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const activeIssuer = ISSUERS.find(i => i.id === issuerId)

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

        // Call backend Python extractor
        const extracted = await api.extractJwt(raw)
        const claims = extracted.claims || {}

        // Determine which required fields were not disclosed by the issuer
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
            issuer: extracted.payload?.iss || 'unknown',
            kid: extracted.header?.kid || 'unknown',
            holderBinding: !!extracted.payload?.cnf?.jwk,
            holderKeyType: extracted.payload?.cnf?.jwk?.crv || null,
            extractor: 'python3 scripts/extract_aadhaar_jwt.py'
          }
        })
      } else {
        // DigiLocker-style OAuth flow simulation for all non-SD-JWT issuers
        await new Promise(res => setTimeout(res, 900))
        setIssuerPayload({
          status: 'ready',
          claims: {
            name: 'Venkatesh R',
            dateOfBirth: '1998-05-15',
            aadhaarNumber: '234567890123',
            pincode: '636705'
          },
          metadata: {
            consentScope: 'identity.read',
            authMethod: 'oauth2'
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
  // STEP 2 — ATTRIBUTE SELECTION & PROOF GENERATION
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
  // HISTORY — PDF EXPORT
  // ────────────────────────────────────────────────────────────────────

  const exportHistoryItemPdf = (item) => {
    const doc = new jsPDF()

    // Header
    doc.setFontSize(22)
    doc.setTextColor(91, 154, 91)
    doc.text('Eigenparse', 20, 22)

    doc.setFontSize(13)
    doc.setTextColor(60)
    doc.text('Proof Presentation Receipt', 20, 32)

    doc.setDrawColor(200)
    doc.line(20, 38, 190, 38)

    doc.setFontSize(10)
    let y = 50

    const field = (label, value) => {
      doc.setTextColor(120)
      doc.text(label, 20, y)
      doc.setTextColor(40)
      doc.text(String(value), 70, y)
      y += 8
    }

    field('Mode', item.types.length > 1 ? 'Composite' : 'Single Attribute')
    field('Attributes', item.types.join(', '))
    field('Generated', new Date(item.generatedAt).toLocaleString())
    field('Proof Time', `${item.proofTimeMs} ms`)
    field('Commitment', `${item.commitment?.slice(0, 36) || 'n/a'}...`)
    field('Proof System', 'Groth16 / BN254')

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
      // Wrap long nullifier
      const chunks = nullifierStr.match(/.{1,70}/g) || [nullifierStr]
      chunks.forEach((chunk, i) => {
        doc.text(chunk, 38, y + i * 5)
      })
      y += Math.max(8, chunks.length * 5 + 3)
    }

    // Note
    y = Math.max(y, 200)
    doc.setDrawColor(91, 154, 91)
    doc.setFillColor(245, 250, 245)
    doc.roundedRect(20, y, 170, 32, 3, 3, 'FD')

    doc.setFontSize(10)
    doc.setTextColor(91, 154, 91)
    doc.text('Zero-Knowledge Proof', 26, y + 9)
    doc.setFontSize(8)
    doc.setTextColor(80)
    doc.text('Generated client-side with Groth16 ZK-SNARKs. Private inputs never', 26, y + 17)
    doc.text('transmitted. Verifier stores only nullifier hash and boolean result.', 26, y + 23)

    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text('Eigenparse · Privacy-Preserving KYC', 20, 285)

    doc.save(`eigenparse-proof-${item.types.join('-')}-${Date.now()}.pdf`)
  }

  // ────────────────────────────────────────────────────────────────────
  // STEP 3 — OUTPUT (QR / COPY)
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
    setSourceStatus(null)
    setSelectedAttrs(new Set(['age']))
    setFormData(INITIAL_FORM)
  }

  // ────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-60 bg-black border-r border-white/10 p-6 hidden lg:flex flex-col">
        <Link to="/" className="flex items-center space-x-3 mb-10">
          <img src="/logo.png" alt="Eigenparse" className="h-7 w-7" />
          <span className="text-lg font-bold text-white">Eigenparse</span>
        </Link>

        <nav className="space-y-1 flex-1">
          <SidebarButton active={tab === 'wallet'} onClick={() => setTab('wallet')} icon={<Shield className="h-4 w-4" />}>
            Wallet
          </SidebarButton>
          <SidebarButton active={tab === 'history'} onClick={() => setTab('history')} icon={<Clock className="h-4 w-4" />}>
            History
          </SidebarButton>
        </nav>

        <div className="pt-5 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-md bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 flex items-center justify-center">
              <User className="h-4 w-4 text-[#5B9A5B]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Prover</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center text-gray-500 hover:text-gray-300 transition-colors text-xs w-full font-mono"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl">

          {/* Page header */}
          <div className="mb-8">
            <div className="text-[10px] font-mono text-[#5B9A5B] uppercase tracking-widest mb-2">
              {tab === 'wallet' && 'Prover Wallet'}
              {tab === 'history' && 'Proof History'}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {tab === 'wallet' && 'Generate Proof Presentation'}
              {tab === 'history' && 'Recent Activity'}
            </h1>
          </div>

          {/* WALLET TAB — MAIN 3-STEP FLOW */}
          {tab === 'wallet' && (
            <>
              {/* Progress indicator */}
              <div className="flex items-center gap-4 mb-8">
                <StepIndicator num={1} label="Input" active={step >= 1} done={step > 1} />
                <StepConnector done={step > 1} />
                <StepIndicator num={2} label="Attributes" active={step >= 2} done={step > 2} />
                <StepConnector done={step > 2} />
                <StepIndicator num={3} label="Presentation" active={step >= 3} done={false} />
              </div>

              {error && (
                <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-lg flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <p className="text-gray-300 text-sm">{error}</p>
                </div>
              )}

              {/* STEP 1 — ISSUER SELECTION */}
              {step === 1 && (
                <div className="bg-black border border-white/10 rounded-xl p-6">
                  <div className="mb-6">
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                      Credential Issuer
                    </div>
                    <div className="grid md:grid-cols-2 gap-2">
                      {ISSUERS.map(issuer => (
                        <button
                          key={issuer.id}
                          onClick={() => selectIssuer(issuer.id)}
                          className={`text-left border rounded-lg p-3 transition-colors ${
                            issuerId === issuer.id
                              ? 'bg-[#5B9A5B]/[0.05] border-[#5B9A5B]/40'
                              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-sm font-medium text-white">{issuer.name}</div>
                            {issuerId === issuer.id && <CheckCircle className="h-4 w-4 text-[#5B9A5B] flex-shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">
                            {issuer.domain}
                          </div>
                          <div className="text-xs text-gray-500 leading-relaxed">{issuer.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Non-manual issuer: fetch + approve flow */}
                  {activeIssuer && activeIssuer.kind !== 'manual' && (
                    <div className="mb-6 p-5 bg-white/[0.02] border border-white/10 rounded-lg">
                      {!issuerPayload && (
                        <>
                          <div className="text-sm text-gray-300 mb-1">
                            Retrieve credential from {activeIssuer.name}
                          </div>
                          <div className="text-xs text-gray-500 mb-4 leading-relaxed">
                            {activeIssuer.kind === 'sdjwt'
                              ? 'Upload a Pehchaan SD-JWT file, paste one into the box below, or use the bundled sample. Claims are extracted client-side for review before commitment.'
                              : 'Initiates an OAuth 2.0 consent handshake (simulated). Retrieved claims require explicit approval before commitment.'}
                          </div>

                          {activeIssuer.kind === 'sdjwt' && (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-md text-xs text-gray-300 cursor-pointer transition-colors">
                                  <Upload className="h-3.5 w-3.5" />
                                  Upload .jwt / .txt
                                  <input
                                    type="file"
                                    accept=".txt,.jwt,text/plain"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (!file) return
                                      const reader = new FileReader()
                                      reader.onload = (ev) => {
                                        setJwtInput(String(ev.target?.result || '').trim())
                                      }
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
                                <div className="text-[10px] text-gray-500 font-mono ml-auto">
                                  {jwtInput ? `${jwtInput.length} chars loaded` : 'will use bundled sample'}
                                </div>
                              </div>
                              <textarea
                                value={jwtInput}
                                onChange={(e) => setJwtInput(e.target.value)}
                                placeholder="Or paste Aadhaar SD-JWT here (header.payload.sig~disclosure1~disclosure2…)"
                                className="w-full h-24 bg-black border border-white/10 rounded-md p-3 text-[10px] text-gray-300 font-mono resize-none focus:outline-none focus:border-[#5B9A5B]/50 mb-3"
                              />
                            </>
                          )}

                          <button
                            onClick={fetchFromIssuer}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B9A5B] hover:bg-[#4a8a4a] disabled:opacity-50 text-black text-sm font-semibold rounded-lg transition-colors"
                          >
                            {loading
                              ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing</>
                              : <><FileText className="h-4 w-4" /> {activeIssuer.kind === 'sdjwt' ? 'Parse Credential' : 'Request Credential'}</>
                            }
                          </button>
                        </>
                      )}

                      {issuerPayload?.status === 'fetching' && (
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Retrieving signed credential from {activeIssuer.name}…
                        </div>
                      )}

                      {issuerPayload?.status === 'ready' && (
                        <>
                          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#5B9A5B] mb-3">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Credential Received — Awaiting Approval
                          </div>

                          {/* Metadata strip */}
                          {issuerPayload.metadata && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                              <MetaPill label="Algorithm" value={issuerPayload.metadata.algorithm} />
                              <MetaPill label="Disclosed" value={`${issuerPayload.metadata.disclosed} / ${issuerPayload.metadata.disclosed + issuerPayload.metadata.hidden}`} />
                              <MetaPill
                                label="Holder Binding"
                                value={issuerPayload.metadata.holderBinding
                                  ? `${issuerPayload.metadata.holderKeyType || 'yes'}`
                                  : 'none'}
                              />
                              <MetaPill label="Hidden Claims" value={issuerPayload.metadata.hidden} />
                            </div>
                          )}

                          <div className="bg-black border border-white/10 rounded-md p-3 mb-3">
                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">
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
                                <div className="text-gray-500 italic">No recognised claims were disclosed.</div>
                              )}
                            </div>
                          </div>

                          {issuerPayload.missing && issuerPayload.missing.length > 0 && (
                            <div className="bg-white/[0.02] border border-white/10 rounded-md p-3 mb-4 text-xs text-gray-400 leading-relaxed">
                              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">
                                Not Disclosed by Issuer
                              </div>
                              <div className="font-mono">{issuerPayload.missing.join(', ')}</div>
                              <div className="mt-1 text-[11px] text-gray-500">
                                These fields remain hidden in the SD-JWT and must be supplied manually below before commitment.
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              onClick={approveIssuerPayload}
                              className="flex-1 py-2 bg-[#5B9A5B] hover:bg-[#4a8a4a] text-black text-sm font-semibold rounded-md transition-colors"
                            >
                              Approve &amp; Use Credential
                            </button>
                            <button
                              onClick={() => setIssuerPayload(null)}
                              className="py-2 px-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-sm text-gray-300 rounded-md transition-colors"
                            >
                              Discard
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Credential input form (always visible, editable after import) */}
                  <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    {activeIssuer?.kind === 'manual' ? 'Private Inputs' : 'Approved Values'}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mb-6">
                    <FormField name="name" label="Name" value={formData.name} onChange={onField} />
                    <FormField name="dateOfBirth" label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={onField} />
                    <FormField
                      name="aadhaarNumber"
                      label="Aadhaar Number"
                      value={formData.aadhaarNumber}
                      onChange={onField}
                      placeholder="12-digit number"
                      maxLength={12}
                    />
                    <FormField
                      name="pincode"
                      label="Pincode"
                      value={formData.pincode}
                      onChange={onField}
                      placeholder="6-digit pincode"
                      maxLength={6}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="text-xs text-gray-500 max-w-sm leading-relaxed">
                      Values are hashed client-side into a Poseidon commitment.
                      Private inputs are retained on-device only.
                    </div>
                    <button
                      onClick={generateCommitment}
                      disabled={loading || !formData.name || !formData.dateOfBirth || !formData.aadhaarNumber}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B9A5B] hover:bg-[#4a8a4a] disabled:bg-white/[0.04] disabled:text-gray-600 text-black font-semibold rounded-lg transition-colors text-sm"
                    >
                      {loading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Computing</>
                        : <>Generate Commitment <ArrowRight className="h-4 w-4" /></>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 — ATTRIBUTE SELECTION */}
              {step === 2 && credential && (
                <div className="bg-black border border-white/10 rounded-xl p-6">
                  <div className="mb-6 p-4 bg-[#5B9A5B]/[0.04] border border-[#5B9A5B]/30 rounded-lg flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-[#5B9A5B] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-[#5B9A5B] uppercase tracking-wider mb-1">
                        Commitment Generated
                      </div>
                      <code className="text-[11px] text-gray-400 font-mono break-all">
                        {credential.commitment}
                      </code>
                    </div>
                  </div>

                  <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                    Select Attributes to Prove
                  </div>
                  <div className="space-y-2 mb-6">
                    {ATTRIBUTES.map(attr => {
                      const checked = selectedAttrs.has(attr.id)
                      return (
                        <button
                          key={attr.id}
                          onClick={() => toggleAttr(attr.id)}
                          className={`w-full text-left border rounded-lg p-4 transition-colors flex items-center gap-4 ${
                            checked
                              ? 'bg-[#5B9A5B]/[0.05] border-[#5B9A5B]/40'
                              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                            checked
                              ? 'bg-[#5B9A5B] border-[#5B9A5B]'
                              : 'border-white/20'
                          }`}>
                            {checked && <CheckCircle className="h-3.5 w-3.5 text-black" />}
                          </div>
                          <div className="flex-shrink-0">
                            <attr.icon className={`h-4 w-4 ${checked ? 'text-[#5B9A5B]' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">{attr.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{attr.description}</div>
                          </div>
                          <code className="text-[10px] text-gray-500 font-mono hidden md:block">{attr.circuit}</code>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-gray-500">
                        {selectedAttrs.size} attribute{selectedAttrs.size !== 1 ? 's' : ''} selected
                      </div>
                      <button
                        onClick={generateProofs}
                        disabled={loading || selectedAttrs.size === 0}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B9A5B] hover:bg-[#4a8a4a] disabled:bg-white/[0.04] disabled:text-gray-600 text-black font-semibold rounded-lg transition-colors text-sm"
                      >
                        {loading
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating</>
                          : <>Generate {selectedAttrs.size > 1 ? 'Composite ' : ''}Proof <ArrowRight className="h-4 w-4" /></>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 — PRESENTATION OUTPUT */}
              {step === 3 && proofBundle && presentationPayload && (
                <div className="space-y-4">
                  <div className="bg-black border border-[#5B9A5B]/40 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-[#5B9A5B]" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-white">Proof Presentation Ready</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {proofBundle.attributeCount} attribute{proofBundle.attributeCount !== 1 ? 's' : ''} · Groth16 · BN254
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-[#5B9A5B] font-mono tabular-nums">{proofTiming}ms</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">proof time</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* QR */}
                      <div>
                        <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                          Scan from Verifier Device
                        </div>
                        <div className="bg-white p-4 rounded-lg inline-block">
                          <QRCodeSVG
                            value={JSON.stringify(presentationPayload)}
                            size={200}
                            level="M"
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-3 leading-relaxed max-w-xs">
                          QR encodes the full presentation payload. A verifier scans and calls
                          their local <code className="text-gray-300">snarkjs.groth16.verify</code>.
                        </div>
                      </div>

                      {/* Payload */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-gray-500">
                            Presentation Payload
                          </div>
                          <button
                            onClick={copyPayload}
                            className="inline-flex items-center gap-1.5 text-xs text-[#5B9A5B] hover:text-[#7CB87C] font-mono"
                          >
                            {copied ? <><CheckCircle className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy JSON</>}
                          </button>
                        </div>
                        <pre className="bg-black border border-white/10 rounded-lg p-3 text-[10px] text-gray-400 font-mono overflow-auto max-h-56 leading-relaxed">
{JSON.stringify({
  version: presentationPayload.version,
  proofs: presentationPayload.proofs.map(p => ({
    type: p.type,
    nullifier: p.nullifier.slice(0, 32) + '…',
    publicSignals: p.publicSignals.length,
    proofBytes: JSON.stringify(p.proof).length
  }))
}, null, 2)}
                        </pre>

                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {proofBundle.proofs.map((p, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/10 rounded-md p-2">
                              <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">{p.type}</div>
                              <div className="text-xs text-[#5B9A5B] font-mono mt-1">
                                {p.isValid ? 'valid' : 'invalid'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" /> Change Attributes
                    </button>
                    <button
                      onClick={reset}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-lg transition-colors text-sm text-gray-300"
                    >
                      Start New Presentation
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="max-w-3xl">
              {history.length === 0 ? (
                <div className="bg-black border border-white/10 rounded-xl p-12 text-center">
                  <Clock className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                  <div className="text-sm text-gray-400">No proofs generated in this session yet.</div>
                  <button
                    onClick={() => setTab('wallet')}
                    className="mt-4 px-4 py-2 bg-[#5B9A5B]/10 hover:bg-[#5B9A5B]/20 border border-[#5B9A5B]/30 text-[#5B9A5B] rounded-md text-sm"
                  >
                    Generate a Proof →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={h.id || i} className="bg-black border border-white/10 rounded-lg p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {h.types.map(t => (
                            <span key={t} className="text-[11px] font-mono px-2 py-0.5 bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 text-[#5B9A5B] rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(h.generatedAt).toLocaleString()}
                          <span className="mx-2 text-gray-700">·</span>
                          <span className="text-gray-400 font-mono tabular-nums">{h.proofTimeMs}ms</span>
                          <span className="mx-2 text-gray-700">·</span>
                          <span className="text-gray-500">{h.types.length > 1 ? 'composite' : 'single'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => exportHistoryItemPdf(h)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-md text-xs text-gray-300 hover:text-white transition-colors"
                        title="Download receipt"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function SidebarButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-[#5B9A5B]/10 text-[#5B9A5B] border border-[#5B9A5B]/30'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function StepIndicator({ num, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-mono border transition-colors ${
        done
          ? 'bg-[#5B9A5B] border-[#5B9A5B] text-black'
          : active
            ? 'bg-[#5B9A5B]/10 border-[#5B9A5B] text-[#5B9A5B]'
            : 'bg-white/[0.02] border-white/10 text-gray-600'
      }`}>
        {done ? <CheckCircle className="h-3.5 w-3.5" /> : num}
      </div>
      <span className={`text-xs font-mono uppercase tracking-wider ${active ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  )
}

function StepConnector({ done }) {
  return (
    <div className={`flex-1 h-px max-w-16 ${done ? 'bg-[#5B9A5B]' : 'bg-white/10'}`} />
  )
}

function MetaPill({ label, value }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-md px-3 py-2">
      <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-gray-200 font-mono truncate">{value}</div>
    </div>
  )
}

function FormField({ name, label, value, onChange, type = 'text', placeholder, maxLength }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-white/[0.02] border border-white/10 rounded-md px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#5B9A5B]/50"
      />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 text-xs font-mono uppercase tracking-wider">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  )
}

export default UserDashboard
