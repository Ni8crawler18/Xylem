import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let poseidon = null;

async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

// Circuit paths (will be populated after circuit compilation)
const CIRCUIT_PATHS = {
  age: {
    wasm: join(__dirname, '../../circuits/age_verification_js/age_verification.wasm'),
    zkey: join(__dirname, '../../circuits/age_verification.zkey'),
    vkey: join(__dirname, '../../circuits/age_verification_vkey.json')
  },
  aadhaar: {
    wasm: join(__dirname, '../../circuits/aadhaar_validity_js/aadhaar_validity.wasm'),
    zkey: join(__dirname, '../../circuits/aadhaar_validity.zkey'),
    vkey: join(__dirname, '../../circuits/aadhaar_validity_vkey.json')
  },
  state: {
    wasm: join(__dirname, '../../circuits/state_verification_js/state_verification.wasm'),
    zkey: join(__dirname, '../../circuits/state_verification.zkey'),
    vkey: join(__dirname, '../../circuits/state_verification_vkey.json')
  }
};

/**
 * Check if circuits are compiled
 */
export function checkCircuitsCompiled() {
  const status = {};
  for (const [name, paths] of Object.entries(CIRCUIT_PATHS)) {
    status[name] = {
      wasm: existsSync(paths.wasm),
      zkey: existsSync(paths.zkey),
      vkey: existsSync(paths.vkey),
      ready: existsSync(paths.wasm) && existsSync(paths.zkey) && existsSync(paths.vkey)
    };
  }
  return status;
}

/**
 * Generate ZK proof for age verification
 */
export async function generateAgeProof(privateInputs, publicInputs) {
  const circuitStatus = checkCircuitsCompiled();

  if (!circuitStatus.age.ready) {
    throw new Error('Age circuit not compiled. Please compile circuits first.');
  }

  const startTime = Date.now();

  // Generate a random salt if not provided
  const salt = privateInputs.salt || Math.floor(Math.random() * 1000000000);

  const input = {
    birthYear: privateInputs.dateOfBirth.year,
    birthMonth: privateInputs.dateOfBirth.month,
    birthDay: privateInputs.dateOfBirth.day,
    salt: salt,
    currentYear: publicInputs.currentDate.year,
    currentMonth: publicInputs.currentDate.month,
    currentDay: publicInputs.currentDate.day,
    minimumAge: publicInputs.minimumAge
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    CIRCUIT_PATHS.age.wasm,
    CIRCUIT_PATHS.age.zkey
  );

  const proofTime = Date.now() - startTime;

  // publicSignals from circuit: [isValid, nullifier]
  const isValid = publicSignals[0] === '1';
  const nullifier = publicSignals[1];

  return {
    proof,
    publicSignals,
    nullifier,
    isValid,
    proofTime,
    simulated: false
  };
}

/**
 * Verify a ZK proof using snarkjs
 */
export async function verifyProof(verificationType, proof, publicSignals) {
  const startTime = Date.now();
  const circuitStatus = checkCircuitsCompiled();

  if (!circuitStatus[verificationType]?.ready) {
    throw new Error(`Circuit ${verificationType} is not compiled`);
  }

  try {
    const vkeyPath = CIRCUIT_PATHS[verificationType].vkey;
    const vkey = JSON.parse(readFileSync(vkeyPath, 'utf8'));

    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return {
      valid,
      verificationTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('snarkjs verification error:', error.message);
    throw new Error(`Verification failed: ${error.message}`);
  }
}

/**
 * Get circuit status and info
 */
export function getCircuitInfo() {
  const status = checkCircuitsCompiled();

  return {
    circuits: status,
    allReady: Object.values(status).every(s => s.ready),
    message: Object.values(status).every(s => s.ready)
      ? 'All circuits compiled and ready'
      : 'Circuits not compiled - please compile circuits before generating proofs'
  };
}

export default {
  checkCircuitsCompiled,
  generateAgeProof,
  verifyProof,
  getCircuitInfo
};
