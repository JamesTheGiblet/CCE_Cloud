// Global state
let chartInstance = null;
let refreshInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadDashboard();
    startAutoRefresh();
    registerServiceWorker();
    setupInstallPrompt();
});

// Load dashboard data
async function loadDashboard() {
    try {
        const data = await API.getDashboard();
        
        if (!data.lastUpdated) {
            console.warn('No data received from server');
            return;
        }

        renderDashboard(data);
        Store.set('lastData', data);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        
        // Try to load cached data
        const cached = Store.get('lastData');
        if (cached) {
            renderDashboard(cached);
            showOfflineIndicator();
        }
    }
}

// Render dashboard
function renderDashboard(data) {
    // Header badge
    const badge = document.getElementById('mode-badge');
    badge.textContent = data.system.mode === 'LIVE' ? '● LIVE' : 'DRY RUN';
    badge.className = data.system.mode === 'LIVE' ? 'badge live' : 'badge dry-run';

    // Last update
    const lastUpdate = document.getElementById('last-update');
    const date = new Date(data.lastUpdated);
    lastUpdate.textContent = `Updated ${formatRelativeTime(date)}`;

    // Current state
    document.getElementById('current-state').textContent = data.stats.current_state;
    document.getElementById('days-in-state').textContent = 
        `Days in state: ${data.stats.days_in_state || 0}`;

    // Portfolio value
    const portfolioValue = data.stats.portfolio_value || 0;
    const returnPct = data.stats.total_return_pct || 0;
    
    document.getElementById('portfolio-value').textContent = 
        `$${portfolioValue.toFixed(2)}`;
    
    const changeEl = document.getElementById('portfolio-change');
    changeEl.textContent = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
    changeEl.className = returnPct >= 0 ? 'card-change positive' : 'card-change negative';

    // Market context
    document.getElementById('btc-price').textContent = 
        `$${(data.stats.btc_price || 0).toLocaleString()}`;
    document.getElementById('fear-greed').textContent = 
        data.stats.fear_greed || '—';

    // Chart
    if (data.history && data.history.length > 0) {
        renderChart(data.history);
    }

    // Recent activity
    renderActivity(data.trades || []);
}

// Render chart
function renderChart(history) {
    const canvas = document.getElementById('portfolio-chart');
    const ctx = canvas.getContext('2d');

    const labels = history.map(h => new Date(h.timestamp).toLocaleDateString());
    const values = history.map(h => h.portfolio_value);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#e2e8f0',
                    bodyColor: '#e2e8f0',
                    borderColor: '#334155',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8', maxRotation: 0 }
                },
                y: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// Render activity
function renderActivity(trades) {
    const list = document.getElementById('recent-activity');
    
    if (trades.length === 0) {
        list.innerHTML = '<li>No recent trades</li>';
        return;
    }

    list.innerHTML = trades.slice(0, 5).map(trade => {
        const date = new Date(trade.timestamp);
        const color = trade.side === 'buy' ? 'var(--green)' : 'var(--red)';
        
        return `
            <li>
                <div>${trade.side.toUpperCase()} ${trade.symbol}</div>
                <div class="activity-time">${formatRelativeTime(date)} • $${trade.value.toFixed(2)}</div>
            </li>
        `;
    }).join('');
}

// Auto refresh
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadDashboard, 60000); // Every minute
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// Offline indicator
function showOfflineIndicator() {
    const lastUpdate = document.getElementById('last-update');
    lastUpdate.textContent = 'Offline - showing cached data';
    lastUpdate.style.color = 'var(--red)';
}

// Service Worker (PWA)
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/pocket/js/sw.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// Install prompt
function setupInstallPrompt() {
    let deferredPrompt = null;
    const installPrompt = document.getElementById('install-prompt');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('dismiss-btn');

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return; // Already installed
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installPrompt.classList.remove('hidden');
    });

    // Install button
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            installPrompt.classList.add('hidden');
        }

        deferredPrompt = null;
    });

    // Dismiss button
    dismissBtn.addEventListener('click', () => {
        installPrompt.classList.add('hidden');
        Store.set('installPromptDismissed', true);
    });
}

// Pull to refresh (optional enhancement)
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;

    if (touchDiff > 100 && window.scrollY === 0) {
        loadDashboard();
    }
}, { passive: true });