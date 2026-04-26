import { ensureUser } from './data.js';
import { checkSubscription } from './subscription.js';
import { toast } from './ui.js';

import { renderDashboard } from './pages/dashboard.js';
import { renderInvoicesPage } from './pages/invoices.js';
import { renderSalesPage } from './pages/sales.js';
import { renderSuppliersPage } from './pages/suppliers.js';
import { renderCustomersPage } from './pages/customers.js';
import { renderTarhilPage } from './pages/tarhil.js';
import { renderKhaznaPage } from './pages/khazna.js';
import { renderEmployeesPage } from './pages/employees.js';
import { renderMarketShopsPage } from './pages/market_shops.js';
import { renderFinancialPage } from './pages/financial.js';
import { renderPartnersPage } from './pages/partners.js';

const routes={
dashboard:renderDashboard,
invoices:renderInvoicesPage,
sales:renderSalesPage,
suppliers:renderSuppliersPage,
customers:renderCustomersPage,
tarhil:renderTarhilPage,
khazna:renderKhaznaPage,
employees:renderEmployeesPage,
market_shops:renderMarketShopsPage,
financial:renderFinancialPage,
partners:renderPartnersPage
};

const PAGE_TITLES={
dashboard:'📊 الرئيسية',
invoices:'📄 الفواتير',
sales:'🛒 المبيعات',
suppliers:'🚚 الموردين',
customers:'👥 العملاء',
tarhil:'📋 الترحيلات',
khazna:'💰 الخزنة',
employees:'👷 الموظفين',
market_shops:'🏬 محلات السوق',
financial:'🏦 المركز المالي',
partners:'🤝 الشركاء'
};

window.addEventListener(
'DOMContentLoaded',
async()=>{

const app=
document.getElementById('app');

const loader=
document.getElementById(
'global-loader'
);

try{

if(loader){
loader.classList
.remove('hidden');
}

/* بدون متغير غير مستخدم */
await ensureUser();

const isActive=
await checkSubscription();

if(loader){
loader.classList
.add('hidden');
}

if(!isActive){
app.innerHTML=`
<div class="card">
<h3>الاشتراك منتهي</h3>
<button
class="btn"
onclick="signOut()">
خروج
</button>
</div>`;
return;
}

setupNavigation();
setupSearch();

const hash=
window.location.hash
.replace('#','');

await navigate(
routes[hash]
?hash
:'dashboard'
);

}
catch(err){

console.error(
'INIT ERROR',
err
);

if(loader){
loader.classList
.add('hidden');
}

if(
err.message===
'SESSION_EXPIRED'
){
app.innerHTML=`
<div class="card">
<h3>انتهت الجلسة</h3>
<button
class="btn"
onclick="window.location.href='index.html'">
دخول
</button>
</div>`;
return;
}

app.innerHTML=`
<div class="card">
<h3>خطأ تشغيل</h3>
<p>${err.message||''}</p>
<button
class="btn"
onclick="location.reload()">
إعادة المحاولة
</button>
</div>`;

}

}
);

window.navigate=
async function(page){

const app=
document.getElementById('app');

try{

if(!routes[page]){
app.innerHTML=
'صفحة غير موجودة';
return;
}

app.innerHTML=`
<div>
<div class="skeleton skeleton-title"></div>
<div class="skeleton skeleton-card"></div>
<div class="skeleton skeleton-card"></div>
</div>`;

await routes[page](app);

app.classList
.add('fade-in');

setActive(page);
updateTitle(page);

/* إصلاح PWA */
window.location.hash=page;

/* حماية scroll */
if(app?.scrollTo){
app.scrollTo({
top:0,
behavior:'smooth'
});
}

}
catch(err){

console.error(
'NAV ERROR',
err
);

if(
err.message===
'SESSION_EXPIRED'
){
app.innerHTML=`
<div class="card">
<h3>انتهت الجلسة</h3>
<button
onclick="window.location.href='index.html'">
دخول
</button>
</div>`;
return;
}

app.innerHTML=`
<div class="card">
<h3>خطأ تحميل الصفحة</h3>
<p>${err.message||''}</p>
<button
onclick="navigate('dashboard')">
الرئيسية
</button>
</div>`;

toast(
'خطأ تحميل الصفحة',
'error'
);

}

};

function setupNavigation(){

/* منع تكرار listeners */
if(window._navInit){
return;
}
window._navInit=true;

document.querySelectorAll(
'[data-nav]'
).forEach(btn=>{
btn.addEventListener(
'click',
()=>{
const page=
btn.getAttribute(
'data-nav'
);
if(page){
navigate(page);
}
}
);
});

}

function setActive(page){
document.querySelectorAll(
'[data-nav]'
).forEach(btn=>{
btn.classList.toggle(
'active',
btn.getAttribute(
'data-nav'
)===page
);
});
}

function updateTitle(page){
const el=
document.getElementById(
'page-title'
);
if(el){
el.textContent=
PAGE_TITLES[page]
||'Market Pro';
}

document.title=
(
PAGE_TITLES[page]
||'Market Pro'
)+' – Market Pro';
}

function setupSearch(){

if(window._searchInit){
return;
}
window._searchInit=true;

const searchEl=
document.getElementById(
'global-search'
);

if(!searchEl){
return;
}

let debounce;

searchEl.addEventListener(
'input',
(e)=>{
clearTimeout(
debounce
);

debounce=setTimeout(
()=>{
const q=e.target.value.trim();
if(q.length>=2){
handleGlobalSearch(q);
}
},350);
}
);

searchEl.addEventListener(
'keydown',
e=>{
if(e.key==='Escape'){
searchEl.value='';
searchEl.blur();
}
}
);

}

async function handleGlobalSearch(q){
await navigate(
'customers'
);
if(window.filterCustomers){
window.filterCustomers(q);
}
}

window.addEventListener(
'online',
()=>{
toast(
'تم استعادة الاتصال',
'success'
);
}
);

window.addEventListener(
'offline',
()=>{
toast(
'لا يوجد اتصال',
'warning',
6000
);
}
);