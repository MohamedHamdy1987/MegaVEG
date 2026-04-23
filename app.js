import { getCurrentUser } from "./core/data.js";
import { checkSubscription } from "./core/subscription.js";

import { renderDashboard } from "./pages/dashboard.js";
import { renderInvoicesPage } from "./pages/invoices.js";
import { renderSalesPage } from "./pages/sales.js";
import { renderSuppliersPage } from "./pages/suppliers.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderTarhilPage } from "./pages/tarhil.js";
import { renderKhaznaPage } from "./pages/khazna.js";
import { renderEmployeesPage } from "./pages/employees.js";
import { renderMarketShopsPage } from "./pages/market_shops.js";

const routes = {

dashboard:renderDashboard,

invoices:renderInvoicesPage,

sales:renderSalesPage,

suppliers:renderSuppliersPage,

customers:renderCustomersPage,

tarhil:renderTarhilPage,

khazna:renderKhaznaPage,

employees:renderEmployeesPage,

market_shops:renderMarketShopsPage

};


// 🔥 IMPORTANT
async function navigate(page){

const app=
document.getElementById("app");

if(!routes[page]){
app.innerHTML="صفحة غير موجودة";
return;
}

try{

app.innerHTML=
"جاري التحميل...";

await routes[page](app);

}

catch(e){

console.error(e);

app.innerHTML=
"خطأ في الصفحة";

}

}


// 🔥 force global
window.navigate=navigate;



window.onload=
async function(){

try{

const user=
await getCurrentUser();

if(!user){

console.log(
"No auth yet"
);

/* مؤقتاً لا redirect */

}

const ok=
await checkSubscription();

if(ok===false){

document
.getElementById(
"app"
)
.innerHTML=
"الاشتراك منتهي";

return;

}

navigate(
"dashboard"
);

}

catch(err){

console.error(err);

navigate(
"dashboard"
);

}

};
