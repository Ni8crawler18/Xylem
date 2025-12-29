# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eigenparse is a privacy-preserving KYC (Know Your Customer) system using Zero-Knowledge Proofs. It enables users to prove identity attributes (age >= 18, valid Aadhaar, state residence) without exposing sensitive PII, designed for compliance with India's DPDP Act 2023.

## Common Commands

```bash
# Install all dependencies (root, backend, frontend)
npm run install:all

# Start development (backend + frontend concurrently)
npm run dev

# Start components separately
npm run dev:backend    # Backend on http://localhost:3000
npm run dev:frontend   # Frontend on http://localhost:5173

# Production
npm run build          # Build frontend (Vite)
npm start              # Start backend server

# Database
npm run setup-db       # Initialize database manually
rm backend/data/eigenparse.db  # Reset database
```

## Architecture

### Monorepo Structure
- **backend/** - Express.js REST API (ES Modules, port 3000)
- **frontend/** - React 18 + Vite SPA (port 5173)
- **circuits/** - Circom ZK circuits (pre-compiled)

### Backend (`backend/`)
- `server.js` - Entry point with middleware and route mounting
- `routes/` - Express routers: `credentials.js`, `verify.js`
- `services/db.js` - SQLite via sql.js (file: `data/eigenparse.db`)
- `services/zkp.js` - snarkjs wrapper for proof verification
- `services/issuer.js` - Credential issuance with Poseidon hashing

### Frontend (`frontend/`)
- `src/App.jsx` - React Router v6 main layout
- `src/context/AuthContext.jsx` - Simple auth state (localStorage)
- `src/lib/api.js` - Backend API client
- `src/lib/zkp.js` - Client-side proof generation with snarkjs
- `public/circuits/` - Compiled WASM and proving/verification keys

### ZK Circuits (`circuits/`)
Three Groth16 circuits, all pre-compiled with WASM and keys:
1. `age_verification.circom` - Proves age >= threshold
2. `aadhaar_validity.circom` - Proves valid Aadhaar without exposing number
3. `state_verification.circom` - Proves residence in specific state

## Key API Endpoints

```
POST /api/v1/credentials/issue     # Issue credential (returns commitment)
POST /api/v1/verify/age            # Verify age proof
POST /api/v1/verify/aadhaar        # Verify Aadhaar proof
POST /api/v1/verify/state          # Verify state proof
GET  /api/v1/verify/history        # Verification history (no PII)
```

## Database Schema

Tables: `verifications`, `issuers`, `credentials`
- Nullifiers are stored to prevent proof replay attacks
- Credentials stored as commitments (hashes), never raw PII

## Demo Credentials

- User: `user@eigenparse.com` / `eigenparse`
- Verifier: `verifier@eigenparse.com` / `zkproof`

## Privacy Design Principles

- **Client-side proof generation** - Private inputs never leave the browser
- **Nullifier system** - Prevents proof replay attacks (unique per proof)
- **Commitment storage** - Only Poseidon hashes stored, never PII
- **Boolean results only** - Verifiers receive true/false, no raw data

## Tech Stack

- **Backend**: Express.js, sql.js (SQLite), snarkjs, circomlibjs
- **Frontend**: React 18, Vite, TailwindCSS, snarkjs
- **Circuits**: Circom with Groth16 proof system, Poseidon hash
