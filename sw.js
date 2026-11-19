/* CADVIEW Studio PWA 1.5.0. Same-origin shell incl. bundled three.js; OCCT engine cached on first use; CDN only as fallback. */
const VERSION = 'cadview-studio-1.5.0';
const RUNTIME = 'cadview-deps-1.5.0';
const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=1.2.0',
  './enhancements.css?v=1.3.0',
  './rework.css?v=1.5.0',
  './app.js?v=1.5.0',
  './gui.js?v=1.5.0',
  './occt-worker.js?v=1.5.0',
  './manifest.webmanifest?v=1.5.0',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three/build/three.core.min.js',
  './vendor/three/build/three.module.min.js',
  './vendor/three/examples/jsm/controls/OrbitControls.js',
  './vendor/three/examples/jsm/exporters/GLTFExporter.js',
  './vendor/three/examples/jsm/exporters/OBJExporter.js',
  './vendor/three/examples/jsm/exporters/STLExporter.js',
  './vendor/three/examples/jsm/loaders/GLTFLoader.js',
  './vendor/three/examples/jsm/loaders/OBJLoader.js',
  './vendor/three/examples/jsm/loaders/STLLoader.js',
  './vendor/three/examples/jsm/utils/BufferGeometryUtils.js'
];
// The OpenCascade engine (vendor/occt-import-js, ~7.6 MB) is cached on first STEP/IGES import (runtime cache).
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