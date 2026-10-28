/* Offline support. After one visit with signal, the site opens without it:
   the page, its data, every small photo, the fonts and the map code are kept on the phone.
   Large photos, map tiles and walking routes are kept as you look at them.
   The shared Google Sheet is never cached: the page queues changes itself until it's back online.
   Change VERSION to make phones drop the old copy of the core files. */
var VERSION = 'trip-v1';
var KEEP = 'trip-seen';   // tiles, routes, large photos: kept across versions
var CORE = [
  './', 'index.html', 'place-tags.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css'
];
var MAX_SEEN = 3000;   // map tiles add up: keep the newest few thousand

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(CORE).then(function () { return c.match('index.html'); }).then(function (r) { return r.text(); }).then(function (html) {
      // every small photo and font stylesheet the page names
      var extra = (html.match(/images\/[\w.-]+\.jpg/g) || []).concat(
        (html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/g) || []).map(function (u) { return u.replace(/&amp;/g, '&'); }));
      return Promise.all(extra.filter(function (u, i) { return extra.indexOf(u) === i; })
        .map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION && k !== KEEP; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) { return caches.match(req, { ignoreVary: true }); }
function keep(cacheName, req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    var copy = res.clone();
    caches.open(cacheName).then(function (c) { c.put(req, copy); if (cacheName === KEEP) trim(c); });
  }
  return res;
}
var trimming = false;
function trim(c) {
  if (trimming) return; trimming = true;
  c.keys().then(function (ks) {
    return Promise.all(ks.slice(0, Math.max(0, ks.length - MAX_SEEN)).map(function (k) { return c.delete(k); }));
  }).then(function () { trimming = false; }, function () { trimming = false; });
}
// newest copy when the network answers quickly, the kept copy when it doesn't
function networkFirst(req, cacheName, ms) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      fromCache(req).then(function (r) { if (r && !settled) { settled = true; resolve(r); } });
    }, ms);
    fetch(req).then(function (res) {
      if (!res.ok) return fromCache(req).then(function (r) {   // an error page: the kept copy is better
        if (!settled) { settled = true; clearTimeout(timer); resolve(r || res); }
      });
      keep(cacheName, req, res);
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(function () {
      fromCache(req).then(function (r) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(r || Response.error()); }
      });
    });
  });
}
// the kept copy straight away, refreshed in the background
function staleWhileRevalidate(req, cacheName) {
  return fromCache(req).then(function (hit) {
    var net = fetch(req).then(function (res) { return keep(cacheName, req, res); }).catch(function () { return hit; });
    return hit || net;
  });
}
function cacheFirst(req, cacheName) {
  return fromCache(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { return keep(cacheName, req, res); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url), host = u.hostname;
  // live only: the shared sheet and the place lookup
  if (/(^|\.)script\.google(usercontent)?\.com$/.test(host) || host === 'nominatim.openstreetmap.org') return;
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, VERSION, 3500).then(function (r) {
      return r && r.type !== 'error' ? r : caches.match('index.html');
    }));
    return;
  }
  if (u.origin === self.location.origin) {
    e.respondWith(/\/images\/large\//.test(u.pathname) ? cacheFirst(req, KEEP) : staleWhileRevalidate(req, VERSION));
    return;
  }
  if (host === 'fonts.gstatic.com' || host === 'cdnjs.cloudflare.com') { e.respondWith(cacheFirst(req, VERSION)); return; }
  if (host === 'fonts.googleapis.com') { e.respondWith(staleWhileRevalidate(req, VERSION)); return; }
  if (host === 'tiles.openfreemap.org') {
    e.respondWith(/\/styles\//.test(u.pathname) ? staleWhileRevalidate(req, KEEP) : cacheFirst(req, KEEP));
    return;
  }
  if (host === 'routing.openstreetmap.de') { e.respondWith(networkFirst(req, KEEP, 6000)); return; }
});
