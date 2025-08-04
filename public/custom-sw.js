importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const CACHE_NAME = 'sellytics-cache-v1';
const API_CACHE_NAME = 'sellytics-api-cache-v1';

const URLS_TO_CACHE = [
  '/', '/static/js/main.8a136f5e.js', '/static/css/main.3433d232.css', '/index.html',
  '/offline.html', '/manifest.json', '/favicon.ico', '/logo192.png', '/register', '/login',
  '/adminregister', '/admin', '/regdashboard', '/dashboard', '/admin-dashboard',
  '/team-dashboard', '/sales-metrics', '/product-cost', '/main', '/salestrack',
  '/owner-dashboard', '/profile', '/payment', '/premiumdashboard', '/tools', '/test',
  '/tests', '/qrcodes',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// Background Sync for POST/PUT/DELETE requests
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const syncPlugin = new BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60, // Retry for 24 hours
  onSync: async ({ queue }) => {
    console.log('Background sync started:', queue);
    const entries = await queue.getAll();
    for (const entry of entries) {
      try {
        await fetch(entry.request);
        console.log(`Successfully synced request: ${entry.request.url}`);
      } catch (err) {
        console.error(`Failed to sync request: ${entry.request.url}`, err);
      }
    }
  },
});

// Register sync route for Supabase API
workbox.routing.registerRoute(
  ({ url }) =>
    url.hostname === 'qffcyvjugmtojpdgqriv.supabase.co' &&
    url.pathname.startsWith('/rest/v1/'),
  new workbox.strategies.NetworkOnly({
    plugins: [syncPlugin],
  }),
  'POST'
);

workbox.routing.registerRoute(
  ({ url }) =>
    url.hostname === 'qffcyvjugmtojpdgqriv.supabase.co' &&
    url.pathname.startsWith('/rest/v1/'),
  new workbox.strategies.NetworkOnly({
    plugins: [syncPlugin],
  }),
  'PUT'
);

workbox.routing.registerRoute(
  ({ url }) =>
    url.hostname === 'qffcyvjugmtojpdgqriv.supabase.co' &&
    url.pathname.startsWith('/rest/v1/'),
  new workbox.strategies.NetworkOnly({
    plugins: [syncPlugin],
  }),
  'DELETE'
);

// Fetch: Handle GET requests for static assets and Supabase API
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  const tablesToCache = [
    'stores', 'store_users', 'store_owners', 'customer',
    'dynamic_inventory', 'dynamic_product', 'dynamic_sales', 'expense_tracker',
    'sale_groups', 'receipts', 'notifications', 'debts', 'debt_payments', 'debt_tracker', 'returns', 'suppliers_inventory'
  ];

  if (
    requestUrl.hostname === 'qffcyvjugmtojpdgqriv.supabase.co' &&
    requestUrl.pathname.startsWith('/rest/v1/') &&
    tablesToCache.some((table) => requestUrl.pathname.includes(`/rest/v1/${table}`))
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log(`Serving cached API response for ${requestUrl.pathname}`);
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Only cache responses with status 200
          if (networkResponse.ok && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              console.log(`Caching response for ${requestUrl.pathname}`);
              cache.put(event.request, responseClone).catch((err) => {
                console.error(`Failed to cache ${requestUrl.pathname}:`, err);
              });
            });
          } else {
            console.warn(`Skipping cache for ${requestUrl.pathname}, status: ${networkResponse.status}`);
            // Log Range header for debugging
            if (event.request.headers.get('Range')) {
              console.log(`Range header detected for ${requestUrl.pathname}:`, event.request.headers.get('Range'));
            }
          }
          return networkResponse;
        }).catch((err) => {
          console.error(`Fetch failed for ${requestUrl.pathname}:`, err);
          return new Response(
            JSON.stringify({ error: 'Offline, unable to fetch data' }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            }
          );
        });
      })
    );
  } else if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then((cachedPage) => cachedPage || fetch(event.request))
        .catch(() => caches.match('/offline.html'))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          // Only cache valid responses
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic' &&
            new URL(event.request.url).protocol !== 'chrome-extension:'
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch((err) => {
                console.warn(`Skipped caching for ${event.request.url}:`, err);
              });
            });
          }
          return response;
        });
      }).catch(() => caches.match('/offline.html'))
    );
  }
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Trigger sync on online event
self.addEventListener('online', () => {
  console.log('Device is online, triggering background sync');
  self.registration.sync.register('sync-operations');
});