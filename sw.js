/* ═══════════════════════════════════════════
   AI Medical Report Summarizer - Service Worker
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'ai-medical-v2';
const CORE_ASSETS = [
  '/',
  '/?source=pwa',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/dashboard.html',
  '/style.css',
  '/dashboard.css',
  '/auth.css',
  '/script.js',
  '/pwa.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/favicon.png',
  '/app-logo.png'
];

// ── Install Event: Pre-cache core assets gracefully ──
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-cache files individually so one failure does not abort installation
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('PWA: Note caching asset:', asset, err);
        }
      }
    })
  );
});

// ── Activate Event: Clean old caches and claim clients immediately ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch Event: Serve cached content offline, always bypass AI & Auth ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Bypass dynamic API calls and external services
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // Pass through to network
  }

  // 2. Navigation requests (Opening pages / URLs)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // If network succeeds, cache a copy of the page
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          // If network is offline, serve cached page or fallback to index.html
          return caches.match(req).then((cached) => {
            return cached || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // 3. Static Assets: Cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, but update in background
        fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for missing images
        if (req.destination === 'image') {
          return caches.match('/icons/icon-192.png');
        }
      });
    })
  );
});
