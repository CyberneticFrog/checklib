const CACHE_NAME = 'check-lib-cache-v5';
const BASE_PATH = '/';
const ASSETS_TO_CACHE = [
    `${BASE_PATH}`,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}style.css`,
    `${BASE_PATH}checklist.js`,
    `${BASE_PATH}accomm1.png`,
    `${BASE_PATH}cyber1.png`,
    `${BASE_PATH}splash.png`,
    `${BASE_PATH}manifest.json`,
    `${BASE_PATH}checks/checklist_b.csv`,
    `${BASE_PATH}checks/checklist_25.csv`,
    `${BASE_PATH}checklists.json`,
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/signature_pad@4.1.5/dist/signature_pad.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'
];

// 3) Install: open cache and add all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(err => console.error('Cache installation failed:', err))
  );
  self.skipWaiting();
});

// 4) Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(oldKey => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

// 5) Fetch: 
//    - For navigation requests, try network first, then fallback to index.html
//    - For cached assets, respond cache-first then network & update cache
//    - For everything else, just do a network fetch with an offline fallback
self.addEventListener('fetch', event => {
  // 5a) App shell-style routing for SPA navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('index.html') || new Response('Offline: Failed to load app.', {
          status: 503,
          statusText: 'Service Unavailable'
        }))
    );
    return;
  }

  const url = event.request.url;
  // 5b) Cache-first for our known assets
  if (ASSETS_TO_CACHE.some(asset => url.includes(asset))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(networkResponse => {
          // only cache valid responses
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // 5c) All other requests: network with offline fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => new Response('Offline: This resource is unavailable.', {
        status: 503,
        statusText: 'Service Unavailable'
      }))
  );
});

// 6) Listen for skipWaiting message from the page
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});