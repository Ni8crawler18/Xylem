/**
 * SD-JWT Parser — handles UIDAI Pehchaan Selective Disclosure JWT format.
 *
 * An SD-JWT looks like:
 *   header.payload.signature~disclosure1~disclosure2~...
 *
 * The payload contains a `_sd` array of SHA-256 hashes, one per hidden claim.
 * Each disclosure is a base64url-encoded JSON array: [salt, claim_name, claim_value]
 * SHA-256(base64url(disclosure)) must match an entry in _sd.
 */

function base64urlDecode(s) {
  // Convert base64url to base64
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  // Pad to multiple of 4
  while (s.length % 4) s += '='
  try {
    return atob(s)
  } catch (e) {
    throw new Error('Invalid base64url encoding')
  }
}

function base64urlDecodeToJson(s) {
  const decoded = base64urlDecode(s)
  return JSON.parse(decoded)
}

/**
 * Compute SHA-256 of a string, return base64url (no padding)
 */
async function sha256base64url(input) {
  const msgBuffer = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  // Convert to base64, then to base64url
  const base64 = btoa(String.fromCharCode(...hashArray))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Parse an SD-JWT string into structured components.
 */
export async function parseSdJwt(sdJwtString) {
  const parts = sdJwtString.trim().split('~')
  const jwtPart = parts[0]
  const disclosureParts = parts.slice(1).filter(p => p.length > 0)

  const jwtSegments = jwtPart.split('.')
  if (jwtSegments.length !== 3) {
    throw new Error('Invalid JWT structure')
  }

  const [headerB64, payloadB64, signatureB64] = jwtSegments
  const header = base64urlDecodeToJson(headerB64)
  const payload = base64urlDecodeToJson(payloadB64)

  // Parse each disclosure
  const disclosures = []
  for (const rawDisclosure of disclosureParts) {
    try {
      const decoded = base64urlDecodeToJson(rawDisclosure)
      const sdHash = await sha256base64url(rawDisclosure)
      const sdIndex = payload._sd ? payload._sd.indexOf(sdHash) : -1

      disclosures.push({
        raw: rawDisclosure,
        salt: decoded[0],
        claimName: decoded[1],
        claimValue: decoded[2],
        sdHash,
        sdIndex
      })
    } catch (e) {
      console.warn('Failed to parse disclosure:', e)
    }
  }

  // Hidden claims = _sd entries not matched by any disclosure
  const disclosedHashes = new Set(disclosures.map(d => d.sdHash))
  const hiddenClaims = (payload._sd || []).map((hash, idx) => ({
    index: idx,
    hash,
    disclosed: disclosedHashes.has(hash)
  }))

  return {
    raw: {
      header: headerB64,
      payload: payloadB64,
      signature: signatureB64
    },
    header,
    payload,
    signature: signatureB64,
    disclosures,
    hiddenClaims,
    totalClaims: payload._sd ? payload._sd.length : 0,
    disclosedCount: disclosures.length,
    hiddenCount: (payload._sd?.length || 0) - disclosures.length
  }
}

/**
 * Map a disclosure claim_name to one of our circuits.
 */
export function mapClaimToCircuit(claimName) {
  const name = (claimName || '').toLowerCase()
  if (name === 'dob' || name.includes('birth')) return 'age'
  if (name.includes('aadhaar') || name.includes('uidref')) return 'aadhaar'
  if (name.includes('address') || name.includes('pincode') || name.includes('state')) return 'state'
  if (name.includes('age')) return 'age'
  return null
}

/**
 * Extract circuit inputs from a disclosure based on its claim type.
 */
export function disclosureToCircuitInputs(disclosure) {
  const circuit = mapClaimToCircuit(disclosure.claimName)
  const value = disclosure.claimValue

  switch (circuit) {
    case 'age': {
      // DOB format: "2004-10-02" or similar
      if (typeof value === 'string') {
        const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (match) {
          return {
            circuit: 'age',
            privateInputs: {
              dateOfBirth: {
                year: parseInt(match[1]),
                month: parseInt(match[2]),
                day: parseInt(match[3])
              }
            }
          }
        }
      }
      return { circuit: 'age', privateInputs: {} }
    }
    case 'state': {
      // Extract 6-digit pincode from address string
      if (typeof value === 'string') {
        const pincodeMatch = value.match(/\b(\d{6})\b/)
        if (pincodeMatch) {
          const pincode = parseInt(pincodeMatch[1])
          return {
            circuit: 'state',
            privateInputs: {
              pincode,
              stateCode: Math.floor(pincode / 10000)
            }
          }
        }
      }
      return { circuit: 'state', privateInputs: {} }
    }
    case 'aadhaar':
      return { circuit: 'aadhaar', privateInputs: {} }
    default:
      return { circuit: null, privateInputs: {} }
  }
}
