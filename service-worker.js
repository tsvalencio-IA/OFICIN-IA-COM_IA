const CACHE='oficin-ia-checklist-v10-entrega-conferencia-20260623';
const ASSETS=['./checklist.html','./js/checklist.js','./data/checklist-model.json','./checklist.webmanifest','./assets/icons/checklist-192.png','./assets/icons/checklist-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>null)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.includes('checklist')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{try{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}catch(_e){}return r;}).catch(()=>caches.match(e.request)))});
