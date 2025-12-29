import { buildPoseidon } from 'circomlibjs';
import { v4 as uuidv4 } from 'uuid';

let poseidon = null;

async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

/**
 * Convert string to array of field elements for hashing
 */
function stringToFieldElements(str, length = 32) {
  const bytes = Buffer.from(str, 'utf8');
  const elements = [];
  for (let i = 0; i < length; i++) {
    elements.push(BigInt(bytes[i] || 0));
  }
  return elements;
}

/**
 * Parse date string to components
 */
function parseDateOfBirth(dateStr) {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

/**
 * Parse Aadhaar number to array of digits
 */
function parseAadhaar(aadhaar) {
  return aadhaar.split('').map(d => parseInt(d, 10));
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Hash credential data using Poseidon hash
 */
export async function hashCredentialData(data) {
  const poseidon = await getPoseidon();

  // Create a deterministic hash from credential data
  const { year, month, day } = parseDateOfBirth(data.dateOfBirth);
  const aadhaarDigits = parseAadhaar(data.aadhaarNumber);

  // Hash components
  const dobHash = poseidon.F.toString(poseidon([year, month, day]));
  const aadhaarHash = poseidon.F.toString(poseidon(aadhaarDigits.slice(0, 6)));
  const aadhaarHash2 = poseidon.F.toString(poseidon(aadhaarDigits.slice(6, 12)));

  // Combine into final commitment
  const commitment = poseidon.F.toString(
    poseidon([BigInt(dobHash), BigInt(aadhaarHash), BigInt(aadhaarHash2)])
  );

  return commitment;
}

/**
 * Generate a signed credential for a user
 */
export async function generateCredential(userData, issuer) {
  const poseidon = await getPoseidon();

  const { year, month, day } = parseDateOfBirth(userData.dateOfBirth);
  const aadhaarDigits = parseAadhaar(userData.aadhaarNumber);
  const age = calculateAge(userData.dateOfBirth);

  // Generate credential commitment
  const commitment = await hashCredentialData(userData);

  // Generate a random salt for nullifier derivation
  const salt = BigInt('0x' + uuidv4().replace(/-/g, ''));

  // Create nullifier base (used to derive unique nullifiers per verification)
  const nullifierBase = poseidon.F.toString(
    poseidon([BigInt(commitment), salt])
  );

  // Create signature (simplified - in production use EdDSA)
  // This is a placeholder - real implementation would use circomlibjs EdDSA
  const signatureMessage = poseidon.F.toString(
    poseidon([BigInt(commitment), BigInt(issuer.public_key_x.slice(0, 20))])
  );

  const signature = {
    R8: [signatureMessage.slice(0, 32), signatureMessage.slice(32, 64) || '0'],
    S: signatureMessage
  };

  // Expiry: 1 year from now
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return {
    commitment,
    signature,
    nullifierBase,
    expiresAt: expiresAt.toISOString(),

    // Public inputs (can be shared with verifier)
    publicInputs: {
      commitment,
      issuerPubKey: [issuer.public_key_x, issuer.public_key_y],
      currentDate: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate()
      }
    },

    // Private inputs (user keeps secret, used to generate proofs)
    privateInputs: {
      dateOfBirth: { year, month, day },
      aadhaarDigits,
      age,
      pincode: parseInt(userData.pincode) || 0,
      stateCode: extractStateCode(userData.pincode),
      salt: salt.toString(),
      nullifierBase
    }
  };
}

/**
 * Extract state code from Indian pincode (first 2 digits indicate region)
 */
function extractStateCode(pincode) {
  if (!pincode || pincode.length < 2) return 0;
  return parseInt(pincode.substring(0, 2), 10);
}

/**
 * Verify a signature (simplified)
 */
export async function verifySignature(commitment, signature, issuerPubKey) {
  // Simplified verification - in production use EdDSA verification
  const poseidon = await getPoseidon();

  const expectedMessage = poseidon.F.toString(
    poseidon([BigInt(commitment), BigInt(issuerPubKey[0].slice(0, 20))])
  );

  return signature.S === expectedMessage;
}

/**
 * Generate nullifier for a specific verification type
 */
export async function generateNullifier(nullifierBase, verificationType) {
  const poseidon = await getPoseidon();

  const typeHash = {
    'age': 1,
    'aadhaar': 2,
    'state': 3,
    'multi': 4
  };

  const nullifier = poseidon.F.toString(
    poseidon([BigInt(nullifierBase), BigInt(typeHash[verificationType] || 0)])
  );

  return nullifier;
}

export default {
  hashCredentialData,
  generateCredential,
  verifySignature,
  generateNullifier
};
