import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { credentialOps, issuerOps } from '../services/db.js';
import { generateCredential } from '../services/issuer.js';

const router = Router();

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
      processingTime: `${processingTime}ms`,
      notice: 'Store your credential securely. The private inputs should never be shared.'
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
