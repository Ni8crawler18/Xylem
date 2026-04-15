/**
 * Node port of scripts/extract_aadhaar_jwt.py — used as a fallback when
 * Python is not available (e.g. Render's default Node runtime).
 *
 * Parses a UIDAI Pehchaan SD-JWT, verifies each disclosure hash against
 * the payload's _sd array, and extracts normalized credential claims.
 */

import { createHash } from 'crypto';

function b64urlDecodeToString(data) {
  const pad = (4 - (data.length % 4)) % 4;
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(base64, 'base64').toString('utf8');
}

function b64urlDecodeToBuffer(data) {
  const pad = (4 - (data.length % 4)) % 4;
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(base64, 'base64');
}

function sha256Base64Url(input) {
  const hash = createHash('sha256').update(input, 'ascii').digest('base64');
  return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeClaims(disclosures) {
  const out = {};
  for (const d of disclosures) {
    const claimName = d.claim_name || '';
    const value = d.claim_value;
    if (typeof value !== 'string') continue;
    const name = claimName.toLowerCase();

    if (name === 'dob' || name.includes('birth')) {
      const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) out.dateOfBirth = `${m[1]}-${m[2]}-${m[3]}`;
    }
    if (name.includes('address') || name.includes('addr')) {
      const p = value.match(/\b(\d{6})\b/);
      if (p) {
        out.pincode = p[1];
        out.stateCode = p[1].slice(0, 2);
      }
    }
    if (name === 'pincode' || name === 'pin') {
      const p = value.match(/\b(\d{6})\b/);
      if (p) {
        out.pincode = p[1];
        out.stateCode = p[1].slice(0, 2);
      }
    }
    if (name === 'residentname' || name === 'name' || name.includes('fullname')) {
      out.name = value;
    }
    if (name.includes('aadhaar') || name === 'uid' || name === 'uidref') {
      const m = value.match(/\b(\d{12})\b/);
      if (m) out.aadhaarNumber = m[1];
    }
    if (name === 'gender' || name === 'sex') {
      out.gender = value.toUpperCase().slice(0, 1);
    }
  }
  return out;
}

export function parseSdJwtNode(rawToken) {
  const trimmed = String(rawToken).trim();
  const parts = trimmed.split('~');
  const jwtPart = parts[0];
  const disclosureParts = parts.slice(1).filter(Boolean);

  const segments = jwtPart.split('.');
  if (segments.length !== 3) {
    throw new Error(`Invalid JWT structure: expected 3 segments, got ${segments.length}`);
  }
  const [headerB64, payloadB64, signatureB64] = segments;

  const header = JSON.parse(b64urlDecodeToString(headerB64));
  const payload = JSON.parse(b64urlDecodeToString(payloadB64));
  const sdArray = Array.isArray(payload._sd) ? payload._sd : [];

  const disclosures = [];
  for (const raw of disclosureParts) {
    try {
      const jsonStr = b64urlDecodeToString(raw);
      const decoded = JSON.parse(jsonStr);
      if (!Array.isArray(decoded) || decoded.length < 3) continue;
      const [salt, claimName, claimValue] = decoded;
      const sha = sha256Base64Url(raw);
      const sdIndex = sdArray.indexOf(sha);
      disclosures.push({
        raw,
        salt,
        claim_name: claimName,
        claim_value: claimValue,
        sha256: sha,
        sd_index: sdIndex,
        verified: sdIndex >= 0
      });
    } catch {
      // binary/photo disclosures skipped silently
      continue;
    }
  }

  const hiddenCount = Math.max(0, sdArray.length - disclosures.length);
  const signatureBytes = b64urlDecodeToBuffer(signatureB64).length;

  return {
    header,
    payload: {
      iss: payload.iss,
      id: payload.id,
      iat: payload.iat,
      exp: payload.exp,
      cnf: payload.cnf || {},
      _sd_alg: payload._sd_alg,
      _sd_count: sdArray.length
    },
    signature: {
      algorithm: header.alg,
      key_id: header.kid,
      type: header.typ,
      bytes: signatureBytes,
      bits: signatureBytes * 8
    },
    disclosures,
    hidden_claims_count: hiddenCount,
    extracted_claims: normalizeClaims(disclosures)
  };
}
