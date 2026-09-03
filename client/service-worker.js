const CACHE = 'pixel-bosses-v3-cosmos';
const ASSETS = ['./', './index.html', './css/app.css', './js/app.js', './js/data.js', './js/engine.js', './js/campaign.js', './js/storage.js', './js/network.js', './assets/icon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('fetch', (event) => { if (event.request.method === 'GET') event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
