# Privacy-Preserving KYC System - Implementation Workflow

## Project: Xylem - ZKP-Based KYC Verification

### Executive Summary

Build a privacy-preserving KYC verification system using Zero-Knowledge Proofs (ZKPs) that allows users to prove identity attributes (age, Aadhaar validity, address state) without revealing sensitive PII. This aligns with India's DPDP Act (2023) requirements.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           XYLEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐    │
│  │   USER APP   │     │   VERIFIER   │     │    ISSUER (Simulated     │    │
│  │  (Frontend)  │     │   SERVICE    │     │    Aadhaar Authority)    │    │
│  └──────┬───────┘     └──────┬───────┘     └────────────┬─────────────┘    │
│         │                    │                          │                   │
│         │  1. Request        │                          │                   │
│         │  Credential        │                          │                   │
│         │ ─────────────────────────────────────────────>│                   │
│         │                    │                          │                   │
│         │  2. Issue Signed   │                          │                   │
│         │  Credential        │                          │                   │
│         │ <─────────────────────────────────────────────│                   │
│         │                    │                          │                   │
│         │  3. Generate ZK    │                          │                   │
│         │  Proof (Client)    │                          │                   │
│         │ ────────┐          │                          │                   │
│         │         │          │                          │                   │
│         │ <───────┘          │                          │                   │
│         │                    │                          │                   │
│         │  4. Submit Proof   │                          │                   │
│         │ ──────────────────>│                          │                   │
│         │                    │                          │                   │
│         │  5. Verify Proof   │                          │                   │
│         │    (No PII)        │                          │                   │
│         │ <──────────────────│                          │                   │
│         │                    │                          │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack (Practical for EOD Delivery)

### Core Technologies

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | React + Vite + TailwindCSS | Fast development, modern UI |
| **Backend** | Node.js + Express | JavaScript ecosystem, snarkjs compatibility |
| **ZKP Library** | snarkjs + circom | Mature, browser-compatible, Groth16 proofs |
| **Database** | SQLite | Zero config, portable, sufficient for demo |
| **Signing** | EdDSA (Baby JubJub) | ZKP-friendly elliptic curve |

### Why This Stack?
1. **snarkjs** runs in browser - proofs generated client-side (privacy preserved)
2. **circom** circuits compile to WASM - fast verification
3. **Groth16** - constant proof size (~200 bytes), fast verification (~10ms)
4. Full JavaScript stack - single language, faster development

---

## ZKP Circuits Design

### Circuit 1: Age Verification (Over 18)

```circom
// circuits/age_verification.circom
pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/comparators.circom";

template AgeVerification() {
    // Private inputs (user's secret data)
    signal input birthYear;
    signal input birthMonth;
    signal input birthDay;
    signal input credentialHash;  // Signed by issuer

    // Public inputs
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    signal input minimumAge;
    signal input issuerPublicKey;

    // Output
    signal output isValid;

    // Calculate age
    signal age;
    age <== currentYear - birthYear;

    // Check if age >= minimumAge
    component gte = GreaterEqThan(8);
    gte.in[0] <== age;
    gte.in[1] <== minimumAge;

    isValid <== gte.out;
}

component main {public [currentYear, currentMonth, currentDay, minimumAge, issuerPublicKey]} = AgeVerification();
```

### Circuit 2: Aadhaar Validity (Last 4 digits verification)

```circom
// circuits/aadhaar_validity.circom
pragma circom 2.0.0;

include "circomlib/poseidon.circom";
include "circomlib/eddsaposeidon.circom";

template AadhaarValidity() {
    // Private inputs
    signal input aadhaarNumber[12];  // 12-digit Aadhaar
    signal input signature[2];        // EdDSA signature

    // Public inputs
    signal input last4Digits[4];      // For partial reveal if needed
    signal input issuerPubKey[2];
    signal input nullifier;           // Prevent double-use

    // Output
    signal output isValid;

    // Hash the Aadhaar number
    component hasher = Poseidon(12);
    for (var i = 0; i < 12; i++) {
        hasher.inputs[i] <== aadhaarNumber[i];
    }

    // Verify signature from issuer
    component sigVerify = EdDSAPoseidonVerifier();
    sigVerify.enabled <== 1;
    sigVerify.Ax <== issuerPubKey[0];
    sigVerify.Ay <== issuerPubKey[1];
    sigVerify.R8x <== signature[0];
    sigVerify.R8y <== signature[1];
    sigVerify.S <== hasher.out;
    sigVerify.M <== hasher.out;

    isValid <== sigVerify.out;
}
```

### Circuit 3: State/Region Verification

```circom
// circuits/state_verification.circom
pragma circom 2.0.0;

template StateVerification() {
    // Private inputs
    signal input fullAddress[256];     // Encoded address
    signal input pincode;

    // Public inputs
    signal input allowedStateCode;     // e.g., 27 for Maharashtra
    signal input credentialCommitment;

    // Output
    signal output isFromState;

    // Extract state code from pincode (first digit for zone, first 2 for state)
    signal stateCode;
    stateCode <== pincode \ 10000;  // Get first 2 digits

    // Check if state matches
    component eq = IsEqual();
    eq.in[0] <== stateCode;
    eq.in[1] <== allowedStateCode;

    isFromState <== eq.out;
}
```

---

## Backend API Design

### Endpoints

```
POST /api/v1/credentials/issue
  - Issues a signed credential to user
  - Input: { name, dob, aadhaar, address } (simulated from Aadhaar authority)
  - Output: { credential, signature, commitment }

POST /api/v1/verify/age
  - Verifies ZK proof for age
  - Input: { proof, publicSignals }
  - Output: { verified: boolean, attribute: "over_18" }

POST /api/v1/verify/aadhaar
  - Verifies ZK proof for Aadhaar validity
  - Input: { proof, publicSignals }
  - Output: { verified: boolean, attribute: "valid_aadhaar" }

POST /api/v1/verify/state
  - Verifies ZK proof for state residence
  - Input: { proof, publicSignals, requiredState }
  - Output: { verified: boolean, attribute: "state_resident" }

GET /api/v1/verification/history
  - Returns verification history (no PII stored)
  - Output: { verifications: [...] }

GET /api/v1/benchmark
  - Returns performance metrics
  - Output: { avgProofTime, avgVerifyTime, comparisons }
```

### Data Model (SQLite)

```sql
-- No PII stored, only verification records
CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    verification_type TEXT NOT NULL,  -- 'age', 'aadhaar', 'state'
    nullifier TEXT UNIQUE NOT NULL,   -- Prevents replay
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    proof_generation_time_ms INTEGER,
    verification_time_ms INTEGER,
    result BOOLEAN NOT NULL
);

CREATE TABLE issuers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark comparison data
CREATE TABLE benchmarks (
    id TEXT PRIMARY KEY,
    method TEXT NOT NULL,  -- 'zkp' or 'traditional'
    operation TEXT NOT NULL,
    latency_ms INTEGER,
    pii_exposed BOOLEAN,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Frontend Components

### Page Structure

```
/src
├── pages/
│   ├── Home.jsx              # Landing page
│   ├── UserPortal.jsx        # User credential management
│   ├── VerifierPortal.jsx    # Business verification interface
│   ├── Benchmark.jsx         # Performance comparison dashboard
│   └── About.jsx             # DPDP compliance info
├── components/
│   ├── CredentialCard.jsx    # Display user credentials
│   ├── ProofGenerator.jsx    # ZK proof generation UI
│   ├── VerificationForm.jsx  # Attribute selection
│   ├── ResultDisplay.jsx     # Verification results
│   └── BenchmarkChart.jsx    # Latency comparisons
├── lib/
│   ├── zkp.js                # snarkjs wrapper
│   ├── api.js                # Backend API calls
│   └── utils.js              # Helpers
└── circuits/                 # Compiled WASM circuits
```

### Key UI Flows

#### Flow 1: User Obtains Credential
```
1. User enters simulated Aadhaar data (demo mode)
2. System issues signed credential
3. Credential stored locally (browser storage)
4. User sees "Credential Issued" with masked data
```

#### Flow 2: User Generates Proof
```
1. User selects attribute to prove (e.g., "I am over 18")
2. Click "Generate Proof"
3. snarkjs runs in browser (client-side)
4. Proof displayed (can copy/share)
5. Show proof generation time for benchmark
```

#### Flow 3: Verifier Checks Proof
```
1. Verifier pastes proof OR user shares QR code
2. Click "Verify"
3. Backend validates ZK proof
4. Result: "VERIFIED: User is over 18" (no DOB shown)
5. Show verification time for benchmark
```

---

## Implementation Phases (EOD Timeline)

### Phase 1: Core Setup (2 hours)
- [ ] Initialize project structure
- [ ] Set up React + Vite frontend
- [ ] Set up Express backend
- [ ] Install snarkjs, circomlib dependencies
- [ ] Create SQLite database schema

### Phase 2: ZKP Circuits (2 hours)
- [ ] Write age verification circuit
- [ ] Compile circuits with circom
- [ ] Generate proving/verification keys (trusted setup)
- [ ] Test proof generation/verification

### Phase 3: Backend APIs (2 hours)
- [ ] Implement credential issuance endpoint
- [ ] Implement age verification endpoint
- [ ] Implement Aadhaar validity endpoint
- [ ] Add benchmark logging

### Phase 4: Frontend UI (2 hours)
- [ ] Build User Portal page
- [ ] Build Verifier Portal page
- [ ] Integrate snarkjs for client-side proofs
- [ ] Add result displays with timing

### Phase 5: Polish & Documentation (1 hour)
- [ ] Add benchmark dashboard
- [ ] Write DPDP compliance notes
- [ ] Final testing
- [ ] Demo preparation

---

## DPDP Act (2023) Compliance Demonstration

| DPDP Requirement | Xylem Implementation |
|------------------|----------------------|
| **Data Minimization** | Only reveals required attribute (age >= 18), not full DOB |
| **Purpose Limitation** | Proof tied to specific verification purpose via nullifier |
| **Consent** | User explicitly chooses which attributes to prove |
| **Storage Limitation** | No PII stored by verifier; only proof verification records |
| **Security** | Cryptographic proofs; no raw data transmission |

---

## Benchmark Metrics

### Comparison: Traditional e-KYC vs ZKP-KYC

| Metric | Traditional e-KYC | ZKP-KYC (Xylem) |
|--------|-------------------|-----------------|
| **Data Exposed** | Full name, DOB, Aadhaar, Photo | None (only boolean result) |
| **Verification Latency** | 2-5 seconds | ~500ms (proof gen) + ~10ms (verify) |
| **Storage Required** | Full PII database | Nullifiers only |
| **Breach Impact** | Catastrophic (all PII leaked) | Minimal (no PII to leak) |
| **DPDP Compliance** | Requires extensive controls | Native compliance |

### Performance Targets
- Proof generation: < 2 seconds (browser)
- Proof verification: < 50ms (server)
- Proof size: < 1KB

---

## Directory Structure

```
xylem/
├── README.md
├── workflow.md
├── package.json
├── docker-compose.yml        # Optional: Easy deployment
│
├── circuits/                 # Circom ZKP circuits
│   ├── age_verification.circom
│   ├── aadhaar_validity.circom
│   └── state_verification.circom
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   │   ├── credentials.js
│   │   ├── verify.js
│   │   └── benchmark.js
│   ├── services/
│   │   ├── zkp.js           # snarkjs verification
│   │   ├── issuer.js        # Credential issuance
│   │   └── db.js            # SQLite operations
│   └── data/
│       └── xylem.db
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── public/
│       └── circuits/        # Compiled WASM + zkey files
│
└── docs/
    ├── dpdp_compliance.md
    └── benchmarks.md
```

---

## Quick Start Commands

```bash
# 1. Setup
npm install -g circom snarkjs
cd xylem

# 2. Compile circuits
cd circuits
circom age_verification.circom --r1cs --wasm --sym
snarkjs groth16 setup age_verification.r1cs pot12_final.ptau age_verification_0000.zkey
snarkjs zkey export verificationkey age_verification_0000.zkey verification_key.json

# 3. Start backend
cd ../backend
npm install
npm run dev

# 4. Start frontend
cd ../frontend
npm install
npm run dev

# 5. Access
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Trusted setup compromise | Use powers of tau ceremony; document process |
| Proof replay attacks | Implement nullifiers; one-time use proofs |
| Circuit bugs | Extensive testing; use audited circomlib |
| Browser compatibility | Test on Chrome, Firefox, Safari; provide fallback |

---

## Success Criteria

1. **Functional Demo**: User can prove "over 18" without revealing DOB
2. **Performance**: Proof generation < 3s, verification < 100ms
3. **Privacy**: Zero PII transmitted or stored during verification
4. **Usability**: Non-technical user can complete flow in < 1 minute
5. **Compliance**: Clear mapping to DPDP Act requirements

---

## Next Steps After EOD

- Phase 2: Add multi-attribute verification
- Phase 3: Mobile app (React Native)
- Phase 4: Integration with real Aadhaar sandbox APIs
- Phase 5: Formal security audit
