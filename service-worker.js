const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-6';
const SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k.5-5';
const APP_SHELL = [
  './index.html',
  './v3.html',
  './manifest.webmanifest',
  './author-banks.json',
  './styles/v3.css',
  './styles/v3-p3.css',
  './styles/v3-p4.css',
  './styles/v3-p5.css',
  './styles/v3-p6.css',
  './styles/v3-p7.css',
  './styles/v3-v31.css',
  './styles/v3-v33.css',
  './styles/v4-design.css',
  './styles/v4-learning.css',
  './styles/v4-learning-styles.css',
  './styles/v4-studio.css',
  './styles/v4-studio-r1.css',
  './styles/v4-studio-batch.css',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
  './assets/pwa/icon-maskable-512.png',
  './assets/learning/light-sun-corner.svg',
  './assets/learning/light-books-side.svg',
  './assets/learning/dark-moon-lantern.svg',
  './assets/learning/dark-desk-side.svg',

  './src/app/config.js',
  './src/app/main.js',
  './src/app/p7.js',
  './src/app/preflight.js',

  './src/data/migration/legacy-v1-to-v2.js',
  './src/data/schema/question-bank.js',

  './src/question-bank/author-catalog.js',
  './src/question-bank/importer.js',
  './src/question-bank/package-reader.js',
  './src/question-bank/validator.js',
  './src/question-bank/zip-reader.js',
  './src/question-bank/zip-writer.js',

  './src/quiz/exam-engine.js',
  './src/quiz/review-engine.js',
  './src/quiz/scoring.js',
  './src/quiz/session-engine.js',
  './src/quiz/shuffle.js',

  './src/storage/backup.js',
  './src/storage/db.js',
  './src/storage/settings.js',
  './src/storage/repositories/attempts.js',
  './src/storage/repositories/banks.js',
  './src/storage/repositories/goals.js',
  './src/storage/repositories/learning.js',
  './src/storage/repositories/progress.js',
  './src/storage/repositories/review.js',
  './src/storage/repositories/sessions.js',
  './src/storage/repositories/studio.js',

  './src/studio/asset-manager.js',
  './src/studio/editor-model.js',
  './src/studio/package-to-draft.js',
  './src/studio/question-draft.js',

  './src/ui/bank-detail.js',
  './src/ui/exam-center.js',
  './src/ui/exam.js',
  './src/ui/library.js',
  './src/ui/practice.js',
  './src/ui/review-center.js',
  './src/ui/settings.js',
  './src/ui/scene-assets.js',
  './src/ui/stats.js',
  './src/ui/studio.js',
  './src/ui/studio-r1.js',
  './src/ui/studio-batch-import.js',
  './src/ui/tools.js',

  './src/utils/ids.js',
  './src/utils/mime.js',
  './src/utils/path.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => (key.startsWith('moxin-quiz-v3-') && key !== CACHE_VERSION) || (key.startsWith('moxin-quiz-scenes-') && key !== SCENE_CACHE_VERSION))
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isLearningScene(url)) {
    event.respondWith(cacheFirstScene(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      await cache.match(request) ||
      await cache.match('./index.html') ||
      await cache.match('./v3.html') ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  return (await networkPromise) || Response.error();
}

function isLearningScene(url) {
  return url.pathname.includes('/assets/learning/styles/') ||
    url.pathname.includes('/assets/learning/scenes/');
}

async function cacheFirstScene(request) {
  const cache = await caches.open(SCENE_CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}
