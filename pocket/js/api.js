const API = {
    /**
     * Fetch the latest dashboard state from the Cloud
     * Uses the URL defined in settings or defaults to current origin
     */
    async getDashboard() {
        // 1. Try to get URL from global settings (if loaded)
        // 2. Fallback to localStorage
        // 3. Fallback to current window origin (best for Railway deployments)
        let baseUrl = window.location.origin;
        
        if (typeof settings !== 'undefined' && settings.cloudUrl) {
            baseUrl = settings.cloudUrl;
        } else {
            const saved = localStorage.getItem('settings');
            if (saved) baseUrl = JSON.parse(saved).cloudUrl || baseUrl;
        }

        const response = await fetch(`${baseUrl}/api/data`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    }
};