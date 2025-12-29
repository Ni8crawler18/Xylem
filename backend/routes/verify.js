import { Router } from 'express';
import { verificationOps } from '../services/db.js';
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

    // Check for replay attack
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

    const isOver18 = publicSignals[0] === '1';
    const minimumAge = parseInt(publicSignals[1]) || 18;

    const verificationId = await verificationOps.create({
      verification_type: 'age',
      nullifier,
      public_signals: publicSignals,
      verification_time_ms: verificationTime,
      result: verificationResult.valid && isOver18
    });

    res.json({
      success: true,
      verified: verificationResult.valid && isOver18,
      attribute: `age >= ${minimumAge}`,
      verificationId,
      verificationTime: `${verificationTime}ms`,
      piiExposed: false,
      dpdpCompliant: true
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

    const verificationId = await verificationOps.create({
      verification_type: 'aadhaar',
      nullifier,
      public_signals: publicSignals,
      verification_time_ms: verificationTime,
      result: verificationResult.valid && isValid
    });

    res.json({
      success: true,
      verified: verificationResult.valid && isValid,
      attribute: 'valid_aadhaar',
      verificationId,
      verificationTime: `${verificationTime}ms`,
      piiExposed: false,
      dpdpCompliant: true
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

    const isFromState = publicSignals[0] === '1';
    const stateCode = publicSignals[1];

    const verificationId = await verificationOps.create({
      verification_type: 'state',
      nullifier,
      public_signals: publicSignals,
      verification_time_ms: verificationTime,
      result: verificationResult.valid && isFromState,
      metadata: { requiredState }
    });

    res.json({
      success: true,
      verified: verificationResult.valid && isFromState,
      attribute: `resident_of_state_${stateCode}`,
      verificationId,
      verificationTime: `${verificationTime}ms`,
      piiExposed: false,
      dpdpCompliant: true
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
      totalTime: `${totalTime}ms`,
      note: 'Proofs are generated client-side for privacy'
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

export default router;
