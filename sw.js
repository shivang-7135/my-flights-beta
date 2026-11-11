/* Offline support: on first load every file of the app is copied into the phone's cache,
   after which the app starts and works with no connection at all.
   Tickets are NOT in here — they live in IndexedDB, which app updates never touch.
   Change VERSION whenever any app file changes, so phones pick up the new files. */
var VERSION = 'v12';
// Several copies of the app (main, beta) can live on one web host; each keeps its own offline files.
var PREFIX = 'my-flights::' + self.registration.scope + '::';
var CACHE = PREFIX + VERSION;
var IS_BETA = /beta/i.test(self.registration.scope);
var FILES = [
  './', 'index.html', 'manifest.json',
  'css/app.css',
  'js/data.js', 'js/parser.js', 'js/time.js', 'js/status.js', 'js/db.js', 'js/ocr.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js',
  'vendor/pdfjs/standard_fonts/FoxitDingbats.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixed.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerif.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb',
  'vendor/pdfjs/standard_fonts/FoxitSymbol.pfb',
  'vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf',
  'vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
  'vendor/tesseract/lang/eng.traineddata.gz', 'vendor/tesseract/lang/deu.traineddata.gz'
];

self.addEventListener('install', function (e) {
  // A new version waits until the user taps "Update" in the app (or all windows are closed),
  // so the app never changes under someone's fingers. The very first install has nothing to wait for.
  // cache: 'reload' makes sure the files come fresh from the server, never from the browser's
  // ordinary cache — otherwise an update could silently keep an old file.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      var mine = k.indexOf(PREFIX) === 0 && k !== CACHE;
      var legacy = !IS_BETA && /^my-flights-v\d+$/.test(k);     // names used before the beta existed
      return mine || legacy;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) { if (e.data === 'update-now') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (c) { return c.match(req, { ignoreSearch: true }); }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.open(CACHE).then(function (c) { return c.match('index.html'); }).then(function (page) { return page || fetch(req); });
      return fetch(req);
    })
  );
});
