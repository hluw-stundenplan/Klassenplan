// Offline-Unterstützung: App-Dateien aus dem Cache, Daten immer zuerst aus dem Netz
const CACHE = "klassenplan-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "config.json", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Netz zuerst, damit Entfälle sofort sichtbar sind; offline die letzte gespeicherte Fassung
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req, { ignoreSearch: true })));
});
