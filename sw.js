/* 單字卡複習 service worker
 * - 頁面：網路優先（3.5 秒沒回應就用快取），所以更新會自動拿到，離線也能開。
 * - 圖示、manifest：先給快取，背景更新。
 * - Firebase 程式庫與 Google 字體：快取起來，離線時也能載入。
 * - Firestore、登入、其他網域：完全不攔截。
 * 改了 sw.js 或預先快取清單時，請把 VER 加一。 */
const VER = 'v1';
const CORE = 'vocab-core-' + VER;
const RUNTIME = 'vocab-rt-' + VER;
const INDEX = new URL('./index.html', self.registration.scope).href;
const PRECACHE = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = res => res && (res.ok || res.type === 'opaque');
const keep = (e, p) => { try { e.waitUntil(p); } catch (_) { /* the event is already finished; the write still runs */ } };

async function navigate(e) {
  const cache = await caches.open(CORE);
  const fresh = fetch(e.request).then(res => {
    if (res && res.ok) keep(e, cache.put(INDEX, res.clone()).catch(() => {}));
    return res;
  }).catch(() => null);
  const timeout = new Promise(r => setTimeout(() => r(null), 3500));
  const first = await Promise.race([fresh, timeout]);
  return first || (await cache.match(INDEX)) || (await fresh) || Response.error();
}

async function cacheFirst(e, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  if (cacheable(res)) keep(e, cache.put(e.request, res.clone()).catch(() => {}));
  return res;
}

async function staleWhileRevalidate(e, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(e.request, { ignoreVary: true });
  const net = fetch(e.request).then(res => {
    if (cacheable(res)) keep(e, cache.put(e.request, res.clone()).catch(() => {}));
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === self.location.origin) {
    if (r.mode === 'navigate') return e.respondWith(navigate(e));
    return e.respondWith(staleWhileRevalidate(e, CORE));
  }
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) return e.respondWith(cacheFirst(e, RUNTIME));
  if (u.hostname === 'fonts.googleapis.com') return e.respondWith(staleWhileRevalidate(e, RUNTIME));
  if (u.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(e, RUNTIME));
  /* anything else (Firestore, sign-in, Google accounts) goes straight to the network */
});

/* The page tells us which Firebase/font files it already loaded before this worker took control. */
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'cache' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(RUNTIME);
    await Promise.all(d.urls.slice(0, 60).map(async url => {
      try {
        const u = new URL(url);
        const ok = (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
        if (!ok || await cache.match(url, { ignoreVary: true })) return;
        const res = await fetch(u.hostname === 'fonts.googleapis.com' ? new Request(url, { mode: 'no-cors' }) : url);
        if (cacheable(res)) await cache.put(url, res);
      } catch (_) { /* best effort */ }
    }));
  })());
});
