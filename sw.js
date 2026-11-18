/* CADVIEW Studio PWA. Same-origin shell cache; CDN resources cached opportunistically. */
const VERSION = 'cadview-studio-1.4.2';
const RUNTIME = 'cadview-deps-1.4.2';
const APP_FILES = [
  './','./index.html','./styles.css?v=1.2.0','./app.js?v=1.4.2',
  './occt-worker.js?v=1.2.0','./manifest.webmanifest?v=1.3.0','./enhancements.css?v=1.3.0','./rework.css?v=1.4.2','./gui.js?v=1.4.1',
  './icons/icon-192.png','./icons/icon-512.png','./README.md'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('cadview-')&&!([VERSION,RUNTIME].includes(n))).map(n=>caches.delete(n)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const isLocal=url.origin===self.location.origin;
  const isDependency=['cdn.jsdelivr.net','unpkg.com'].includes(url.hostname);
  if(!isLocal&&!isDependency)return;
  event.respondWith((async()=>{
    const cache=await caches.open(isLocal?VERSION:RUNTIME);
    // Always revalidate main HTML when online; cached shell still works offline.
    const freshFirst=isLocal&&(request.mode==='navigate'||url.pathname.endsWith('/index.html'));
    if(!freshFirst){
      const cached=await cache.match(request);
      if(cached)return cached;
    }
    try{
      const response=await fetch(request);
      if(response.ok||response.type==='opaque')cache.put(request,response.clone()).catch(()=>{});
      return response;
    }catch(err){
      const fallback=await cache.match(request);
      if(fallback)return fallback;
      if(isLocal&&request.mode==='navigate'){
        const shell=await cache.match('./index.html');if(shell)return shell;
      }
      throw err;
    }
  })());
});