/* First Note: Perfect Pitch — usage hors ligne.
   Le code de l'appli est toujours demandé au réseau d'abord (pour recevoir les mises à jour), avec repli sur la copie locale.
   Les sons (enregistrements, notes du piano) sont gardés dès leur première écoute. */
const CACHE = "absolute-hear-1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const son = /\.(mp3|ogg)$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (son) {
      const garde = await cache.match(req);
      if (garde) return garde;
    }
    try {
      const rep = await fetch(req);
      if (rep.ok && (rep.type === "basic" || rep.type === "cors")) cache.put(req, rep.clone());
      return rep;
    } catch (err) {
      const garde = await cache.match(req, { ignoreSearch: !son });
      if (garde) return garde;
      throw err;
    }
  })());
});
