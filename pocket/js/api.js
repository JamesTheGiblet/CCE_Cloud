// API Configuration
const API_URL = 'https://cce.gibletscreations.com/api';

// Simple API wrapper
const API = {
    async get(endpoint) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Specific endpoints
    getDashboard() {
        return this.get('/data');
    },

    registerDevice(token) {
        return this.post('/devices/register', { token, platform: 'web' });
    }
};

// Local Storage Helper
const Store = {
    get(key) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    remove(key) {
        localStorage.removeItem(key);
    }
};