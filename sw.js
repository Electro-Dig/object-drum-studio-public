const CACHE_NAME = "client-show-console-v5-light-blue-brown-red";
const SHELL_ASSETS = [
  "/console.html",
  "/console.css",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/index.html",
  "/src/console/app.js",
  "/src/console/profile.js",
  "/src/console/profileStorage.js",
  "/src/console/showModeGuard.js",
  "/src/console/entryGate.js",
  "/src/console/soundSelector.js",
  "/src/console/sampleStore.js",
  "/src/console/audioEngine.js",
  "/src/console/recognitionSession.js",
  "/src/detection/calibratedColorDetector.js",
  "/src/detection/colorMetrics.js",
  "/src/detection/colorSegmentation.js",
  "/src/detection/padTracker.js",
  "/src/detection/trackColorResolver.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/console.html", copy));
          return response;
        })
        .catch(() => caches.match("/console.html")),
    );
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => (
      cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
    )),
  );
});
