const CACHE_NAME = 'imserp-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon.svg',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/icon-maskable-192x192.png',
  '/assets/icons/icon-maskable-512x512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/icon.svg',
  '/assets/fonts/material-icons.woff2'
];

let activeTenantBranding = null;

// Install: Cache critical static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-caching non-fatal asset issue:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge old cache versions & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== 'imserp-dynamic-branding')
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Don't cache non-GET requests (POST, PUT, DELETE)
  if (req.method !== 'GET') {
    return;
  }

  // 2. Dynamic Web App Manifest Handler for Multi-Tenant ERP Branding
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      (async () => {
        let branding = activeTenantBranding;
        if (!branding || (!branding.instituteName && !branding.dynamicManifest)) {
          try {
            const brandingCache = await caches.open('imserp-dynamic-branding');
            const cachedRes = await brandingCache.match('/__tenant_manifest_data__');
            if (cachedRes) {
              branding = await cachedRes.json();
            }
          } catch (e) {
            console.warn('[PWA SW] Error reading cached branding:', e);
          }
        }

        if (branding) {
          if (branding.dynamicManifest) {
            return new Response(JSON.stringify(branding.dynamicManifest, null, 2), {
              status: 200,
              headers: {
                'Content-Type': 'application/manifest+json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
          }

          if (branding.instituteName && branding.instituteName.trim()) {
            const compName = branding.instituteName.trim();
            const logo = branding.logoUrl || '/assets/icons/icon-192x192.png';
            const icon192 = branding.icon192 || logo;
            const icon512 = branding.icon512 || logo;
            const maskable192 = branding.maskable192 || icon192;
            const maskable512 = branding.maskable512 || icon512;

            const dynamicManifest = {
              name: `${compName} - School ERP`,
              short_name: compName,
              description: `${compName} Enterprise ERP solution for School Classes, Coaching Batches, Hybrid Admissions, Fee Collections, and Student Portals.`,
              start_url: '/',
              scope: '/',
              display: 'standalone',
              display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
              background_color: '#ffffff',
              theme_color: '#2563eb',
              orientation: 'any',
              lang: 'en-IN',
              dir: 'ltr',
              categories: ['education', 'business', 'productivity'],
              icons: [
                {
                  src: icon192,
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any'
                },
                {
                  src: maskable192,
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'maskable'
                },
                {
                  src: icon512,
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any'
                },
                {
                  src: maskable512,
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable'
                }
              ],
              shortcuts: [
                {
                  name: 'Dashboard',
                  short_name: 'Dashboard',
                  description: 'Executive Overview & Insights',
                  url: '/dashboard',
                  icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }]
                },
                {
                  name: 'Attendance',
                  short_name: 'Attendance',
                  description: 'Daily Student & Teacher Attendance',
                  url: '/student-attendance',
                  icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }]
                },
                {
                  name: 'Fees Collection',
                  short_name: 'Fees',
                  description: 'Collect Fees & Instant Receipt',
                  url: '/fees',
                  icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }]
                },
                {
                  name: 'Student Directory',
                  short_name: 'Students',
                  description: 'Search & View Enrolled Students',
                  url: '/students',
                  icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }]
                }
              ]
            };

            return new Response(JSON.stringify(dynamicManifest, null, 2), {
              status: 200,
              headers: {
                'Content-Type': 'application/manifest+json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
          }
        }

        // Fallback to static manifest if no tenant logged in
        return fetch(req).catch(() => caches.match(req));
      })()
    );
    return;
  }

  // 3. Dynamic tenant cached icons
  if (url.pathname === '/__tenant_icon_192.png' || url.pathname === '/__tenant_icon_512.png') {
    event.respondWith(
      (async () => {
        try {
          const brandingCache = await caches.open('imserp-dynamic-branding');
          const cached = await brandingCache.match(req.url);
          if (cached) return cached;
        } catch (e) {}
        return caches.match('/assets/icons/icon-192x192.png');
      })()
    );
    return;
  }

  // 4. Proxy uploaded logos/documents to backend if requested on frontend origin
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 5. API calls: Strictly Network-first, never return stale financial/student transactions
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'You are currently offline. Please reconnect to perform this action.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 6. SPA Navigation requests (HTML pages): Network-first with cache fallback to /index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 7. Static assets (JS, CSS, images, fonts): Cache-first with network fallback
  const isStatic =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.startsWith('/assets/');

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          fetch(req).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Tenant Branding & Update Messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_TENANT_BRANDING') {
    activeTenantBranding = event.data.payload;
    if (event.data.payload) {
      caches.open('imserp-dynamic-branding').then((cache) => {
        const payloadData = event.data.payload;
        cache.put(
          new Request('/__tenant_manifest_data__'),
          new Response(JSON.stringify(payloadData), {
            headers: { 'Content-Type': 'application/json' }
          })
        );
        if (payloadData.dynamicManifest) {
          cache.put(
            new Request('/manifest.webmanifest'),
            new Response(JSON.stringify(payloadData.dynamicManifest, null, 2), {
              headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
            })
          );
          cache.put(
            new Request('/manifest.json'),
            new Response(JSON.stringify(payloadData.dynamicManifest, null, 2), {
              headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
            })
          );
        }
      });
    }
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
