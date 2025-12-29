import express from 'express';
import cors from 'cors';
import { initializeDatabase, seedDefaultIssuer } from './services/db.js';
import credentialsRouter from './routes/credentials.js';
import verifyRouter from './routes/verify.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'eigenparse-backend',
    timestamp: new Date().toISOString()
  });
});

// API info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Eigenparse ZKP-KYC API',
    version: '1.0.0',
    description: 'Privacy-preserving KYC verification using Zero-Knowledge Proofs',
    endpoints: {
      credentials: '/api/v1/credentials',
      verify: '/api/v1/verify'
    },
    compliance: ['DPDP Act 2023', 'NIST FIPS-203/204']
  });
});

// Routes
app.use('/api/v1/credentials', credentialsRouter);
app.use('/api/v1/verify', verifyRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found'
  });
});

// Initialize database and start server
async function start() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    await seedDefaultIssuer();

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  EIGENPARSE ZKP-KYC Server                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${PORT}                                              ║
║  API:       http://localhost:${PORT}/api/v1                      ║
║  Health:    http://localhost:${PORT}/health                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Privacy-preserving KYC with Zero-Knowledge Proofs            ║
║  DPDP Act 2023 Compliant                                      ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
