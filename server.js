require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const SYNC_SECRET = process.env.SYNC_SECRET;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for charts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"], // Allow favicon and data URIs
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting for API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// In-memory storage (Ephemeral - resets on deployment)
// For persistence on Railway without a DB, the Pi just needs to push frequently.
let dashboardState = {
  lastUpdated: null,
  system: {
    version: '2.0.0',
    mode: 'UNKNOWN'
  },
  stats: {
    current_state: 'WAITING',
    portfolio_value: 0,
    total_return_pct: 0,
    days_running: 0
  },
  history: [], // Last 30 cycles
  trades: []   // Last 10 trades
};

// --- API Endpoints ---

// 1. Receiver Endpoint (Called by Raspberry Pi)
app.post('/api/sync', (req, res) => {
  const authHeader = req.headers['x-sync-secret'];
  
  if (!SYNC_SECRET) {
    console.error('❌ SYNC_SECRET not set on server');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (authHeader !== SYNC_SECRET) {
    console.warn('⚠️ Unauthorized sync attempt');
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Update state
  const payload = req.body;
  if (payload && payload.stats) {
    dashboardState = {
      ...payload,
      lastUpdated: new Date().toISOString()
    };
    console.log(`✅ Data synced from Node at ${dashboardState.lastUpdated}`);
    return res.json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid payload' });
});

// 2. Public Data Endpoint (Called by Frontend)
app.get('/api/data', (req, res) => {
  res.json(dashboardState);
});

// 3. Serve Frontend
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`🚀 Cloud Dashboard running on port ${PORT}`);
});
