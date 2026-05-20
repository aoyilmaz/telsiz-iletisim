const CACHE_APP  = 'afet-app-v4';
const CACHE_TILE = 'afet-tile-v1';

const APP_FILES = [
  './index.html',
  './style.css',
  './app.js',
  './data/TR.json',
  './countries.json',
  './manifest.json',
  './icons/icon.svg',
];

// ── Kurulum: uygulama dosyalarını önceden önbelleğe al ───────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Aktivasyon: eski önbellekleri temizle ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_APP && k !== CACHE_TILE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: üç farklı strateji ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // 1. OSM harita parçaları → önce önbellek, sonra ağ
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // 2. CDN kaynakları (Leaflet vb.) → önce önbellek, sonra ağ
  if (url.hostname !== self.location.hostname) {
    event.respondWith(cacheFirstStrategy(event.request, CACHE_APP));
    return;
  }

  // 3. Uygulama dosyaları (aynı origin) → önce ağ, önbellek yedek
  event.respondWith(networkFirstStrategy(event.request));
});

// ── Strateji: harita tile (önbellek önce) ────────────────────────────────────
async function tileStrategy(request) {
  const cache  = await caches.open(CACHE_TILE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

// ── Strateji: CDN (önbellek önce) ────────────────────────────────────────────
async function cacheFirstStrategy(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

// ── Strateji: uygulama dosyaları (ağ önce, önbellek yedek) ───────────────────
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_APP);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    // Ağ başarısız → önbellekten dene
    const cached = await cache.match(request);
    if (cached) return cached;

    // İkisi de başarısız → anlamlı bir hata yanıtı döndür (undefined değil!)
    if (request.destination === 'document') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Çevrimdışı ve önbellekte yok' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
