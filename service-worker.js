const CACHE_VERSION = 'v10.0.2';
const STATIC_CACHE = `check-lib-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `check-lib-runtime-${CACHE_VERSION}`;
const REMOTE_CACHE = `check-lib-remote-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/checklist.js',
  '/manifest.json',
  '/service-worker.js',
  '/checklists.json',
  '/logo.png',
  '/logo-dark.png',
  '/cybr1.png',
  '/splash.png',
  '/builder/checklib-builder.html',
  '/builder/checklib-builder.css',
  '/builder/checklib-builder.js',
  '/help/index.html',
  '/help/help.css',
  '/help/help.js',
  '/checks/checklist_25.csv',
  '/checks/checklist_b.csv',
  '/checks/checklist_hadc.csv',
  '/checks/checklist_sscs.csv'
];

const REMOTE_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.5/dist/signature_pad.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'
];

const SAME_ORIGIN_STATIC_DESTINATIONS = new Set([
  'style',
  'script',
  'image',
  'font',
  'manifest'
]);

function isBuilderPage(pathname) {
  return pathname === '/builder/' || pathname.endsWith('/builder/checklib-builder.html');
}

function normaliseAssetPath(path) {
  return path === '/' ? '/index.html' : path;
}

async function cacheOne(cache, url) {
  try {
    const request = new Request(url, { cache: 'reload' });
    const response = await fetch(request);

    if (!response || !response.ok) {
      throw new Error(`Bad response: ${response ? response.status : 'no response'}`);
    }

    await cache.put(url, response.clone());
    return true;
  } catch (error) {
    console.warn('[SW] Precache skipped:', url, error);
    return false;
  }
}

async function cacheOneRemote(cache, url) {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'reload' });

    if (!response || (!response.ok && response.type !== 'opaque')) {
      throw new Error(`Bad response: ${response ? response.status : 'no response'}`);
    }

    await cache.put(url, response.clone());
    return true;
  } catch (error) {
    console.warn('[SW] Remote precache skipped:', url, error);
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    const remoteCache = await caches.open(REMOTE_CACHE);

    await Promise.all(CORE_ASSETS.map(url => cacheOne(staticCache, url)));
    await Promise.all(REMOTE_ASSETS.map(url => cacheOneRemote(remoteCache, url)));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const validKeys = new Set([STATIC_CACHE, RUNTIME_CACHE, REMOTE_CACHE]);

    await Promise.all(
      keys
        .filter(key => !validKeys.has(key))
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request) {
  const url = new URL(request.url);

  try {
    const fresh = await fetch(request);
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    runtimeCache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const runtimeMatch = await caches.match(request);
    if (runtimeMatch) {
      return runtimeMatch;
    }

    if (isBuilderPage(url.pathname)) {
      const builderFallback = await caches.match('/builder/checklib-builder.html');
      if (builderFallback) {
        return builderFallback;
      }
    }

    const appFallback = await caches.match('/index.html');
    if (appFallback) {
      return appFallback;
    }

    return new Response('Offline: page unavailable.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidateSameOrigin(request) {
  const cached = await caches.match(request);
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        runtimeCache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const fresh = await fetchPromise;
  if (fresh) {
    return fresh;
  }

  return new Response('Offline: resource unavailable.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function cacheFirstRemote(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const remoteCache = await caches.open(REMOTE_CACHE);
      remoteCache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline: remote library unavailable.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    if (REMOTE_ASSETS.includes(request.url)) {
      event.respondWith(cacheFirstRemote(request));
    }
    return;
  }

  const normalisedPath = normaliseAssetPath(url.pathname);

  if (CORE_ASSETS.includes(normalisedPath)) {
    event.respondWith(staleWhileRevalidateSameOrigin(request));
    return;
  }

  if (SAME_ORIGIN_STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidateSameOrigin(request));
    return;
  }

  if (
    normalisedPath.startsWith('/checks/') ||
    normalisedPath.startsWith('/builder/') ||
    normalisedPath.endsWith('.json') ||
    normalisedPath.endsWith('.csv') ||
    normalisedPath.endsWith('.html')
  ) {
    event.respondWith(staleWhileRevalidateSameOrigin(request));
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});