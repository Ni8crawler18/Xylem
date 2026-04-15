/**
 * Reference verifier definitions. Each entry describes a mock integration
 * consumed by the wallet flow. Adding a new integration is a single entry:
 * the wallet UI, compliance metrics, and verification submission all read
 * from this list.
 */
export const MOCK_VERIFIERS = [
  {
    id: 'credence',
    name: 'Credence NBFC',
    mark: 'CR',
    sector: 'Lending · NBFC',
    tagline: 'credence.finance',
    product: 'Personal Loan Pre-qualification',
    description:
      'Credential-based pre-qualification for unsecured personal loans. ' +
      'Replaces document capture, video KYC, and multi-day manual review.',
    requires: ['age'],
    successLabel: 'Pre-qualification Complete'
  },
  {
    id: 'airwave',
    name: 'AirWave Mobile',
    mark: 'AW',
    sector: 'Telecommunications',
    tagline: 'airwave.mobile',
    product: 'Prepaid SIM Activation',
    description:
      'DoT-compliant SIM KYC using credential-based Aadhaar validity verification. ' +
      'No physical document capture, no biometric logging.',
    requires: ['aadhaar'],
    successLabel: 'SIM Provisioned'
  },
  {
    id: 'vidya',
    name: 'Vidya Scholarship Portal',
    mark: 'VS',
    sector: 'Government · Education',
    tagline: 'vidya.gov.in',
    product: 'State Merit Scholarship',
    description:
      'Residence-based eligibility verification for merit scholarships. ' +
      'Nullifier-based deduplication prevents cross-district duplicate claims.',
    requires: ['state'],
    successLabel: 'Application Submitted'
  },
  {
    id: 'composite',
    name: 'Composite Verifier',
    mark: 'CV',
    sector: 'Reference · Multi-Attribute',
    tagline: 'composite.reference',
    product: 'Multi-Attribute Eligibility',
    description:
      'Reference verifier requiring all three attributes in a single composite proof. ' +
      'Demonstrates multi-attribute verification with unified nullifier set.',
    requires: ['age', 'aadhaar', 'state'],
    successLabel: 'All Attributes Verified'
  }
]

export function findVerifier(id) {
  return MOCK_VERIFIERS.find(v => v.id === id) || null
}

/**
 * Returns true if the generated proofs satisfy a verifier's requirements.
 */
export function verifierSatisfied(verifier, generatedTypes) {
  if (!verifier) return false
  return verifier.requires.every(r => generatedTypes.includes(r))
}
