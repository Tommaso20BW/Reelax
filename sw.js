/* Reelax service worker
   - pagina: prima la rete (sempre l'ultima versione), se sei offline usa l'ultima copia salvata
   - immagini e altri file: subito dalla copia salvata, aggiornati in background
   - le richieste dell'aggiornamento automatico (cache: no-store / force-cache) non vengono toccate, tranne la copia "in uso" */
const SHELL = "rx-shell-v1", ASSETS = "rx-assets-v1";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;                 // solo file di questo sito (TMDB, font ecc. restano com'è)
  if (r.cache === "no-store" || r.cache === "reload") return; // controllo aggiornamenti: sempre dalla rete
  if (r.mode === "navigate") { e.respondWith(navigate(r, u)); return; }
  if (r.cache === "force-cache" && (u.pathname.endsWith("/") || u.pathname.endsWith(".html"))) {
    // copia della pagina attualmente in uso (serve all'aggiornamento automatico per capire se è cambiata)
    e.respondWith(caches.open(SHELL).then(c => c.match(r.url)).then(m => m || fetch(r)));
    return;
  }
  e.respondWith(swr(r));
});

async function navigate(r, u) {
  const c = await caches.open(SHELL);
  try {
    const res = await fetch(r);
    if (res.ok) c.put(r.url, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const m = (await c.match(r.url)) || (await c.match(u.origin + u.pathname, { ignoreSearch: true }));
    return m || Response.error();
  }
}

async function swr(r) {
  const c = await caches.open(ASSETS);
  const m = await c.match(r);
  const n = fetch(r).then(res => { if (res.ok && res.type === "basic") c.put(r, res.clone()).catch(() => {}); return res; }).catch(() => null);
  return m || (await n) || Response.error();
}
