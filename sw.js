const CACHE = 'empanadas-v4';
const SHELL = ['/manifest.json'];

// Install: pre-cache apenas manifest (index.html sempre via network-first)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: apaga caches antigos e assume controle imediato
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Supabase / bcv.today → sempre network, sem cache
// - index.html / '/' → network-first (atualiza sempre, fallback cache)
// - Outros assets → cache-first (manifest, icons)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // APIs externas → sempre network
  if (url.hostname.includes('supabase.co') || url.hostname.includes('bcv.today')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // index.html e raiz → network-first (garante sempre versão mais recente)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Outros assets (manifest, icons) → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET' && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
