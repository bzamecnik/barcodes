// Service worker making the app work offline.
//
// Network first: when online, the latest version is always loaded (so
// updates arrive automatically) and stored in the cache; when offline, the
// cached version is used.

const CACHE = 'barcodes-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        // after loading a new version of the page, drop the old hashed assets
        if (request.mode === 'navigate') event.waitUntil(pruneAssets(cache, await response.clone().text()));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) return cached;
      throw error;
    }
  })());
});

/** Remove cached files under assets/ which the current page doesn't reference. */
async function pruneAssets(cache, html) {
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (path.includes('/assets/') && !html.includes(name)) {
      // lazily loaded chunks are referenced from the scripts, keep them
      if (!/^index-/.test(name)) continue;
      await cache.delete(request);
    }
  }
}
