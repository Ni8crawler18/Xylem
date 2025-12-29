# Eigenparse - Privacy-Preserving KYC System

<p align="center">
  <strong>Zero-Knowledge Proof based KYC verification for India's DPDP Act 2023 compliance</strong>
</p>

<p align="center">
  <em>Prove identity attributes without revealing sensitive personal information</em>
</p>

---

## Overview

Eigenparse is a privacy-preserving Know Your Customer (KYC) verification system that leverages Zero-Knowledge Proofs (ZKPs) to allow users to prove identity attributes (age, Aadhaar validity, state residence) without exposing sensitive Personally Identifiable Information (PII). Built specifically for compliance with India's Digital Personal Data Protection Act (DPDP) 2023.

### Key Features

- **Age Verification** - Prove you're over 18 without revealing your date of birth
- **Aadhaar Validity** - Prove valid Aadhaar card without exposing the 12-digit number
- **State Residence** - Prove you reside in a specific state without revealing full address
- **Nullifier Protection** - Cryptographic nullifiers prevent proof replay attacks
- **Client-Side Proofs** - ZK proofs generated locally in the browser for maximum privacy
- **DPDP Compliant** - Built for India's DPDP Act 2023

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [ZKP Circuits](#zkp-circuits)
- [DPDP Act Compliance](#dpdp-act-compliance)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EIGENPARSE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐    │
│  │   USER APP   │     │   VERIFIER   │     │    ISSUER (Simulated     │    │
│  │  (Frontend)  │     │   SERVICE    │     │    Aadhaar Authority)    │    │
│  └──────┬───────┘     └──────┬───────┘     └────────────┬─────────────┘    │
│         │                    │                          │                   │
│         │  1. Request Credential                        │                   │
│         │ ─────────────────────────────────────────────>│                   │
│         │                    │                          │                   │
│         │  2. Issue Signed Credential                   │                   │
│         │ <─────────────────────────────────────────────│                   │
│         │                    │                          │                   │
│         │  3. Generate ZK Proof (Client-Side)           │                   │
│         │ ────────┐          │                          │                   │
│         │         │          │                          │                   │
│         │ <───────┘          │                          │                   │
│         │                    │                          │                   │
│         │  4. Submit Proof   │                          │                   │
│         │ ──────────────────>│                          │                   │
│         │                    │                          │                   │
│         │  5. Verify (No PII)│                          │                   │
│         │ <──────────────────│                          │                   │
│         │                    │                          │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow Description

1. **Credential Request**: User submits identity data (simulated Aadhaar data in demo mode)
2. **Credential Issuance**: Issuer creates a signed credential with cryptographic commitment
3. **Proof Generation**: User generates ZK proof locally in browser (private inputs never leave device)
4. **Proof Submission**: User submits proof + public signals to verifier
5. **Verification**: Verifier validates proof mathematically without accessing any PII

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 + Vite | Modern SPA with fast HMR |
| **Styling** | TailwindCSS | Utility-first CSS framework |
| **Backend** | Node.js + Express | REST API server |
| **Database** | SQLite (sql.js) | In-memory/file database |
| **ZKP Library** | snarkjs | Groth16 proof generation/verification |
| **Hash Function** | Poseidon (circomlibjs) | ZKP-friendly cryptographic hash |
| **Circuit Language** | Circom | ZK circuit definition |

---

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Circom** (optional, for circuit compilation)

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version   # Should be >= 9.0.0
```

---

## Installation

### Quick Install

```bash
# Clone the repository
git clone <repository-url>
cd Eigenparse

# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### Manual Install

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Running the Application

### Option 1: Run Both Services Together

```bash
# From project root
npm run dev
```

This uses `concurrently` to start both backend and frontend simultaneously.

### Option 2: Run Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend will start at `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will start at `http://localhost:5173`

### Production Build

```bash
# Build frontend
npm run build

# Start backend in production mode
npm start
```

---

## Project Structure

```
Eigenparse/
├── README.md                 # This file
├── workflow.md               # Detailed implementation workflow
├── package.json              # Root package with scripts
│
├── backend/                  # Express API server
│   ├── server.js             # Main entry point
│   ├── package.json
│   ├── routes/
│   │   ├── credentials.js    # Credential issuance endpoints
│   │   └── verify.js         # ZKP verification endpoints
│   ├── services/
│   │   ├── db.js             # SQLite database operations
│   │   ├── issuer.js         # Credential generation logic
│   │   └── zkp.js            # snarkjs wrapper & proof verification
│   └── data/
│       └── eigenparse.db     # SQLite database file
│
├── frontend/                 # React application
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx           # Main app component & routing
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Authentication state management
│   │   ├── pages/
│   │   │   ├── Home.jsx         # Landing page
│   │   │   ├── UserDashboard.jsx    # Prover interface
│   │   │   └── VerifierDashboard.jsx # Verifier interface
│   │   ├── components/
│   │   │   └── LoginModal.jsx   # Login/signup modal
│   │   └── lib/
│   │       ├── api.js           # Backend API client
│   │       └── zkp.js           # Client-side ZKP utilities
│   └── public/
│       └── logo.png
│
├── circuits/                 # Circom ZKP circuits
│   ├── package.json
│   ├── age_verification_js/     # Compiled age circuit
│   ├── aadhaar_validity_js/     # Compiled Aadhaar circuit
│   ├── state_verification_js/   # Compiled state circuit
│   ├── *_vkey.json              # Verification keys
│   └── *.zkey                   # Proving keys
│
└── docs/
    └── Cryptography.pdf      # Cryptographic documentation
```

---

## API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Health Check
```http
GET /health
```
Returns server health status.

### API Info
```http
GET /api/v1
```
Returns API metadata and available endpoints.

---

### Credentials

#### Issue Credential
```http
POST /api/v1/credentials/issue
Content-Type: application/json

{
  "name": "John Doe",
  "dateOfBirth": "1990-05-15",
  "aadhaarNumber": "234567890123",
  "pincode": "560001",
  "state": "Karnataka"
}
```

**Response:**
```json
{
  "success": true,
  "credential": {
    "id": "uuid",
    "commitment": "poseidon_hash...",
    "signature": {...},
    "publicInputs": {...},
    "privateInputs": {...},
    "issuer": {
      "id": "uuid",
      "name": "Demo Aadhaar Authority",
      "publicKey": ["x", "y"]
    },
    "issuedAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T00:00:00.000Z"
  },
  "processingTime": "45ms"
}
```

#### Get Issuers
```http
GET /api/v1/credentials/issuers
```

#### Verify Commitment
```http
GET /api/v1/credentials/verify-commitment/:commitment
```

---

### Verification

#### Verify Age Proof
```http
POST /api/v1/verify/age
Content-Type: application/json

{
  "proof": {
    "pi_a": [...],
    "pi_b": [...],
    "pi_c": [...],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": ["1", "18", "2024", "nullifier..."],
  "nullifier": "unique_nullifier"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "attribute": "age >= 18",
  "verificationId": "uuid",
  "verificationTime": "12ms",
  "simulationMode": false,
  "piiExposed": false,
  "dpdpCompliant": true
}
```

#### Verify Aadhaar Proof
```http
POST /api/v1/verify/aadhaar
```

#### Verify State Proof
```http
POST /api/v1/verify/state
```

#### Generate Proof (Server-side)
```http
POST /api/v1/verify/generate-proof
Content-Type: application/json

{
  "type": "age",
  "privateInputs": {
    "dateOfBirth": {"year": 1990, "month": 5, "day": 15},
    "nullifierBase": 12345
  },
  "publicInputs": {
    "minimumAge": 18,
    "currentDate": {"year": 2024, "month": 1, "day": 1}
  }
}
```

#### Get Verification History
```http
GET /api/v1/verify/history?limit=50&offset=0
```

---

## ZKP Circuits

### Age Verification Circuit
Proves user's age meets minimum requirement without revealing date of birth.

**Private Inputs:**
- `birthYear`, `birthMonth`, `birthDay`
- `salt` (for nullifier generation)

**Public Inputs:**
- `currentYear`, `currentMonth`, `currentDay`
- `minimumAge`

**Output:**
- `isValid` (boolean)
- `nullifier` (unique per proof)

### Aadhaar Validity Circuit
Proves user has a valid Aadhaar card without exposing the number.

**Private Inputs:**
- `aadhaarNumber[12]` (12-digit array)
- Issuer signature

**Public Inputs:**
- Issuer public key
- Credential commitment

**Output:**
- `isValid` (boolean)
- `nullifier`

### State Verification Circuit
Proves user resides in a specific state without revealing full address.

**Private Inputs:**
- `pincode`
- `stateCode`

**Public Inputs:**
- `requiredStateCode`

**Output:**
- `isFromState` (boolean)
- `nullifier`

---

## DPDP Act Compliance

| DPDP Requirement | Eigenparse Implementation |
|------------------|----------------------|
| **Data Minimization** | Only boolean results shared; no raw PII transmitted |
| **Purpose Limitation** | Nullifiers ensure proofs are tied to specific verification instances |
| **Consent** | User explicitly generates and submits proofs |
| **Storage Limitation** | Verifiers store only nullifiers and verification results; no PII |
| **Security** | Cryptographic proofs via Groth16 ZK-SNARKs |
| **Accountability** | Audit trail via verification IDs |

---

## Benchmarks

### ZKP-KYC vs Traditional e-KYC

| Metric | Traditional e-KYC | ZKP-KYC (Eigenparse) |
|--------|-------------------|-----------------|
| **Data Exposed** | Full name, DOB, Aadhaar, Photo | None (boolean only) |
| **Proof Generation** | N/A | ~500ms (browser) |
| **Verification Time** | 2-5 seconds | ~10-50ms |
| **Storage Required** | Full PII database | Nullifiers only |
| **Breach Impact** | Catastrophic | Minimal |
| **DPDP Compliance** | Requires extensive controls | Native compliance |

### Performance Targets
- Proof generation: < 2 seconds (browser)
- Proof verification: < 50ms (server)
- Proof size: < 1KB

---

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Then restart the backend
cd backend && npm run dev
```

### Database Issues

```bash
# Reset database
rm backend/data/eigenparse.db

# Restart backend (will recreate database)
cd backend && npm run dev
```

### Circuit Compilation (Optional)

If you need to recompile circuits:

```bash
# Install circom globally
npm install -g circom snarkjs

# Compile circuits
cd circuits
circom age_verification.circom --r1cs --wasm --sym

# Generate proving/verification keys
snarkjs groth16 setup age_verification.r1cs pot12_final.ptau age_verification.zkey
snarkjs zkey export verificationkey age_verification.zkey age_verification_vkey.json
```

### Frontend Build Issues

```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules
npm install
npm run dev
```

---

## Development

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Environment Variables

Create `.env` files as needed:

**backend/.env:**
```env
PORT=3000
NODE_ENV=development
```

**frontend/.env:**
```env
VITE_API_URL=http://localhost:3000
```

---

## User Roles

### Prover (User)
- Request and receive signed credentials
- Generate ZK proofs locally
- Submit proofs for verification
- View proof history

### Verifier (Business)
- Receive and verify ZK proofs
- View verification history
- Access benchmark statistics
- No access to underlying PII

---

## Security Considerations

- **Nullifiers**: Prevent proof replay attacks
- **Client-Side Proofs**: Private inputs never leave user's device
- **Commitment Scheme**: Credentials stored as Poseidon hashes
- **EdDSA Signatures**: Issuer authenticity via Baby JubJub curve
- **No PII Storage**: Verifiers cannot access or store personal data

---

## License

MIT

---

## Acknowledgments

Built for **DSCI Cyber Security Innovation Challenge 1.0**

**Technologies Used:**
- [snarkjs](https://github.com/iden3/snarkjs) - zkSNARK implementation
- [circomlibjs](https://github.com/iden3/circomlibjs) - Circom library in JavaScript
- [Poseidon Hash](https://www.poseidon-hash.info/) - ZK-friendly hash function
- [React](https://react.dev/) - Frontend framework
- [Express](https://expressjs.com/) - Backend framework
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
