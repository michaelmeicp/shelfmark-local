const CACHE='shelfmark-shell-'+new URL(self.registration.scope).pathname+'-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./covers.js','./model.js','./editor.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!ASSETS.map(a=>new URL(a,self.registration.scope).href).includes(new URL(e.request.url).origin+new URL(e.request.url).pathname))return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request,{ignoreSearch:true}))||fetch(e.request)));});
