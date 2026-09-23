const CACHE = 'zirhova-v0.15-full-stage-doctrines';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './src/game.js',
  './src/levels.js',
  './src/weaponSystem.js',
  './src/brickSystem.js',
  './src/levelSchema.js',
  './src/controllerSystem.js',
  './src/navigationSystem.js',
  './src/balanceSystem.js',
  './src/stageDoctrineSystem.js',
  './src/bossSystem.js',
  './src/audioSystem.js',
  './src/progressionSystem.js',
  './src/runSystem.js',
  './src/editor.js',
  './editor.css',
  './editor.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      return cache.match('./index.html');
    }

    throw new Error('offline-miss');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const destination = event.request.destination;
  const freshCode =
    event.request.mode === 'navigate' ||
    destination === 'script' ||
    destination === 'style' ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.webmanifest');

  event.respondWith(
    freshCode
      ? networkFirst(event.request)
      : cacheFirst(event.request)
  );
});
