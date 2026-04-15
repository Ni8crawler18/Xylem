import { Router } from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { credentialOps, issuerOps } from '../services/db.js';
import { generateCredential } from '../services/issuer.js';
import { parseSdJwtNode } from '../services/sdJwtParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PYTHON_EXTRACTOR = join(__dirname, '../../scripts/extract_aadhaar_jwt.py');
const HAS_PYTHON_EXTRACTOR = existsSync(PYTHON_EXTRACTOR);

const router = Router();

function runPythonExtractor(jwt) {
  return new Promise((resolve, reject) => {
    const extractor = spawn('python3', [PYTHON_EXTRACTOR], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    extractor.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    extractor.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    extractor.on('error', reject);
    extractor.on('close', (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error(stderr.trim() || `extractor exited ${exitCode}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
    extractor.stdin.write(jwt.trim());
    extractor.stdin.end();
  });
}

/**
 * POST /api/v1/credentials/extract-jwt
 * Parses a UIDAI Pehchaan SD-JWT and returns normalized claims.
 * Uses the Python extractor when available; falls back to a Node
 * implementation otherwise (required on Render / environments
 * without python3 installed).
 *
 * Body: { jwt: '<raw SD-JWT string>' }
 */
router.post('/extract-jwt', async (req, res, next) => {
  try {
    const { jwt } = req.body;
    if (!jwt || typeof jwt !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Missing required field: jwt (string)'
      });
    }

    let parsed;
    let extractor = 'node';

    if (HAS_PYTHON_EXTRACTOR) {
      try {
        parsed = await runPythonExtractor(jwt);
        extractor = 'python';
      } catch (err) {
        // Fall through to Node parser if python3 is not available
        parsed = null;
      }
    }

    if (!parsed) {
      parsed = parseSdJwtNode(jwt);
    }

    res.json({
      success: true,
      extractor,
      claims: parsed.extracted_claims || {},
      header: parsed.header,
      payload: parsed.payload,
      signature: parsed.signature,
      disclosuresCount: (parsed.disclosures || []).length,
      hiddenClaimsCount: parsed.hidden_claims_count || 0
    });
  } catch (error) {
    if (error.message && error.message.startsWith('Invalid JWT')) {
      return res.status(400).json({ error: true, message: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/v1/credentials/issue
 * Issues a signed credential to a user
 */
router.post('/issue', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { name, dateOfBirth, aadhaarNumber, address, pincode, state } = req.body;

    // Validate required fields
    if (!name || !dateOfBirth || !aadhaarNumber) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: name, dateOfBirth, aadhaarNumber'
      });
    }

    // Validate Aadhaar format (12 digits)
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid Aadhaar number format. Must be 12 digits.'
      });
    }

    // Validate date of birth format
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({
        error: true,
        message: 'Invalid date of birth format'
      });
    }

    // Get default issuer
    const issuers = await issuerOps.getAll();
    if (issuers.length === 0) {
      return res.status(500).json({
        error: true,
        message: 'No active issuers available'
      });
    }
    const issuer = issuers[0];

    // Generate credential with cryptographic commitment
    const credentialData = {
      name,
      dateOfBirth,
      aadhaarNumber,
      address: address || '',
      pincode: pincode || '',
      state: state || ''
    };

    const credential = await generateCredential(credentialData, issuer);

    // Store only the commitment (no PII)
    const credentialId = await credentialOps.create({
      issuer_id: issuer.id,
      commitment: credential.commitment,
      credential_type: 'identity',
      expires_at: credential.expiresAt
    });

    const processingTime = Date.now() - startTime;

    // Return credential to user
    res.json({
      success: true,
      credential: {
        id: credentialId,
        commitment: credential.commitment,
        signature: credential.signature,
        publicInputs: credential.publicInputs,
        privateInputs: credential.privateInputs,
        issuer: {
          id: issuer.id,
          name: issuer.name,
          publicKey: [issuer.public_key_x, issuer.public_key_y]
        },
        issuedAt: new Date().toISOString(),
        expiresAt: credential.expiresAt
      },
      processingTime: `${processingTime}ms`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/credentials/verify-commitment/:commitment
 */
router.get('/verify-commitment/:commitment', async (req, res) => {
  const { commitment } = req.params;

  const isValid = await credentialOps.isValid(commitment);
  const credential = await credentialOps.findByCommitment(commitment);

  res.json({
    valid: isValid,
    ...(credential && {
      issuedAt: credential.issued_at,
      expiresAt: credential.expires_at,
      revoked: credential.revoked === 1
    })
  });
});

/**
 * GET /api/v1/credentials/issuers
 */
router.get('/issuers', async (req, res) => {
  const issuers = await issuerOps.getAll();

  res.json({
    issuers: issuers.map(issuer => ({
      id: issuer.id,
      name: issuer.name,
      publicKey: [issuer.public_key_x, issuer.public_key_y],
      createdAt: issuer.created_at
    }))
  });
});

export default router;
