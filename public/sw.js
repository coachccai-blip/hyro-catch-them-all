/**
 * Service worker de HYRO.
 *
 * Objectif : une fois le jeu ouvert une première fois, il est **entièrement
 * disponible hors ligne** et démarre instantanément (plus aucun aller-retour
 * réseau au lancement). C'est ce qui permet de l'« installer » sur le
 * téléphone comme une application.
 *
 * Stratégie :
 *  - navigation (la page elle-même) : réseau d'abord, cache en secours, afin
 *    de récupérer les mises à jour dès qu'il y a du réseau ;
 *  - autres ressources même origine : cache d'abord (démarrage immédiat), avec
 *    rafraîchissement silencieux en arrière-plan.
 */

const VERSION = 'hyro-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
