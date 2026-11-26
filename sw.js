/* CADVIEW Studio PWA 1.5.0. Same-origin shell incl. bundled three.js; OCCT engine cached on first use; CDN only as fallback. */
const VERSION = 'cadview-studio-workbench-step-detail3';
const RUNTIME = 'cadview-deps-1.5.0';
const APP_FILES = [
  './assets/sl/fonts.css?v=sl3',
  './assets/sl/tokens.css?v=sl3',
  './assets/sl/app.css?v=sl3',
  './assets/sl/workbench.css?v=sl3',
  './workbench.css?v=sl3',
  './icons/icon.svg',
  './assets/sl/brand/logo-dark.svg',
  './assets/sl/brand/logo-light.svg',
  './assets/sl/fonts/ibm-plex-mono-latin-400-normal.woff2',
  './assets/sl/fonts/ibm-plex-mono-latin-500-normal.woff2',
  './assets/sl/fonts/ibm-plex-mono-latin-ext-400-normal.woff2',
  './assets/sl/fonts/ibm-plex-mono-latin-ext-500-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-greek-400-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-greek-500-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-greek-600-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-400-italic.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-400-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-500-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-600-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-ext-400-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-ext-500-normal.woff2',
  './assets/sl/fonts/ibm-plex-sans-latin-ext-600-normal.woff2',
  './assets/sl/fonts/source-serif-4-latin-ext-wght-italic.woff2',
  './assets/sl/fonts/source-serif-4-latin-ext-wght-normal.woff2',
  './assets/sl/fonts/source-serif-4-latin-wght-italic.woff2',
  './assets/sl/fonts/source-serif-4-latin-wght-normal.woff2',
  './',
  './index.html',
  './styles.css?v=1.2.0',
  './enhancements.css?v=1.3.0',
  './rework.css?v=1.5.0',
  './app.js?v=step-detail1',
  './gui.js?v=m2',
  './mobile/inspection.js?v=m2',
  './mobile/touch.js?v=m2',
  './mobile/gyro.js?v=m2',
  './mobile/inspection.css?v=m2',
  './occt-worker.js?v=step-detail1',
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
async function preserveEngine(){
  const previous = 'cadview-studio-1.5.0';
  if (!(await caches.has(previous))) return;
  const source = await caches.open(previous);
  const next = await caches.open(RUNTIME);
  for (const name of ['occt-import-js.js','occt-import-js.wasm']){
    const key = './vendor/occt-import-js/' + name;
    const response = await source.match(key);
    if (response) await next.put(key,response);
  }
}
self.addEventListener('activate', event => {
  event.waitUntil(preserveEngine().then(()=>Promise.all([
    caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('cadview-')&&!([VERSION,RUNTIME].includes(n))).map(n=>caches.delete(n)))),
    self.clients.claim()
  ])));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const isLocal=url.origin===self.location.origin;
  const isDependency=['cdn.jsdelivr.net','unpkg.com'].includes(url.hostname);
  if(!isLocal&&!isDependency)return;
  event.respondWith((async()=>{
    const engine=isLocal && url.pathname.startsWith(new URL('./vendor/occt-import-js/',self.registration.scope).pathname);
    const cache=await caches.open(isLocal&&!engine?VERSION:RUNTIME);
    // Always revalidate main HTML when online; cached shell still works offline.
    const freshFirst=isLocal&&(request.mode==='navigate'||url.pathname.endsWith('/index.html'));
    if(!freshFirst){
      const cached=await cache.match(request);
      if(cached)return cached;
    }
    try{
      const response=await fetch(request);
      if(response.ok||response.type==='opaque')event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
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