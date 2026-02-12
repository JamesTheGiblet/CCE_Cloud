// Settings state
let settings = {
    cloudUrl: 'https://cce.gibletscreations.com',
    notifyStateChanges: true,
    notifyTrades: true,
    notifySystemAlerts: true,
    notifyDailySummary: false,
    dailySummaryTime: '08:00',
    theme: 'dark',
    compactMode: false,
    autoRefresh: true,
    refreshInterval: 60
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
    checkConnectionStatus();
    checkNotificationPermission();
    calculateCacheSize();
    loadNodeVersion();
});

// Load settings from localStorage
function loadSettings() {
    const saved = Store.get('settings');
    if (saved) {
        settings = { ...settings, ...saved };
    }
    
    applySettings();
}

// Apply settings to UI
function applySettings() {
    // Connection
    document.getElementById('cloud-url-display').textContent = settings.cloudUrl;
    
    // Notifications
    document.getElementById('notify-state-changes').checked = settings.notifyStateChanges;
    document.getElementById('notify-trades').checked = settings.notifyTrades;
    document.getElementById('notify-system-alerts').checked = settings.notifySystemAlerts;
    document.getElementById('notify-daily-summary').checked = settings.notifyDailySummary;
    document.getElementById('daily-summary-time').value = settings.dailySummaryTime;
    
    // Toggle daily time input visibility
    document.getElementById('daily-time-setting').style.display = 
        settings.notifyDailySummary ? 'flex' : 'none';
    
    // Display
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('compact-mode').checked = settings.compactMode;
    
    // Data
    document.getElementById('auto-refresh').checked = settings.autoRefresh;
    document.getElementById('refresh-interval').value = settings.refreshInterval;
    
    // Apply compact mode
    if (settings.compactMode) {
        document.body.classList.add('compact-mode');
    }
}

// Save settings to localStorage
function saveSettings() {
    Store.set('settings', settings);
}

// Setup event listeners
function setupEventListeners() {
    // Connection
    document.getElementById('edit-url-btn').addEventListener('click', showUrlModal);
    document.getElementById('sync-now-btn').addEventListener('click', syncNow);
    
    // Notifications
    document.getElementById('notify-state-changes').addEventListener('change', (e) => {
        settings.notifyStateChanges = e.target.checked;
        saveSettings();
    });
    
    document.getElementById('notify-trades').addEventListener('change', (e) => {
        settings.notifyTrades = e.target.checked;
        saveSettings();
    });
    
    document.getElementById('notify-system-alerts').addEventListener('change', (e) => {
        settings.notifySystemAlerts = e.target.checked;
        saveSettings();
    });
    
    document.getElementById('notify-daily-summary').addEventListener('change', (e) => {
        settings.notifyDailySummary = e.target.checked;
        document.getElementById('daily-time-setting').style.display = 
            e.target.checked ? 'flex' : 'none';
        saveSettings();
    });
    
    document.getElementById('daily-summary-time').addEventListener('change', (e) => {
        settings.dailySummaryTime = e.target.value;
        saveSettings();
    });
    
    document.getElementById('request-permission-btn').addEventListener('click', requestNotificationPermission);
    
    // Display
    document.getElementById('theme-select').addEventListener('change', (e) => {
        settings.theme = e.target.value;
        saveSettings();
        // Theme switching not implemented yet
        if (e.target.value !== 'dark') {
            alert('Light theme coming soon!');
            e.target.value = 'dark';
        }
    });
    
    document.getElementById('compact-mode').addEventListener('change', (e) => {
        settings.compactMode = e.target.checked;
        saveSettings();
        
        if (e.target.checked) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
    });
    
    // Data
    document.getElementById('auto-refresh').addEventListener('change', (e) => {
        settings.autoRefresh = e.target.checked;
        saveSettings();
    });
    
    document.getElementById('refresh-interval').addEventListener('change', (e) => {
        settings.refreshInterval = parseInt(e.target.value);
        saveSettings();
    });
    
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
    
    // About
    document.getElementById('view-changelog-btn').addEventListener('click', () => {
        window.open('https://github.com/gibletscreations/cce-pocket/blob/main/CHANGELOG.md', '_blank');
    });
    
    document.getElementById('privacy-policy-btn').addEventListener('click', () => {
        window.open('https://gibletscreations.com/cce/privacy', '_blank');
    });
    
    document.getElementById('github-btn').addEventListener('click', () => {
        window.open('https://github.com/gibletscreations/cce-pocket', '_blank');
    });
    
    // Danger Zone
    document.getElementById('reset-all-btn').addEventListener('click', resetAllSettings);
    document.getElementById('uninstall-btn').addEventListener('click', uninstallApp);
    
    // Reset button (header)
    document.getElementById('reset-btn').addEventListener('click', resetAllSettings);
}

// URL Modal
function showUrlModal() {
    const modal = document.getElementById('url-modal');
    const input = document.getElementById('url-input');
    
    input.value = settings.cloudUrl;
    modal.classList.remove('hidden');
    
    document.getElementById('cancel-url-btn').onclick = () => {
        modal.classList.add('hidden');
    };
    
    document.getElementById('save-url-btn').onclick = () => {
        const newUrl = input.value.trim();
        
        if (!newUrl.startsWith('http')) {
            alert('Invalid URL. Must start with http:// or https://');
            return;
        }
        
        settings.cloudUrl = newUrl.replace(/\/$/, ''); // Remove trailing slash
        document.getElementById('cloud-url-display').textContent = settings.cloudUrl;
        saveSettings();
        modal.classList.add('hidden');
        
        // Test new URL
        checkConnectionStatus();
    };
}

// Sync now
async function syncNow() {
    const btn = document.getElementById('sync-now-btn');
    btn.textContent = 'Syncing...';
    btn.disabled = true;
    
    try {
        // Update API URL
        const originalUrl = API.get.toString();
        // This is a hack - in production, API should read from settings
        
        await API.getDashboard();
        
        document.getElementById('last-sync-time').textContent = 'Just now';
        
        setTimeout(() => {
            btn.textContent = 'Sync Now';
            btn.disabled = false;
        }, 1000);
    } catch (error) {
        btn.textContent = 'Failed';
        setTimeout(() => {
            btn.textContent = 'Sync Now';
            btn.disabled = false;
        }, 2000);
    }
}

// Check connection status
async function checkConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    
    try {
        const response = await fetch(`${settings.cloudUrl}/api/data`);
        
        if (response.ok) {
            statusEl.innerHTML = '<span class="status-dot online"></span> Online';
            
            const data = await response.json();
            if (data.lastUpdated) {
                const date = new Date(data.lastUpdated);
                document.getElementById('last-sync-time').textContent = formatRelativeTime(date);
            }
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        statusEl.innerHTML = '<span class="status-dot offline"></span> Offline';
        document.getElementById('last-sync-time').textContent = 'Connection failed';
    }
}

// Check notification permission
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        document.getElementById('notification-permission-status').textContent = 'Not supported';
        document.getElementById('request-permission-btn').disabled = true;
        return;
    }
    
    const permission = Notification.permission;
    
    if (permission === 'granted') {
        document.getElementById('notification-permission-status').textContent = 'Enabled';
        document.getElementById('request-permission-btn').textContent = 'Enabled';
        document.getElementById('request-permission-btn').disabled = true;
    } else if (permission === 'denied') {
        document.getElementById('notification-permission-status').textContent = 'Blocked (enable in browser settings)';
        document.getElementById('request-permission-btn').disabled = true;
    } else {
        document.getElementById('notification-permission-status').textContent = 'Not enabled';
    }
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Notifications are not supported by your browser');
        return;
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        document.getElementById('notification-permission-status').textContent = 'Enabled';
        document.getElementById('request-permission-btn').textContent = 'Enabled';
        document.getElementById('request-permission-btn').disabled = true;
        
        // Show test notification
        new Notification('CCE Pocket', {
            body: 'Notifications enabled successfully!',
            icon: '/pocket/icons/icon-192.png'
        });
    } else {
        alert('Notification permission denied');
    }
}

// Calculate cache size
function calculateCacheSize() {
    let totalSize = 0;
    
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
        }
    }
    
    // Convert to KB
    const sizeKB = (totalSize / 1024).toFixed(2);
    document.getElementById('cache-size').textContent = `${sizeKB} KB`;
}

// Clear cache
function clearCache() {
    if (!confirm('Clear all cached data? The app will reload.')) {
        return;
    }
    
    // Clear localStorage except settings
    const settingsBackup = Store.get('settings');
    localStorage.clear();
    
    if (settingsBackup) {
        Store.set('settings', settingsBackup);
    }
    
    // Clear service worker cache
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    alert('Cache cleared!');
    window.location.reload();
}

// Load node version
async function loadNodeVersion() {
    try {
        const data = await API.getDashboard();
        if (data.system && data.system.version) {
            document.getElementById('node-version').textContent = data.system.version;
        }
    } catch (error) {
        document.getElementById('node-version').textContent = 'Unknown';
    }
}

// Reset all settings
function resetAllSettings() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
        return;
    }
    
    // Reset to defaults
    settings = {
        cloudUrl: 'https://cce.gibletscreations.com',
        notifyStateChanges: true,
        notifyTrades: true,
        notifySystemAlerts: true,
        notifyDailySummary: false,
        dailySummaryTime: '08:00',
        theme: 'dark',
        compactMode: false,
        autoRefresh: true,
        refreshInterval: 60
    };
    
    saveSettings();
    applySettings();
    
    alert('Settings reset to defaults');
}

// Uninstall app
function uninstallApp() {
    if (!confirm('Remove CCE Pocket from your device?\n\nThis will:\n- Clear all app data\n- Remove the app icon\n- Require reinstallation to use again\n\nAre you sure?')) {
        return;
    }
    
    // Clear all data
    localStorage.clear();
    
    // Unregister service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
        });
    }
    
    // Clear caches
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    alert('App data cleared. You can now remove the app from your home screen.\n\nClosing in 3 seconds...');
    
    setTimeout(() => {
        window.close();
    }, 3000);
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}