/**
 * myFinance - Service Worker (sw.js)
 * Enables PWA installation & reliable Android Home Screen shortcut icons.
 */
const CACHE_NAME = 'myfinance-pwa-v4';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'site.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon.ico',
  'styles.css',
  'logger.js',
  'storage.js',
  'charts.js',
  'balanceSheet.js',
  'cashflow.js',
  'app.js'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request);
    })
  );
});
