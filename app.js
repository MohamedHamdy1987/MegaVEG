window.navigate = function(page){

const app =
document.getElementById("app");

const pages = {

dashboard:"<h2>الرئيسية تعمل</h2>",

customers:"<h2>صفحة العملاء تعمل</h2>",

suppliers:"<h2>صفحة الموردين تعمل</h2>",

sales:"<h2>صفحة المبيعات تعمل</h2>",

invoices:"<h2>صفحة الفواتير تعمل</h2>",

tarhil:"<h2>صفحة الترحيلات تعمل</h2>",

khazna:"<h2>صفحة الخزنة تعمل</h2>",

market_shops:"<h2>صفحة محلات السوق تعمل</h2>",

employees:"<h2>صفحة الموظفين تعمل</h2>"

};

app.innerHTML =
pages[page] || "صفحة غير موجودة";

};

window.onload = function(){

navigate("dashboard");

};
