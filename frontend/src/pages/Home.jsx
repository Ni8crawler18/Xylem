import { ArrowRight, CheckCircle, Terminal, Code, Cpu, GitBranch, Github, Twitter, FileText, Shield } from 'lucide-react'

function Home({ onLoginClick }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Grid pattern background */}
        <div className="absolute inset-0 grid-pattern" />

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 diamond-outline opacity-50" />
        <div className="absolute top-40 right-20 diamond opacity-30" />
        <div className="absolute bottom-32 left-1/4 w-2 h-2 bg-[#5B9A5B] rounded-full" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/50 rounded-full" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div>
              <div className="inline-flex items-center space-x-2 border border-[#5B9A5B]/30 bg-[#5B9A5B]/10 rounded-full px-4 py-2 mb-8">
                <div className="w-2 h-2 bg-[#5B9A5B] rounded-full pulse-green" />
                <span className="text-sm text-[#5B9A5B] font-mono">ZK-SNARK Protocol</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
                Prove Without
                <br />
                <span className="gradient-text">Revealing</span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg font-light">
                Generate and verify zero-knowledge proofs for credential verification.
                Groth16 proving system with ~50ms verification. No PII exposure.
              </p>

              {/* Technical specs */}
              <div className="flex flex-wrap gap-4 mb-10">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Code className="h-4 w-4 text-[#5B9A5B]" />
                  <span className="font-mono">Circom Circuits</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Cpu className="h-4 w-4 text-[#5B9A5B]" />
                  <span className="font-mono">BN254 Curve</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <GitBranch className="h-4 w-4 text-[#5B9A5B]" />
                  <span className="font-mono">Poseidon Hash</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onLoginClick} className="btn-primary inline-flex items-center justify-center">
                  Generate Proof
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                <button onClick={onLoginClick} className="btn-secondary inline-flex items-center justify-center">
                  <Terminal className="mr-2 h-5 w-5" />
                  Verify Proof
                </button>
              </div>
            </div>

            {/* Right - Hero Illustration */}
            <div className="hidden lg:block">
              <img
                src="/landing-hero.png"
                alt="ZK Proof Verification Flow"
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '~50ms', label: 'Verification Time' },
              { value: '256B', label: 'Proof Size' },
              { value: '128-bit', label: 'Security Level' },
              { value: '0', label: 'PII Exposed' }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How ZKP Works - Technical */}
      <section id="protocol" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Illustration */}
            <div>
              <img
                src="/illustrations_3.png"
                alt="ZK Proof Architecture"
                className="w-full rounded-lg"
              />
            </div>

            {/* Right - Content */}
            <div>
              <div className="inline-flex items-center space-x-2 border border-white/10 rounded-full px-4 py-2 mb-6">
                <span className="text-sm text-gray-400 font-mono">// Protocol Flow</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Zero-Knowledge
                <br />
                <span className="text-gray-500">Proof System</span>
              </h2>

              <div className="space-y-6">
                {[
                  {
                    step: '01',
                    title: 'Secret Witness',
                    description: 'Private inputs (credentials) remain local. Never transmitted.',
                    code: 'witness = { dob, aadhaarNum, pincode }'
                  },
                  {
                    step: '02',
                    title: 'Circuit Compilation',
                    description: 'Circom circuit generates R1CS constraints for the statement.',
                    code: 'snarkjs.groth16.fullProve(witness, wasm, zkey)'
                  },
                  {
                    step: '03',
                    title: 'Proof Generation',
                    description: 'Groth16 prover outputs (π_a, π_b, π_c) tuple. 256 bytes.',
                    code: 'proof = { pi_a, pi_b, pi_c }'
                  },
                  {
                    step: '04',
                    title: 'Verification',
                    description: 'Verifier checks pairing equation. Returns boolean only.',
                    code: 'result = verify(vk, publicSignals, proof) // true'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded bg-[#5B9A5B]/20 border border-[#5B9A5B]/30 flex items-center justify-center">
                      <span className="text-xs font-mono text-[#5B9A5B]">{item.step}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                      <p className="text-gray-500 text-sm mb-2">{item.description}</p>
                      <code className="text-xs text-[#5B9A5B] font-mono bg-black/50 px-2 py-1 rounded border border-white/5">
                        {item.code}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Types */}
      <section id="circuits" className="py-24 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 border border-white/10 rounded-full px-4 py-2 mb-6">
              <span className="text-sm text-gray-400 font-mono">// Supported Circuits</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Verification Circuits
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Pre-compiled Circom circuits for common KYC verification scenarios
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'age_verification.circom',
                description: 'Prove age >= threshold without revealing DOB',
                inputs: ['birthYear', 'birthMonth', 'birthDay', 'minAge'],
                output: 'isAboveAge: bool'
              },
              {
                title: 'aadhaar_validity.circom',
                description: 'Prove valid ID ownership without number exposure',
                inputs: ['aadhaarDigits[12]', 'commitment', 'signature'],
                output: 'isValid: bool'
              },
              {
                title: 'state_verification.circom',
                description: 'Prove residence in state without full address',
                inputs: ['pincode', 'stateCode', 'commitment'],
                output: 'isFromState: bool'
              }
            ].map((circuit, idx) => (
              <div key={idx} className="card group">
                <div className="flex items-center justify-between mb-4">
                  <code className="text-[#5B9A5B] text-sm font-mono">{circuit.title}</code>
                  <div className="diamond" />
                </div>
                <p className="text-gray-400 text-sm mb-4">{circuit.description}</p>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1 font-mono">// inputs</div>
                    <div className="flex flex-wrap gap-1">
                      {circuit.inputs.map((input, i) => (
                        <span key={i} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono text-gray-400">
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1 font-mono">// output</div>
                    <span className="text-xs bg-[#5B9A5B]/10 border border-[#5B9A5B]/30 px-2 py-0.5 rounded font-mono text-[#5B9A5B]">
                      {circuit.output}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prover vs Verifier */}
      <section id="architecture" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <div className="inline-flex items-center space-x-2 border border-white/10 rounded-full px-4 py-2 mb-6">
                <span className="text-sm text-gray-400 font-mono">// Architecture</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Prover ↔ Verifier
                <br />
                <span className="text-gray-500">Protocol</span>
              </h2>

              <p className="text-gray-400 mb-8">
                Two-party protocol where the prover demonstrates knowledge of a secret
                witness satisfying a public statement, without revealing the witness itself.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="card-green">
                  <div className="text-[#5B9A5B] font-mono text-sm mb-2">PROVER</div>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-[#5B9A5B] mr-2" />
                      Holds secret witness
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-[#5B9A5B] mr-2" />
                      Generates ZK proof
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-[#5B9A5B] mr-2" />
                      Local computation
                    </li>
                  </ul>
                </div>

                <div className="card">
                  <div className="text-white font-mono text-sm mb-2">VERIFIER</div>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-gray-500 mr-2" />
                      Receives proof only
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-gray-500 mr-2" />
                      Verifies validity
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-gray-500 mr-2" />
                      Learns nothing else
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Illustration */}
            <div>
              <img
                src="/illustrations_2.png"
                alt="Prover Verifier Protocol"
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { name: 'Groth16', desc: 'Proving System' },
              { name: 'Poseidon', desc: 'Hash Function' },
              { name: 'BN254', desc: 'Elliptic Curve' },
              { name: 'Circom', desc: 'Circuit DSL' },
              { name: 'snarkjs', desc: 'ZK Library' }
            ].map((tech, idx) => (
              <div key={idx} className="text-center">
                <div className="text-white font-mono font-semibold">{tech.name}</div>
                <div className="text-xs text-gray-600">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 border border-[#5B9A5B]/30 bg-[#5B9A5B]/10 rounded-full px-4 py-2 mb-8">
            <span className="text-sm text-[#5B9A5B] font-mono">DPDP Act 2023 Compliant</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Start Generating
            <br />
            <span className="gradient-text">Zero-Knowledge Proofs</span>
          </h2>

          <p className="text-gray-500 mb-10 max-w-xl mx-auto">
            Privacy-preserving credential verification. Mathematical proof of claims
            without data exposure. Production-ready ZK infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={onLoginClick} className="px-6 py-2.5 bg-[#5B9A5B] text-white text-sm rounded-lg hover:bg-[#4A7F4A] transition-all font-medium inline-flex items-center justify-center">
              Launch App
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-4">
                <img src="/logo.png" alt="Eigenparse" className="h-8 w-8" />
                <span className="text-white font-semibold text-lg">Eigenparse</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Privacy-preserving credential verification using zero-knowledge proofs.
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Protocol */}
            <div>
              <h4 className="text-white font-mono text-sm mb-4">// Protocol</h4>
              <ul className="space-y-3">
                <li><a href="#protocol" className="text-sm text-gray-500 hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#circuits" className="text-sm text-gray-500 hover:text-white transition-colors">Circuits</a></li>
                <li><a href="#architecture" className="text-sm text-gray-500 hover:text-white transition-colors">Architecture</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Whitepaper</a></li>
              </ul>
            </div>

            {/* Developers */}
            <div>
              <h4 className="text-white font-mono text-sm mb-4">// Developers</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Examples</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-mono text-sm mb-4">// Resources</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Research</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-600 mb-4 md:mb-0">
              <span className="font-mono">© 2024 Eigenparse.</span> Built with Groth16 + Circom
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Shield className="h-4 w-4 text-[#5B9A5B]" />
                <span>DPDP Compliant</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <FileText className="h-4 w-4 text-[#5B9A5B]" />
                <span>Open Source</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
