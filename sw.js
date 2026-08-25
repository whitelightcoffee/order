/* 白光 Service Worker
   策略：same-origin 的 GET 一律「先連網路」（network-first），
   拿到最新就用最新，同時存一份當離線備援；真的沒網路時才用備援。
   → 每次開啟／重開都會是最新版，不需要按按鈕，也不需要改版本號。
   跨網域請求（例如 Google Apps Script 後端、Google 字型）不攔截，交給瀏覽器正常處理。 */

const CACHE = 'wl-cache-v1';

self.addEventListener('install', function (event) {
  self.skipWaiting(); // 新版一裝好就接手，不用等舊分頁全部關掉
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k); // 清掉舊快取
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // 只處理「同源 + GET」；後端 API、外部字型等一律不介入
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async function () {
    try {
      // 一律先連網路抓最新（no-store：不吃瀏覽器 HTTP 快取）
      const fresh = await fetch(req.url, { cache: 'no-store' });
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone()); // 存一份，離線時才拿得出來
      return fresh;
    } catch (e) {
      // 沒網路時才退回快取
      const cached = await caches.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});
