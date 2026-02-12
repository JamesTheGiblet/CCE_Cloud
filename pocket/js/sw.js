const CACHE_NAME = 'cce-pocket-v1';
const urlsToCache = [
    '/pocket/',
    '/pocket/index.html',
    '/pocket/history.html',
    '/pocket/settings.html',
    '/pocket/css/style.css',
    '/pocket/js/app.js',
    '/pocket/js/api.js',
    '/pocket/icons/icon-192.png',
    '/pocket/icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Network request
                return fetch(event.request).then((response) => {
                    // Don't cache API responses
                    if (event.request.url.includes('/api/')) {
                        return response;
                    }

                    // Cache other resources
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
    );
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});