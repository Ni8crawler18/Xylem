import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/eigenparse.db');

let db = null;
let SQL = null;

async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function getDb() {
  if (!db) {
    const SQL = await initSQL();

    // Ensure data directory exists
    const dataDir = dirname(DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Load existing database or create new one
    if (existsSync(DB_PATH)) {
      const fileBuffer = readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  }
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

export async function initializeDatabase() {
  const db = await getDb();

  // Verifications table - stores verification records without PII
  db.run(`
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      verification_type TEXT NOT NULL,
      nullifier TEXT UNIQUE NOT NULL,
      public_signals TEXT,
      verified_at TEXT DEFAULT (datetime('now')),
      proof_generation_time_ms INTEGER,
      verification_time_ms INTEGER,
      result INTEGER NOT NULL,
      verifier_id TEXT,
      metadata TEXT
    )
  `);

  // Issuers table - trusted credential issuers
  db.run(`
    CREATE TABLE IF NOT EXISTS issuers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public_key_x TEXT NOT NULL,
      public_key_y TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Credentials table - issued credentials (commitment only, no PII)
  db.run(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      issuer_id TEXT NOT NULL,
      commitment TEXT NOT NULL UNIQUE,
      credential_type TEXT NOT NULL,
      issued_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      revoked INTEGER DEFAULT 0
    )
  `);

  // Verification requests table - for QR code verification flow
  db.run(`
    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      verification_type TEXT NOT NULL,
      verifier_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      completed_at TEXT,
      verification_id TEXT
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_verifications_type ON verifications(verification_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_verifications_nullifier ON verifications(nullifier)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_credentials_commitment ON credentials(commitment)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status)`);

  saveDb();
  console.log('Database initialized successfully');
  return db;
}

// Verification operations
export const verificationOps = {
  create: async (data) => {
    const db = await getDb();
    const id = uuidv4();
    db.run(`
      INSERT INTO verifications (id, verification_type, nullifier, public_signals, proof_generation_time_ms, verification_time_ms, result, verifier_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.verification_type,
      data.nullifier,
      JSON.stringify(data.public_signals || {}),
      data.proof_generation_time_ms || null,
      data.verification_time_ms || null,
      data.result ? 1 : 0,
      data.verifier_id || null,
      JSON.stringify(data.metadata || {})
    ]);
    saveDb();
    return id;
  },

  findByNullifier: async (nullifier) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM verifications WHERE nullifier = ?', [nullifier]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    return Object.fromEntries(columns.map((col, i) => [col, values[i]]));
  },

  getHistory: async (limit = 50, offset = 0) => {
    const db = await getDb();
    const result = db.exec(`
      SELECT * FROM verifications
      ORDER BY verified_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  },

  getStats: async () => {
    const db = await getDb();
    const result = db.exec(`
      SELECT
        verification_type,
        COUNT(*) as total,
        SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) as successful,
        AVG(verification_time_ms) as avg_verification_time,
        AVG(proof_generation_time_ms) as avg_proof_time
      FROM verifications
      GROUP BY verification_type
    `);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }
};

// Issuer operations
export const issuerOps = {
  create: async (data) => {
    const db = await getDb();
    const id = uuidv4();
    db.run(`
      INSERT INTO issuers (id, name, public_key_x, public_key_y)
      VALUES (?, ?, ?, ?)
    `, [id, data.name, data.public_key_x, data.public_key_y]);
    saveDb();
    return id;
  },

  findById: async (id) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM issuers WHERE id = ? AND is_active = 1', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    return Object.fromEntries(columns.map((col, i) => [col, values[i]]));
  },

  getAll: async () => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM issuers WHERE is_active = 1');

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }
};

// Credential operations
export const credentialOps = {
  create: async (data) => {
    const db = await getDb();
    const id = uuidv4();
    db.run(`
      INSERT INTO credentials (id, issuer_id, commitment, credential_type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, data.issuer_id, data.commitment, data.credential_type, data.expires_at || null]);
    saveDb();
    return id;
  },

  findByCommitment: async (commitment) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM credentials WHERE commitment = ? AND revoked = 0', [commitment]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    return Object.fromEntries(columns.map((col, i) => [col, values[i]]));
  },

  isValid: async (commitment) => {
    const db = await getDb();
    const result = db.exec(`
      SELECT * FROM credentials
      WHERE commitment = ?
        AND revoked = 0
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `, [commitment]);
    return result.length > 0 && result[0].values.length > 0;
  }
};

// Verification request operations (for QR code flow)
export const verificationRequestOps = {
  create: async (data) => {
    const db = await getDb();
    const id = uuidv4().slice(0, 8).toUpperCase(); // Short ID for easy sharing
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry
    db.run(`
      INSERT INTO verification_requests (id, verification_type, verifier_name, expires_at)
      VALUES (?, ?, ?, ?)
    `, [id, data.verification_type, data.verifier_name || 'Anonymous Verifier', expiresAt]);
    saveDb();
    return { id, expiresAt };
  },

  findById: async (id) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM verification_requests WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    return Object.fromEntries(columns.map((col, i) => [col, values[i]]));
  },

  updateStatus: async (id, status, verificationId = null) => {
    const db = await getDb();
    db.run(`
      UPDATE verification_requests
      SET status = ?, completed_at = datetime('now'), verification_id = ?
      WHERE id = ?
    `, [status, verificationId, id]);
    saveDb();
  },

  getPending: async (verifierName) => {
    const db = await getDb();
    const result = db.exec(`
      SELECT * FROM verification_requests
      WHERE verifier_name = ? AND status = 'pending' AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `, [verifierName]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }
};

// Seed default issuer for demo
export async function seedDefaultIssuer() {
  const db = await getDb();
  const result = db.exec("SELECT * FROM issuers WHERE name = 'Demo Aadhaar Authority'");

  if (result.length === 0 || result[0].values.length === 0) {
    const demoIssuer = {
      name: 'Demo Aadhaar Authority',
      public_key_x: '17777552123799933955779906779655732241715742912184938656739573121738514868268',
      public_key_y: '2626589144620713026669568689430873010625803728049924121243784502389097019475'
    };

    await issuerOps.create(demoIssuer);
    console.log('Default demo issuer created');
  }
}

export default {
  getDb,
  initializeDatabase,
  verificationOps,
  issuerOps,
  credentialOps,
  verificationRequestOps,
  seedDefaultIssuer
};
