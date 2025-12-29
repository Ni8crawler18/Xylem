import * as snarkjs from 'snarkjs'

const CIRCUIT_PATHS = {
  age: {
    wasm: '/circuits/age_verification_js/age_verification.wasm',
    zkey: '/circuits/age_verification.zkey'
  },
  aadhaar: {
    wasm: '/circuits/aadhaar_validity_js/aadhaar_validity.wasm',
    zkey: '/circuits/aadhaar_validity.zkey'
  },
  state: {
    wasm: '/circuits/state_verification_js/state_verification.wasm',
    zkey: '/circuits/state_verification.zkey'
  }
}

/**
 * Generate a real ZK proof using snarkjs
 */
export async function generateProofClientSide(verificationType, privateInputs, publicInputs) {
  const startTime = performance.now()

  const paths = CIRCUIT_PATHS[verificationType]
  if (!paths) {
    throw new Error(`Unknown verification type: ${verificationType}`)
  }

  let input = {}
  let isValid = false

  switch (verificationType) {
    case 'age': {
      const { dateOfBirth } = privateInputs
      const { minimumAge, currentDate } = publicInputs

      // Calculate age for validation
      let age = currentDate.year - dateOfBirth.year
      const monthDiff = currentDate.month - dateOfBirth.month
      if (monthDiff < 0 || (monthDiff === 0 && currentDate.day < dateOfBirth.day)) {
        age--
      }
      isValid = age >= minimumAge

      // Circuit inputs
      input = {
        birthYear: dateOfBirth.year,
        birthMonth: dateOfBirth.month,
        birthDay: dateOfBirth.day,
        salt: privateInputs.salt || Math.floor(Math.random() * 1000000000),
        currentYear: currentDate.year,
        currentMonth: currentDate.month,
        currentDay: currentDate.day,
        minimumAge: minimumAge
      }
      break
    }

    case 'aadhaar': {
      const { aadhaarDigits } = privateInputs
      const { commitment } = publicInputs

      // Validate Aadhaar format
      isValid = aadhaarDigits &&
        aadhaarDigits.length === 12 &&
        aadhaarDigits.every(d => d >= 0 && d <= 9) &&
        aadhaarDigits[0] !== 0 && aadhaarDigits[0] !== 1

      // Circuit inputs - signal names must match circuit definition
      input = {
        aadhaar: aadhaarDigits,
        salt: privateInputs.salt || Math.floor(Math.random() * 1000000000),
        credentialCommitment: commitment || '0'
      }
      break
    }

    case 'state': {
      const { pincode, stateCode } = privateInputs
      const { requiredStateCode } = publicInputs

      isValid = stateCode === requiredStateCode

      // Circuit inputs - stateCode is calculated internally from pincode
      input = {
        pincode: pincode,
        salt: privateInputs.salt || Math.floor(Math.random() * 1000000000),
        requiredStateCode: requiredStateCode
      }
      break
    }

    default:
      throw new Error(`Unknown verification type: ${verificationType}`)
  }

  try {
    // Generate real proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      paths.wasm,
      paths.zkey
    )

    const proofTime = Math.round(performance.now() - startTime)

    // Extract nullifier from public signals (last element typically)
    const nullifier = publicSignals[publicSignals.length - 1] || publicSignals[1]

    return {
      proof,
      publicSignals,
      nullifier,
      isValid: publicSignals[0] === '1',
      proofTime,
      simulated: false
    }
  } catch (error) {
    console.error('Proof generation failed:', error)
    throw new Error(`Failed to generate proof: ${error.message}`)
  }
}

/**
 * Verify a proof client-side (optional, for testing)
 */
export async function verifyProofClientSide(verificationType, proof, publicSignals) {
  try {
    const vkeyResponse = await fetch(`/circuits/${verificationType}_verification_vkey.json`)
    const vkey = await vkeyResponse.json()

    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof)
    return valid
  } catch (error) {
    console.error('Client-side verification failed:', error)
    return false
  }
}

/**
 * Generate a random nullifier
 */
export function generateRandomNullifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default {
  generateProofClientSide,
  verifyProofClientSide,
  generateRandomNullifier
}
