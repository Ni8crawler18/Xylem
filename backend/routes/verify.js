import { Router } from 'express';
import { verificationOps, verificationRequestOps } from '../services/db.js';
import {
  verifyProof,
  generateAgeProof,
  getCircuitInfo
} from '../services/zkp.js';

const router = Router();

/**
 * GET /api/v1/verify/status
 */
router.get('/status', (req, res) => {
  const circuitInfo = getCircuitInfo();
  res.json(circuitInfo);
});

/**
 * POST /api/v1/verify/age
 */
router.post('/age', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { proof, publicSignals, nullifier } = req.body;

    if (!proof || !publicSignals || !nullifier) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: proof, publicSignals, nullifier'
      });
    }

    // Check for replay attack (nullifier must be unique)
    const existingVerification = await verificationOps.findByNullifier(nullifier);
    if (existingVerification) {
      return res.status(400).json({
        error: true,
        message: 'Proof has already been used (nullifier collision)',
        code: 'NULLIFIER_REUSE'
      });
    }

    const verificationResult = await verifyProof('age', proof, publicSignals);
    const verificationTime = Date.now() - startTime;

    // Public signals: [0]=isValid, [1]=nullifier, [2]=currentYear, [3]=currentMonth, [4]=currentDay, [5]=minimumAge
    const isOver18 = publicSignals[0] === '1';
    const minimumAge = parseInt(publicSignals[5]) || 18;
    const isSuccessful = verificationResult.valid && isOver18;

    // Only store nullifier for successful verifications to prevent replay attacks
    // Failed verifications (e.g., age < 18) should allow retry with same credentials
    let verificationId = null;
    if (isSuccessful) {
      verificationId = await verificationOps.create({
        verification_type: 'age',
        nullifier,
        public_signals: publicSignals,
        verification_time_ms: verificationTime,
        result: true
      });
    }

    res.json({
      success: true,
      verified: isSuccessful,
      attribute: `age >= ${minimumAge}`,
      verificationId,
      verificationTime: `${verificationTime}ms`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/verify/aadhaar
 */
router.post('/aadhaar', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { proof, publicSignals, nullifier } = req.body;

    if (!proof || !publicSignals || !nullifier) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: proof, publicSignals, nullifier'
      });
    }

    // Check for replay attack
    const existingVerification = await verificationOps.findByNullifier(nullifier);
    if (existingVerification) {
      return res.status(400).json({
        error: true,
        message: 'Proof has already been used',
        code: 'NULLIFIER_REUSE'
      });
    }

    const verificationResult = await verifyProof('aadhaar', proof, publicSignals);
    const verificationTime = Date.now() - startTime;

    const isValid = publicSignals[0] === '1';
    const isSuccessful = verificationResult.valid && isValid;

    // Only store nullifier for successful verifications
    let verificationId = null;
    if (isSuccessful) {
      verificationId = await verificationOps.create({
        verification_type: 'aadhaar',
        nullifier,
        public_signals: publicSignals,
        verification_time_ms: verificationTime,
        result: true
      });
    }

    res.json({
      success: true,
      verified: isSuccessful,
      attribute: 'valid_aadhaar',
      verificationId,
      verificationTime: `${verificationTime}ms`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/verify/state
 */
router.post('/state', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { proof, publicSignals, nullifier, requiredState } = req.body;

    if (!proof || !publicSignals || !nullifier) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: proof, publicSignals, nullifier'
      });
    }

    // Check for replay attack
    const existingVerification = await verificationOps.findByNullifier(nullifier);
    if (existingVerification) {
      return res.status(400).json({
        error: true,
        message: 'Proof has already been used',
        code: 'NULLIFIER_REUSE'
      });
    }

    const verificationResult = await verifyProof('state', proof, publicSignals);
    const verificationTime = Date.now() - startTime;

    // Public signals: [0]=isFromState, [1]=nullifier, [2]=requiredStateCode
    const isFromState = publicSignals[0] === '1';
    const stateCode = publicSignals[2]; // requiredStateCode, not nullifier
    const isSuccessful = verificationResult.valid && isFromState;

    // Only store nullifier for successful verifications
    let verificationId = null;
    if (isSuccessful) {
      verificationId = await verificationOps.create({
        verification_type: 'state',
        nullifier,
        public_signals: publicSignals,
        verification_time_ms: verificationTime,
        result: true,
        metadata: { requiredState }
      });
    }

    res.json({
      success: true,
      verified: isSuccessful,
      attribute: `resident_of_state_${stateCode}`,
      verificationId,
      verificationTime: `${verificationTime}ms`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/verify/composite
 * Multi-attribute verification: accepts N proofs from different circuits,
 * verifies each, checks all nullifiers unique, stores as a single composite record.
 * Body: { proofs: [{ type, proof, publicSignals, nullifier }, ...] }
 */
router.post('/composite', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { proofs, verifierName } = req.body;
    if (!Array.isArray(proofs) || proofs.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Expected non-empty array of proofs'
      });
    }

    const results = [];
    const usedNullifiers = new Set();

    // Verify each proof
    for (const p of proofs) {
      if (!p.type || !p.proof || !p.publicSignals || !p.nullifier) {
        return res.status(400).json({
          error: true,
          message: `Malformed proof entry: missing type/proof/publicSignals/nullifier`
        });
      }

      // Replay check against DB
      const existing = await verificationOps.findByNullifier(p.nullifier);
      if (existing) {
        return res.status(400).json({
          error: true,
          message: `Proof for ${p.type} already used (nullifier replay)`,
          code: 'NULLIFIER_REUSE'
        });
      }

      // Dedup within this request
      if (usedNullifiers.has(p.nullifier)) {
        return res.status(400).json({
          error: true,
          message: `Duplicate nullifier in composite request`
        });
      }
      usedNullifiers.add(p.nullifier);

      const vr = await verifyProof(p.type, p.proof, p.publicSignals);
      const attrValid = p.publicSignals[0] === '1';

      results.push({
        type: p.type,
        cryptographicallyValid: vr.valid,
        attributeValid: attrValid,
        passed: vr.valid && attrValid,
        nullifier: p.nullifier
      });
    }

    // AND all results
    const allPassed = results.every(r => r.passed);
    const verificationTime = Date.now() - startTime;

    // Store each successful attribute's nullifier (only on full composite success,
    // to allow retry if one attribute fails)
    let verificationIds = [];
    if (allPassed) {
      for (const r of results) {
        const id = await verificationOps.create({
          verification_type: `composite_${r.type}`,
          nullifier: r.nullifier,
          public_signals: [],
          verification_time_ms: verificationTime,
          result: true,
          verifier_id: verifierName || null,
          metadata: {
            compositeAttributes: results.map(x => x.type),
            verifierName: verifierName || null
          }
        });
        verificationIds.push(id);
      }
    }

    res.json({
      success: true,
      verified: allPassed,
      attributes: results.map(r => ({
        type: r.type,
        passed: r.passed
      })),
      totalAttributes: results.length,
      passedAttributes: results.filter(r => r.passed).length,
      verificationIds,
      verificationTime: `${verificationTime}ms`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/verify/generate-proof
 */
router.post('/generate-proof', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { type, privateInputs, publicInputs } = req.body;

    if (!type || !privateInputs || !publicInputs) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: type, privateInputs, publicInputs'
      });
    }

    let result;
    switch (type) {
      case 'age':
        result = await generateAgeProof(privateInputs, publicInputs);
        break;
      case 'aadhaar':
      case 'state':
        return res.status(400).json({
          error: true,
          message: 'Server-side proof generation not supported for this type. Generate proofs client-side for privacy.'
        });
      default:
        return res.status(400).json({
          error: true,
          message: 'Invalid verification type. Use: age, aadhaar, or state'
        });
    }

    const totalTime = Date.now() - startTime;

    res.json({
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      nullifier: result.nullifier,
      isValid: result.isValid,
      proofGenerationTime: `${result.proofTime}ms`,
      totalTime: `${totalTime}ms`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/verify/history
 */
router.get('/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const history = await verificationOps.getHistory(limit, offset);
  const stats = await verificationOps.getStats();

  res.json({
    verifications: history.map(v => ({
      id: v.id,
      type: v.verification_type,
      result: v.result === 1,
      verifiedAt: v.verified_at,
      verificationTimeMs: v.verification_time_ms,
    })),
    stats,
    pagination: { limit, offset, total: history.length }
  });
});

/**
 * POST /api/v1/verify/request - Create verification request (QR code)
 */
router.post('/request', async (req, res, next) => {
  try {
    const { verificationType, verifierName } = req.body;

    if (!verificationType) {
      return res.status(400).json({
        error: true,
        message: 'Missing required field: verificationType'
      });
    }

    const validTypes = ['age', 'aadhaar', 'state'];
    if (!validTypes.includes(verificationType)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid verification type. Use: age, aadhaar, or state'
      });
    }

    const request = await verificationRequestOps.create({
      verification_type: verificationType,
      verifier_name: verifierName
    });

    res.json({
      success: true,
      requestId: request.id,
      verificationType,
      expiresAt: request.expiresAt,
      qrData: JSON.stringify({
        requestId: request.id,
        type: verificationType,
        verifier: verifierName || 'Anonymous Verifier'
      })
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/verify/request/:id - Get verification request status
 */
router.get('/request/:id', async (req, res, next) => {
  try {
    const request = await verificationRequestOps.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        error: true,
        message: 'Verification request not found'
      });
    }

    const isExpired = new Date(request.expires_at) < new Date();

    res.json({
      success: true,
      request: {
        id: request.id,
        verificationType: request.verification_type,
        verifierName: request.verifier_name,
        status: isExpired && request.status === 'pending' ? 'expired' : request.status,
        createdAt: request.created_at,
        expiresAt: request.expires_at,
        completedAt: request.completed_at,
        verificationId: request.verification_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/verify/request/:id/complete - Complete verification request with proof
 */
router.post('/request/:id/complete', async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { proof, publicSignals, nullifier } = req.body;
    const requestId = req.params.id;

    const request = await verificationRequestOps.findById(requestId);

    if (!request) {
      return res.status(404).json({
        error: true,
        message: 'Verification request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: true,
        message: 'Verification request already completed or expired'
      });
    }

    if (new Date(request.expires_at) < new Date()) {
      await verificationRequestOps.updateStatus(requestId, 'expired');
      return res.status(400).json({
        error: true,
        message: 'Verification request has expired'
      });
    }

    if (!proof || !publicSignals || !nullifier) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: proof, publicSignals, nullifier'
      });
    }

    // Check for replay attack
    const existingVerification = await verificationOps.findByNullifier(nullifier);
    if (existingVerification) {
      return res.status(400).json({
        error: true,
        message: 'Proof has already been used (nullifier collision)',
        code: 'NULLIFIER_REUSE'
      });
    }

    const verificationType = request.verification_type;
    const verificationResult = await verifyProof(verificationType, proof, publicSignals);
    const verificationTime = Date.now() - startTime;

    const isValid = publicSignals[0] === '1';
    const isSuccessful = verificationResult.valid && isValid;

    let verificationId = null;
    if (isSuccessful) {
      verificationId = await verificationOps.create({
        verification_type: verificationType,
        nullifier,
        public_signals: publicSignals,
        verification_time_ms: verificationTime,
        result: true
      });
    }

    await verificationRequestOps.updateStatus(
      requestId,
      isSuccessful ? 'completed' : 'failed',
      verificationId
    );

    res.json({
      success: true,
      verified: isSuccessful,
      requestId,
      verificationId,
      verificationTime: `${verificationTime}ms`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
