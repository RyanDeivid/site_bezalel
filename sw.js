/* Service worker da Bezalel — gerado por scripts/postbuild.ts a partir deste modelo.
 *
 * Estratégias:
 *  - páginas (navegação): REDE primeiro (conteúdo sempre atual quando há
 *    conexão); sem rede, a última versão guardada — ou a home;
 *  - /assets/ (arquivos com hash no nome, imutáveis): CACHE primeiro;
 *  - demais arquivos do site: cache com atualização em segundo plano.
 * Uma versão nova (VERSION) apaga os caches antigos na ativação.
 * Desligar em emergência: publicar um sw.js que só chama self.registration.unregister().
 */
const VERSION = "d761c4e05fc3";
const BASE = "/site_bezalel/";
const PRECACHE = ["/site_bezalel/","/site_bezalel/assets/geist-latin-wght-normal-BgDaEnEv.woff2","/site_bezalel/assets/geist-mono-latin-wght-normal-XN7g48iV.woff2","/site_bezalel/assets/instrument-serif-latin-400-italic-DKMiL14s.woff2","/site_bezalel/assets/courses-B4aEEG36.js","/site_bezalel/favicon.svg","/site_bezalel/manifest.webmanifest","/site_bezalel/assets/index-D6h_Aru0.js","/site_bezalel/assets/rolldown-runtime-hePW80VL.js","/site_bezalel/assets/index-BodxRSMN.css"];
const CACHE = `bz-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bz-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(BASE)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit ?? Response.error());
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
