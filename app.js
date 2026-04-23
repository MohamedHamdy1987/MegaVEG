import { renderDashboard } from "./pages/dashboard.js";
import { renderInvoicesPage } from "./pages/invoices.js";
import { renderSalesPage } from "./pages/sales.js";
import { renderSuppliersPage } from "./pages/suppliers.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderTarhilPage } from "./pages/tarhil.js";
import { renderKhaznaPage } from "./pages/khazna.js";
import { renderEmployeesPage } from "./pages/employees.js";
import { renderMarketShopsPage } from "./pages/market_shops.js";


const routes={

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


window.navigate=
async function(page){

const app=
document.getElementById("app");

try{

if(!routes[page]){

app.innerHTML=
"صفحة غير موجودة";

return;

}

app.innerHTML=
"جار التحميل...";

await routes[page](app);

}

catch(e){

console.error(e);

app.innerHTML=
"خطأ داخل الصفحة";

}

};


// بدون auth حالياً
window.onload=
function(){

navigate(
"dashboard"
);

};
