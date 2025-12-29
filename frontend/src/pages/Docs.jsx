import { Book, Code, Shield, Zap, Lock, Server, Terminal, FileCode, ExternalLink } from 'lucide-react'

function Docs() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-6">
            <Book className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-gray-300">Documentation</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">How Eigenparse Works</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Technical overview of our zero-knowledge proof system
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              <h3 className="text-white font-semibold mb-4">Contents</h3>
              <nav className="space-y-2">
                {[
                  { href: '#overview', label: 'Overview' },
                  { href: '#how-it-works', label: 'How It Works' },
                  { href: '#proof-types', label: 'Proof Types' },
                  { href: '#api', label: 'API Reference' },
                  { href: '#security', label: 'Security' },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block text-sm text-gray-400 hover:text-cyan-400 transition-colors py-1"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-12">
            {/* Overview */}
            <section id="overview">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Shield className="h-6 w-6 text-cyan-400 mr-3" />
                Overview
              </h2>
              <div className="card">
                <p className="text-gray-300 mb-4">
                  Eigenparse is a privacy-preserving credential verification system built on Zero-Knowledge Proofs (ZKPs).
                  It enables users to prove statements about their credentials without revealing the underlying data.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <Zap className="h-6 w-6 text-yellow-400 mb-2" />
                    <h4 className="text-white font-medium">Fast</h4>
                    <p className="text-sm text-gray-400">~50ms verification time</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <Lock className="h-6 w-6 text-green-400 mb-2" />
                    <h4 className="text-white font-medium">Private</h4>
                    <p className="text-sm text-gray-400">Zero data exposure</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <Server className="h-6 w-6 text-blue-400 mb-2" />
                    <h4 className="text-white font-medium">Scalable</h4>
                    <p className="text-sm text-gray-400">256 byte proofs</p>
                  </div>
                </div>
              </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Code className="h-6 w-6 text-cyan-400 mr-3" />
                How It Works
              </h2>
              <div className="card">
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                      <span className="text-cyan-400 font-bold">1</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Credential Issuance</h4>
                      <p className="text-gray-400 text-sm">
                        User submits credentials to a trusted issuer. The issuer creates a cryptographic
                        commitment (hash) of the data and signs it. The raw data is never stored.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                      <span className="text-cyan-400 font-bold">2</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Proof Generation</h4>
                      <p className="text-gray-400 text-sm">
                        When verification is needed, the user's browser runs a ZK circuit locally.
                        This produces a proof that a statement is true (e.g., "age &gt;= 18")
                        without revealing the actual value.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                      <span className="text-cyan-400 font-bold">3</span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Verification</h4>
                      <p className="text-gray-400 text-sm">
                        The verifier checks the mathematical validity of the proof. They learn
                        only the boolean result (valid/invalid), never the underlying data.
                        A nullifier prevents proof reuse.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Architecture Diagram */}
                <div className="mt-8 p-6 bg-black/40 rounded-xl border border-white/10">
                  <pre className="text-cyan-400 text-sm overflow-auto">
{`┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │     │   Verifier   │     │    Issuer    │
│   (Prover)   │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  1. Get Credential │                    │
       │ ──────────────────────────────────────> │
       │                    │                    │
       │  2. Signed Commitment                   │
       │ <────────────────────────────────────── │
       │                    │                    │
       │  3. Generate ZK Proof (local)           │
       │ ───────┐           │                    │
       │ <──────┘           │                    │
       │                    │                    │
       │  4. Submit Proof   │                    │
       │ ─────────────────> │                    │
       │                    │                    │
       │  5. Verify (boolean)                    │
       │ <───────────────── │                    │`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Proof Types */}
            <section id="proof-types">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <FileCode className="h-6 w-6 text-cyan-400 mr-3" />
                Proof Types
              </h2>
              <div className="space-y-4">
                {[
                  {
                    title: 'Age Verification',
                    circuit: 'age_verification.circom',
                    inputs: 'birthYear, birthMonth, birthDay, currentDate, minimumAge',
                    output: 'isOver18: boolean',
                    description: 'Proves user is above a certain age without revealing their actual date of birth.'
                  },
                  {
                    title: 'ID Validity',
                    circuit: 'aadhaar_validity.circom',
                    inputs: 'idNumber[12], credentialCommitment',
                    output: 'isValid: boolean',
                    description: 'Proves user holds a valid ID credential without revealing the actual number.'
                  },
                  {
                    title: 'Location Proof',
                    circuit: 'state_verification.circom',
                    inputs: 'pincode, requiredStateCode',
                    output: 'isFromState: boolean',
                    description: 'Proves user resides in a specific region without revealing their full address.'
                  }
                ].map((type, idx) => (
                  <div key={idx} className="card">
                    <h3 className="text-white font-semibold mb-2">{type.title}</h3>
                    <p className="text-gray-400 text-sm mb-4">{type.description}</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Circuit</div>
                        <code className="text-cyan-400 text-sm">{type.circuit}</code>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Output</div>
                        <code className="text-green-400 text-sm">{type.output}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* API Reference */}
            <section id="api">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Terminal className="h-6 w-6 text-cyan-400 mr-3" />
                API Reference
              </h2>
              <div className="card">
                <div className="space-y-6">
                  {[
                    {
                      method: 'POST',
                      endpoint: '/api/v1/credentials/issue',
                      description: 'Issue a new credential commitment',
                      body: '{ name, dateOfBirth, aadhaarNumber, pincode }'
                    },
                    {
                      method: 'POST',
                      endpoint: '/api/v1/verify/age',
                      description: 'Verify an age proof',
                      body: '{ proof, publicSignals, nullifier }'
                    },
                    {
                      method: 'POST',
                      endpoint: '/api/v1/verify/aadhaar',
                      description: 'Verify an ID validity proof',
                      body: '{ proof, publicSignals, nullifier }'
                    },
                    {
                      method: 'GET',
                      endpoint: '/api/v1/verify/history',
                      description: 'Get verification history (no PII)',
                      body: null
                    }
                  ].map((api, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-mono mr-3 ${
                          api.method === 'POST' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {api.method}
                        </span>
                        <code className="text-white">{api.endpoint}</code>
                      </div>
                      <p className="text-gray-400 text-sm">{api.description}</p>
                      {api.body && (
                        <pre className="mt-2 text-xs text-gray-500 bg-black/20 p-2 rounded">
                          {api.body}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Security */}
            <section id="security">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Lock className="h-6 w-6 text-cyan-400 mr-3" />
                Security
              </h2>
              <div className="card">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-3">Cryptographic Stack</h4>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                        Groth16 proving system
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                        BN254 elliptic curve
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                        Poseidon hash function
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                        EdDSA signatures
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-3">Security Properties</h4>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                        Soundness: False proofs are impossible
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                        Zero-knowledge: No data leakage
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                        Nullifiers prevent replay attacks
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                        Client-side proof generation
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Docs
