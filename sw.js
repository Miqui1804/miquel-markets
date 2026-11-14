/* Miquel Markets · service worker
 * - La página (index.html) va siempre primero a la red: los datos se actualizan casi a diario.
 *   Sin conexión se muestra la última versión vista.
 * - Imágenes, iconos, Chart.js y fuentes: se sirven desde caché y se refrescan en segundo plano.
 * - TradingView y el resto de terceros no se tocan.
 * Si cambias la estrategia de caché, sube VERSION para que se borren las cachés antiguas.
 */
const VERSION = 'v1';
const PAGINAS = 'mm-paginas-' + VERSION;
const ESTATICOS = 'mm-estaticos-' + VERSION;
const INICIO = new URL('./', self.location).href;
const PRECARGA = [
  'manifest.webmanifest',
  'animal-V.webp',
  'animal-A.webp',
  'animal-R.webp',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png'
];
const CDN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const ESPERA_RED = 8000; // ms antes de recurrir a la copia guardada si la red no responde

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(PAGINAS).then((c) => c.add(INICIO)),
      caches.open(ESTATICOS).then((c) => c.addAll(PRECARGA))
    ])
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('mm-') && k !== PAGINAS && k !== ESTATICOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero, con copia de respaldo. */
function redPrimero(req, clave) {
  return caches.open(PAGINAS).then((cache) => {
    const red = fetch(req).then((res) => {
      if (res && res.ok) cache.put(clave || req, res.clone());
      return res;
    });
    const respaldo = () => cache.match(clave || req, { ignoreSearch: true }).then((r) => r || cache.match(INICIO));
    let temporizador;
    const lenta = new Promise((ok) => {
      temporizador = setTimeout(() => respaldo().then((r) => r && ok(r)), ESPERA_RED);
    });
    return Promise.race([red, lenta])
      .then((r) => { clearTimeout(temporizador); return r; })
      .catch(() => { clearTimeout(temporizador); return respaldo().then((r) => r || Response.error()); });
  });
}

/* Caché primero y refresco en segundo plano. */
function cacheYRefresco(e) {
  return caches.open(ESTATICOS).then((cache) =>
    cache.match(e.request).then((guardada) => {
      const red = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
        return res;
      });
      if (guardada) {
        e.waitUntil(red.catch(() => {}));
        return guardada;
      }
      return red;
    })
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;
  const enAmbito = mismoOrigen && req.url.startsWith(INICIO);

  // La web: siempre la versión más reciente si hay red (una sola copia, sin #ancla ni ?query)
  if (req.mode === 'navigate' && enAmbito) {
    e.respondWith(redPrimero(req, INICIO));
    return;
  }
  // Datos del screener (otra web del mismo dominio): red primero
  if (mismoOrigen && !enAmbito) {
    e.respondWith(redPrimero(req));
    return;
  }
  // Imágenes e iconos propios, Chart.js y fuentes
  if (enAmbito || CDN.includes(url.hostname)) {
    e.respondWith(cacheYRefresco(e));
  }
  // Todo lo demás (TradingView, PayPal...) va directo a la red
});
