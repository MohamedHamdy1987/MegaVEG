import { renderDashboard } from "./pages/dashboard.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderSuppliersPage } from "./pages/suppliers.js";

const routes = {
 dashboard: renderDashboard,
 customers: renderCustomersPage,
 suppliers: renderSuppliersPage
};

window.navigate = async function(page){

 const app =
 document.getElementById("app");

 try{

   if(!routes[page]){
     app.innerHTML="الصفحة غير مفعلة حالياً";
     return;
   }

   app.innerHTML="جار التحميل...";

   await routes[page](app);

 }

 catch(e){

   console.error(e);

   app.innerHTML="خطأ داخل الصفحة";

 }

};

window.onload = function(){

 navigate("dashboard");

};
