const CACHE_VER='v4.2';
const CACHE_STATIC=`market-pro-static-${CACHE_VER}`;
const CACHE_PAGES=`market-pro-pages-${CACHE_VER}`;
const ALL_CACHES=[CACHE_STATIC,CACHE_PAGES];

const APP_SHELL=[
'./index.html',
'./app.html',
'./offline.html',
'./style.css',
'./app.js',
'./data.js',
'./ui.js',
'./subscription.js',

/* pages precache */
'./pages/dashboard.js',
'./pages/invoices.js',
'./pages/sales.js',
'./pages/suppliers.js',
'./pages/customers.js',
'./pages/tarhil.js',
'./pages/khazna.js',
'./pages/employees.js',
'./pages/market_shops.js',
'./pages/financial.js',
'./pages/partners.js',

'./icons/icon-192.jpg',
'./icons/icon-512.jpg',
'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap',
'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install',event=>{
event.waitUntil(
caches.open(CACHE_STATIC)
.then(cache=>Promise.allSettled(
APP_SHELL.map(url=>
cache.add(url).catch(()=>console.warn('[SW skip]',url))
)
))
.then(()=>self.skipWaiting())
);
});

self.addEventListener('activate',event=>{
event.waitUntil(
caches.keys()
.then(keys=>Promise.all(
keys.filter(k=>!ALL_CACHES.includes(k)).map(k=>caches.delete(k))
))
.then(()=>self.clients.claim())
);
});

self.addEventListener('fetch',event=>{
const request=event.request;
const url=new URL(request.url);
if(request.method!=='GET') return;

if(url.hostname.includes('supabase.co')){
event.respondWith(
fetch(request).catch(()=>new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}}))
);
return;
}

if(url.hostname.includes('fonts.googleapis.com')||url.hostname.includes('fonts.gstatic.com')){
event.respondWith(
caches.match(request).then(cached=>cached||fetch(request).then(resp=>{
const clone=resp.clone();
caches.open(CACHE_STATIC).then(c=>c.put(request,clone));
return resp;
}))
);
return;
}

if(request.mode==='navigate'){
event.respondWith(
fetch(request)
.then(resp=>{
if(resp.ok){
const clone=resp.clone();
caches.open(CACHE_PAGES).then(c=>c.put(request,clone));
}
return resp;
})
.catch(()=>caches.match(request).then(cached=>cached||caches.match('./offline.html')))
);
return;
}

const isAsset=/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)(\?.*)?$/.test(url.pathname)||url.hostname.includes('jsdelivr');

if(isAsset){
/* stale while revalidate */
event.respondWith(
caches.match(request).then(cached=>{
const networkFetch=fetch(request).then(resp=>{
if(resp.ok){
const clone=resp.clone();
caches.open(CACHE_STATIC).then(c=>c.put(request,clone));
}
return resp;
}).catch(()=>cached||new Response('',{status:404}));
return cached||networkFetch;
})
);
return;
}

event.respondWith(
fetch(request)
.then(resp=>{
if(resp.ok){
const clone=resp.clone();
caches.open(CACHE_PAGES).then(c=>c.put(request,clone));
}
return resp;
})
.catch(()=>caches.match(request))
);
});

self.addEventListener('message',event=>{
if(event.data==='SKIP_WAITING') self.skipWaiting();

if(event.data==='CLEAR_CACHE'){
caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))))
.then(()=>self.clients.matchAll().then(clients=>{
clients.forEach(client=>client.navigate(client.url));
}));
}
});