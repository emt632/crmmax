// Service worker for PWA Share Target
// Intercepts POST requests from the OS share sheet and passes the vCard file to the app

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept POST to /share-target (from OS share sheet)
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get('vcf');

        if (file && file instanceof File) {
          const text = await file.text();
          // Store the vCard text in Cache API for the page to pick up
          const cache = await caches.open('share-target');
          await cache.put('/shared-vcf', new Response(text, {
            headers: { 'Content-Type': 'text/plain' }
          }));
        }

        // Redirect to the share target page (GET) so React can render
        return Response.redirect('/share-target', 303);
      })()
    );
    return;
  }

  // All other requests: pass through to network (no offline caching)
});
