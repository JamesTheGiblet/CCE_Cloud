require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;
const SYNC_SECRET = process.env.SYNC_SECRET;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
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
let dashboardState = {
  lastUpdated: null,
  system: {
    version: '2.0.0',
    mode: 'UNKNOWN',
    uptime: 0
  },
  stats: {
    current_state: 'WAITING',
    portfolio_value: 0,
    total_return: 0,
    total_return_pct: 0,
    btc_price: null,
    fear_greed: null,
    days_in_state: 0,
    days_running: 0,
    timestamp: null
  },
  history: [],      // Cycle history
  transitions: [],  // State changes
  trades: [],       // Trade log
  reports: []       // Daily reports
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. SYNC ENDPOINT - Receives data from Node (Raspberry Pi)
app.post('/api/sync', (req, res) => {
  const authHeader = req.headers['x-sync-secret'];
  
  if (!SYNC_SECRET) {
    console.error('❌ SYNC_SECRET not set on server');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (authHeader !== SYNC_SECRET) {
    console.warn('⚠️  Unauthorized sync attempt');
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
    console.log(`   State: ${dashboardState.stats.current_state} | Value: $${dashboardState.stats.portfolio_value}`);
    
    return res.json({ 
      success: true, 
      received_at: dashboardState.lastUpdated 
    });
  }

  return res.status(400).json({ error: 'Invalid payload' });
});

// 2. PUBLIC DATA ENDPOINT - Complete dashboard data
app.get('/api/data', (req, res) => {
  res.json(dashboardState);
});

// 3. STATUS ENDPOINT - Current stats only
app.get('/api/status', (req, res) => {
  res.json({
    ...dashboardState.stats,
    timestamp: dashboardState.lastUpdated
  });
});

// 4. HISTORY ENDPOINT - Cycle history
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const history = dashboardState.history || [];
  res.json(history.slice(-limit));
});

// 5. TRANSITIONS ENDPOINT - State changes
app.get('/api/transitions', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const transitions = dashboardState.transitions || [];
  res.json(transitions.slice(-limit));
});

// 6. TRADES ENDPOINT - Trade log
app.get('/api/trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const trades = dashboardState.trades || [];
  res.json(trades.slice(-limit));
});

// 7. REPORTS ENDPOINT - Daily reports
app.get('/api/reports', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const reports = dashboardState.reports || [];
  res.json(reports.slice(-limit));
});

// 8. EXPORT ENDPOINT - Full data export
app.get('/api/export', (req, res) => {
  res.json({
    generated_at: new Date().toISOString(),
    system: 'CCE Cloud',
    version: dashboardState.system.version,
    mode: dashboardState.system.mode,
    reports: dashboardState.reports || [],
    history: dashboardState.history || [],
    transitions: dashboardState.transitions || [],
    trades: dashboardState.trades || []
  });
});

// 9. STREAM ENDPOINT - Server-Sent Events for real-time updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const sendUpdate = () => {
    if (dashboardState.stats) {
      res.write(`data: ${JSON.stringify(dashboardState.stats)}\n\n`);
    }
  };

  // Send immediately
  sendUpdate();

  // Send updates every 5 seconds
  const interval = setInterval(sendUpdate, 5000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// 10. HEALTH CHECK - System status
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    lastSync: dashboardState.lastUpdated,
    currentState: dashboardState.stats.current_state,
    cacheSize: {
      history: (dashboardState.history || []).length,
      transitions: (dashboardState.transitions || []).length,
      trades: (dashboardState.trades || []).length
    }
  });
});

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

// Fix for favicon.ico 404/CSP issues
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve Pocket PWA
app.use('/pocket', express.static(path.join(__dirname, 'pocket')));

// Explicitly serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle 404s (Catch-all for missing files/maps)
app.use((req, res) => {
  res.status(404).type('text').send('Not Found');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🌩️  CCE Cloud Dashboard                                      ║
║                                                                ║
║   Status: Running                                              ║
║   Port: ${PORT.toString().padEnd(53)}║
║   Mode: Public Read-Only                                       ║
║   Sync Secret: ${SYNC_SECRET ? 'Configured ✓' : 'NOT SET ✗'.padEnd(43)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);

  if (!SYNC_SECRET) {
    console.warn('⚠️  WARNING: SYNC_SECRET not configured!');
    console.warn('   Set it in Railway environment variables.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});