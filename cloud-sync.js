/**
 * CCE Cloud Sync
 * Pushes local SQLite data to the public Railway dashboard.
 * Run this via PM2 or add to cron to run every 4 hours.
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, 'data', 'cce-production.db');
const CLOUD_URL = process.env.CLOUD_URL; // e.g., https://cce-dashboard.up.railway.app/api/sync
const SYNC_SECRET = process.env.SYNC_SECRET; // Must match the Cloud env var
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!CLOUD_URL || !SYNC_SECRET) {
    console.error('❌ Missing CLOUD_URL or SYNC_SECRET in .env');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Could not connect to database:', err.message);
        process.exit(1);
    }
});

async function gatherData() {
    return new Promise((resolve, reject) => {
        const payload = {
            system: {
                version: '2.0.0',
                mode: process.env.CCE_DRY_RUN === 'false' ? 'LIVE' : 'DRY_RUN'
            },
            stats: {},
            history: [],
            trades: []
        };

        db.serialize(() => {
            // 1. Get latest cycle stats
            db.get(`SELECT * FROM cce_cycles ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
                if (err) return reject(err);
                if (row) {
                    payload.stats = {
                        current_state: row.current_state,
                        portfolio_value: row.portfolio_value,
                        total_return_pct: ((row.portfolio_value - 300) / 300) * 100, // Assuming 300 start, or fetch from config
                        fear_greed: row.fear_greed,
                        btc_price: row.btc_price
                    };
                }
            });

            // 2. Get history (last 30 cycles ~ 5 days, or adjust limit)
            db.all(`SELECT timestamp, portfolio_value FROM cce_cycles ORDER BY timestamp ASC LIMIT 100`, (err, rows) => {
                if (err) return reject(err);
                payload.history = rows;
            });

            // 3. Get recent trades
            db.all(`SELECT timestamp, symbol, side, price, value FROM trades ORDER BY timestamp DESC LIMIT 10`, (err, rows) => {
                if (err) return reject(err);
                payload.trades = rows;
                resolve(payload);
            });
        });
    });
}

async function sendTelegramAlert(errorMsg) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `⚠️ *CCE Cloud Sync Failed*\n\nError: ${errorMsg}`,
            parse_mode: 'Markdown'
        });
        console.log('📨 Telegram alert sent');
    } catch (err) {
        console.error('❌ Failed to send Telegram alert:', err.message);
    }
}

async function pushToCloud() {
    try {
        console.log('🔄 Gathering data from local DB...');
        const payload = await gatherData();
        
        console.log(`📤 Pushing to ${CLOUD_URL}...`);
        await axios.post(CLOUD_URL, payload, {
            headers: { 'x-sync-secret': SYNC_SECRET }
        });
        
        console.log('✅ Sync successful!');
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        if (error.response) {
            console.error('   Server response:', error.response.status, error.response.data);
        }
        await sendTelegramAlert(error.message);
    } finally {
        db.close();
    }
}

pushToCloud();
