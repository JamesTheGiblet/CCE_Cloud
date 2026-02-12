// Global state
let currentView = 'states';
let historyData = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();
    setupTabs();
    setupExport();
});

// Load history data
async function loadHistory() {
    try {
        const data = await API.getDashboard();
        historyData = data;
        
        renderStats(data);
        renderStatesView(data);
        renderTradesView(data);
        renderPerformanceView(data);
        
        Store.set('cachedHistory', data);
    } catch (error) {
        console.error('Failed to load history:', error);
        
        // Try cached data
        const cached = Store.get('cachedHistory');
        if (cached) {
            historyData = cached;
            renderStats(cached);
            renderStatesView(cached);
            renderTradesView(cached);
            renderPerformanceView(cached);
        }
    }
}

// Render summary stats
function renderStats(data) {
    // Count state transitions
    const transitions = countStateTransitions(data.history);
    document.getElementById('total-transitions').textContent = transitions;
    
    // Count trades
    const trades = data.trades ? data.trades.length : 0;
    document.getElementById('total-trades').textContent = trades;
    
    // Calculate days running
    if (data.history && data.history.length > 0) {
        const firstDate = new Date(data.history[0].timestamp);
        const lastDate = new Date(data.history[data.history.length - 1].timestamp);
        const days = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        document.getElementById('days-running').textContent = days;
    }
}

// Count state transitions from history
function countStateTransitions(history) {
    if (!history || history.length < 2) return 0;
    
    let count = 0;
    let lastState = null;
    
    history.forEach(entry => {
        if (entry.current_state && entry.current_state !== lastState) {
            count++;
            lastState = entry.current_state;
        }
    });
    
    return Math.max(0, count - 1); // Subtract 1 for initial state
}

// Render States View
function renderStatesView(data) {
    const container = document.getElementById('states-timeline');
    
    if (!data.history || data.history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" fill="currentColor">
                    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
                <div class="empty-state-title">No History Yet</div>
                <div class="empty-state-text">State transitions will appear here</div>
            </div>
        `;
        return;
    }
    
    // Extract state transitions
    const transitions = [];
    let lastState = null;
    
    data.history.forEach((entry, index) => {
        if (entry.current_state && entry.current_state !== lastState) {
            if (lastState) {
                transitions.push({
                    from: lastState,
                    to: entry.current_state,
                    timestamp: entry.timestamp,
                    portfolioValue: entry.portfolio_value
                });
            }
            lastState = entry.current_state;
        }
    });
    
    if (transitions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">Single State</div>
                <div class="empty-state-text">Currently in ${data.stats.current_state}</div>
            </div>
        `;
        return;
    }
    
    // Render timeline (reverse order - newest first)
    container.innerHTML = transitions.reverse().map(t => {
        const date = new Date(t.timestamp);
        return `
            <div class="timeline-item">
                <div class="timeline-dot state-change"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <div class="timeline-title">State Transition</div>
                        <div class="timeline-time">${formatDateTime(date)}</div>
                    </div>
                    <div class="state-transition">
                        <span class="state-from">${t.from}</span>
                        <span class="state-arrow">→</span>
                        <span class="state-to">${t.to}</span>
                    </div>
                    <div class="timeline-details">
                        Portfolio: $${(t.portfolioValue || 0).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Trades View
function renderTradesView(data) {
    const container = document.getElementById('trades-list');
    
    if (!data.trades || data.trades.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" fill="currentColor">
                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                </svg>
                <div class="empty-state-title">No Trades Yet</div>
                <div class="empty-state-text">Trade history will appear here</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.trades.map(trade => {
        const date = new Date(trade.timestamp);
        const side = trade.side.toLowerCase();
        
        return `
            <div class="trade-item">
                <div class="trade-header">
                    <div class="trade-symbol">${trade.symbol}</div>
                    <div class="trade-side ${side}">${side}</div>
                </div>
                <div class="trade-details">
                    <div class="trade-detail-item">
                        <div class="trade-detail-label">Price</div>
                        <div class="trade-detail-value">$${trade.price.toFixed(2)}</div>
                    </div>
                    <div class="trade-detail-item">
                        <div class="trade-detail-label">Value</div>
                        <div class="trade-detail-value">$${trade.value.toFixed(2)}</div>
                    </div>
                    <div class="trade-detail-item">
                        <div class="trade-detail-label">Amount</div>
                        <div class="trade-detail-value">${trade.amount?.toFixed(6) || '—'}</div>
                    </div>
                    <div class="trade-detail-item">
                        <div class="trade-detail-label">Date</div>
                        <div class="trade-detail-value">${formatDate(date)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Performance View
function renderPerformanceView(data) {
    // Performance metrics
    const returnPct = data.stats.total_return_pct || 0;
    const portfolioValue = data.stats.portfolio_value || 300;
    
    document.getElementById('perf-return').textContent = 
        `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
    document.getElementById('perf-return').className = 
        `metric-value ${returnPct >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('perf-value').textContent = 
        `$${portfolioValue.toFixed(2)}`;
    
    // Calculate time in market
    if (data.history && data.history.length > 0) {
        const activeStates = ['IGNITION', 'CASCADE_1', 'CASCADE_2', 'SPILLWAY'];
        const inMarket = data.history.filter(h => 
            activeStates.includes(h.current_state)
        ).length;
        const timeInMarket = (inMarket / data.history.length * 100).toFixed(1);
        document.getElementById('perf-market-time').textContent = `${timeInMarket}%`;
    }
    
    // State distribution
    renderStateDistribution(data.history);
    
    // Best trades (if trades data has profit info)
    renderBestTrades(data.trades);
}

// Render state distribution
function renderStateDistribution(history) {
    const container = document.getElementById('state-distribution');
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No data</div>';
        return;
    }
    
    // Count occurrences
    const stateCounts = {};
    history.forEach(entry => {
        const state = entry.current_state;
        if (state) {
            stateCounts[state] = (stateCounts[state] || 0) + 1;
        }
    });
    
    // Sort by count
    const sorted = Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1]);
    
    const total = history.length;
    
    container.innerHTML = sorted.map(([state, count]) => {
        const pct = (count / total * 100).toFixed(1);
        return `
            <div class="state-dist-item">
                <div>
                    <div class="state-dist-name">${state}</div>
                    <div class="state-dist-bar">
                        <div class="state-dist-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
                <div class="state-dist-value">${pct}%</div>
            </div>
        `;
    }).join('');
}

// Render best trades (placeholder - needs P&L data)
function renderBestTrades(trades) {
    const container = document.getElementById('best-trades');
    
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No trades yet</div>';
        return;
    }
    
    // Show most recent trades as placeholder
    container.innerHTML = trades.slice(0, 5).map(trade => {
        const date = new Date(trade.timestamp);
        return `
            <div class="best-trade-item">
                <div class="best-trade-info">
                    <strong>${trade.symbol}</strong> ${trade.side.toUpperCase()}
                    <div style="font-size: 12px; color: var(--text-muted);">${formatDate(date)}</div>
                </div>
                <div>$${trade.value.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

// Setup tabs
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const views = {
        'states': document.getElementById('view-states'),
        'trades': document.getElementById('view-trades'),
        'performance': document.getElementById('view-performance')
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            
            // Update tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update views
            Object.values(views).forEach(v => v.classList.remove('active'));
            views[view].classList.add('active');
            
            currentView = view;
        });
    });
}

// Setup export
function setupExport() {
    const exportBtn = document.getElementById('export-btn');
    
    exportBtn.addEventListener('click', () => {
        if (!historyData) {
            alert('No data to export');
            return;
        }
        
        // Create CSV
        const csv = generateCSV(historyData);
        downloadCSV(csv, 'cce-history.csv');
    });
}

// Generate CSV from data
function generateCSV(data) {
    let csv = 'Timestamp,State,Portfolio Value,BTC Price,Fear & Greed\n';
    
    data.history.forEach(entry => {
        csv += `${entry.timestamp},${entry.current_state},${entry.portfolio_value},${entry.btc_price || 0},${entry.fear_greed || 0}\n`;
    });
    
    csv += '\n\nTrades\n';
    csv += 'Timestamp,Symbol,Side,Price,Value\n';
    
    data.trades.forEach(trade => {
        csv += `${trade.timestamp},${trade.symbol},${trade.side},${trade.price},${trade.value}\n`;
    });
    
    return csv;
}

// Download CSV
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Format date/time
function formatDateTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}