const CACHE_NAME = 'chusen-manager-v14-live-web-scan';
const ASSETS = [
  './','./index.html','./styles.css','./app.js','./auth.js','./firebase-config.js','./manifest.json',
  './assets/apple-touch-icon.png','./assets/icon-192.png','./assets/icon-512.png','./assets/favicon.png',
  './assets/onepiece.svg','./assets/pokemon.svg','./assets/beyblade.svg','./assets/default.svg'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
