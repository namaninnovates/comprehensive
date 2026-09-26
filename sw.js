/**
 * Comprehensive Exam Quiz System - Service Worker (sw.js)
 * Caches all application code, questions database, styles, and diagram images for 100% offline access.
 */

const CACHE_NAME = 'faceit-offline-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './data/questions.js',
  './data/questions.json',
  './js/history.js',
  './js/quiz.js',
  './js/bank.js',
  './js/report.js',
  './js/app.js',
  './data/images/q_img_85_1.png',
  './data/images/q_img_164_2.png',
  './data/images/q_img_170_3.png',
  './data/images/q_img_254_4.png',
  './data/images/q_img_337_5.png',
  './data/images/q_img_339_6.png',
  './data/images/q_img_339_7.png',
  './data/images/q_img_355_8.png',
  './data/images/q_img_384_9.png',
  './data/images/q_img_385_10.png',
  './data/images/q_img_386_11.png',
  './data/images/q_img_387_12.png',
  './data/images/q_img_388_13.png',
  './data/images/q_img_389_14.png',
  './data/images/q_img_389_15.png',
  './data/images/q_img_390_16.png',
  './data/images/q_img_390_17.png',
  './data/images/q_img_391_18.png',
  './data/images/q_img_391_19.png',
  './data/images/q_img_392_20.png',
  './data/images/q_img_392_21.png',
  './data/images/q_img_393_22.png',
  './data/images/q_img_393_23.png',
  './data/images/q_img_393_24.png',
  './data/images/q_img_394_25.png',
  './data/images/q_img_394_26.png',
  './data/images/q_img_395_27.png',
  './data/images/q_img_395_28.png',
  './data/images/q_img_396_29.png'
];

// Install Event: Cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static assets & offline question database');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-while-revalidate / Cache First with Network Fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET or cross-origin requests like Google Analytics
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // If request is for Google Analytics or third-party fonts, pass through with catch
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Local assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed (offline), returning cached response
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
