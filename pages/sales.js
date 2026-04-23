import {
 supabase,
 dbUpdate
}
from "../core/data.js";


// ===============================
// 🔒 ANTI DOUBLE CLICK
// ===============================

let saleLock=false;


// ===============================
// 🎯 RENDER SALES PAGE
// ===============================

export async function renderSalesPage(app){

 const {
  data:invoices
 }=
 await supabase
 .from("invoices")
 .select("*")
 .neq(
  "status",
  "closed"
 )
 .order(
  "created_at",
  {ascending:false}
 );

 app.innerHTML=`

 <div class="header">
 <h2>
 🛒 المبيعات
 </h2>
 </div>

 ${
 !invoices?.length
 ?
 empty(
 "لا توجد فواتير"
 )
 :
 invoices
 .map(renderCard)
 .join("")
 }

 `;

}



// ===============================
// 📦 CARD
// ===============================

function renderCard(inv){

 return `

 <div class="card">

 <h3>
 ${inv.supplier_name}
 </h3>

 <p>
 📅 ${inv.date}
 </p>

 <button
 onclick="
 openSalesInvoice(
 '${inv.id}'
 )
 ">

 بيع

 </button>

 </div>

 `;

}



// ===============================
// 📂 OPEN INVOICE
// ===============================

window.openSalesInvoice=
async function(id){

 const app=
 document
 .getElementById(
 "app"
 );

 const {
  data:invoice
 }=
 await supabase
 .from("invoices")
 .select("*")
 .eq("id",id)
 .single();

 const {
  data:products
 }=
 await supabase
 .from(
 "invoice_products"
 )
 .select("*")
 .eq(
 "invoice_id",
 id
 );

 app.innerHTML=`

 <button
 onclick="
 navigate(
 'sales'
 )
 ">

 ⬅️ رجوع

 </button>

 <h2>
 بيع من:
 ${invoice.supplier_name}
 </h2>

 ${
 renderProducts(
 products,
 id
 )
 }

 `;

};




// ===============================
// 📦 PRODUCTS
// ===============================

function renderProducts(
products,
invoiceId
){

 if(
 !products?.length
 ){
 return empty(
 "لا توجد أصناف"
 );
 }

 return `

 <table class="table">

 <thead>

 <tr>
 <th>الصنف</th>
 <th>المتبقي</th>
 <th>بيع</th>
 </tr>

 </thead>

 <tbody>

 ${
 products.map(p=>{

 const remain=
 p.qty-
 p.sold-
 p.returned;

 return `

 <tr>

 <td>
 ${p.name}
 </td>

 <td>
 ${remain}
 </td>

 <td>

 <button
 onclick="
 sellProduct(
 '${p.id}',
 '${invoiceId}'
 )
 ">

 بيع

 </button>

 </td>

 </tr>

 `;

 }).join("")
 }

 </tbody>

 </table>

 `;

}



// ===============================
// 💰 SELL
// ===============================

window.sellProduct=
async function(
productId,
invoiceId
){

 if(saleLock){
  alert(
  "جار تنفيذ العملية"
  );
  return;
 }

 saleLock=true;

 try{

 const qty=
 Number(
 prompt("الكمية")
 );

 const price=
 Number(
 prompt("السعر")
 );

 if(
 !qty ||
 qty<=0
 ){
 saleLock=false;
 return;
 }

 // 🔥 إعادة قراءة المتاح
 const {
  data:product
 }=
 await supabase
 .from(
 "invoice_products"
 )
 .select("*")
 .eq(
 "id",
 productId
 )
 .single();

 const available=
 product.qty-
 product.sold-
 product.returned;

 if(
 qty > available
 ){

 alert(
 "أكبر من المتاح"
 );

 saleLock=false;

 return;
 }

 const type=
 prompt(
 "cash / credit / shop"
 );

 let customerId=null;
 let customerName=null;
 let shopId=null;


 // 👤 آجل
 if(
 type==="credit"
 ){

 customerName=
 prompt(
 "اسم العميل"
 );

 const {
  data:customer
 }=
 await supabase
 .from("customers")
 .select("*")
 .eq(
 "full_name",
 customerName
 )
 .single();

 if(!customer){

  alert(
  "عميل غير موجود"
  );

  saleLock=false;
  return;
 }

 customerId=
 customer.id;

 }


 // 🏬 محل
 if(
 type==="shop"
 ){

 const shopName=
 prompt(
 "اسم المحل"
 );

 const {
 data:shop
 }=
 await supabase
 .from(
 "market_shops"
 )
 .select("*")
 .eq(
 "name",
 shopName
 )
 .single();

 if(!shop){

  alert(
  "محل غير موجود"
  );

  saleLock=false;
  return;
 }

 shopId=
 shop.id;

 }



 await processSale(
 product,
 invoiceId,
 qty,
 price,
 type,
 customerId,
 customerName,
 shopId
 );

 alert(
 "تم البيع"
 );

 openSalesInvoice(
 invoiceId
 );

 }

 finally{

 saleLock=false;

 }

};




// ===============================
// ⚙️ PROCESS
// ===============================

async function processSale(
product,
invoiceId,
qty,
price,
type,
customerId,
customerName,
shopId
){

 const total=
 qty*price;

 // 1
 await supabase
 .from("sales")
 .insert({

 product_id:
 product.id,

 invoice_id:
 invoiceId,

 qty,
 price,
 total,

 type,

 customer_id:
 customerId,

 shop_id:
 shopId

 });


 // 2
 await dbUpdate(
 "invoice_products",
 product.id,
 {
 sold:
 product.sold+qty,

 sales_total:
 (
 product.sales_total
 ||0
 )+total
 }
 );


 const today=
 new Date()
 .toISOString()
 .split("T")[0];


 // 👤 ترحيل عميل
 if(
 type==="credit"
 ){

 await supabase
 .from(
 "daily_sales"
 )
 .insert({

 customer_id:
 customerId,

 customer_name:
 customerName,

 product_name:
 product.name,

 qty,
 price,
 total,

 invoice_id:
 invoiceId,

 date:
 today

 });

 }


 // 🏬 ترحيل محل
 if(
 type==="shop"
 ){

 await supabase
 .from(
 "shop_credits"
 )
 .insert({

 shop_id:
 shopId,

 amount:
 total,

 date:
 today,

 source:
 "sale"

 });

 }


 await checkInvoiceClose(
 invoiceId
 );

}



// ===============================
// 🔒 CLOSE INVOICE
// ===============================

async function checkInvoiceClose(
invoiceId
){

 const {
  data:products
 }=
 await supabase
 .from(
 "invoice_products"
 )
 .select("*")
 .eq(
 "invoice_id",
 invoiceId
 );

 const allDone=
 products.every(p=>{

 const rem=
 p.qty-
 p.sold-
 p.returned;

 return rem<=0;

 });

 if(!allDone)
 return;

 let gross=0;

 products.forEach(p=>{

 gross+=
 p.override_total
 ??
 p.sales_total
 ??
 0;

 });

 const {
  data:invoice
 }=
 await supabase
 .from("invoices")
 .select("*")
 .eq(
 "id",
 invoiceId
 )
 .single();

 const commission=
 gross*
 (
 invoice
 .commission_rate
 ||0.07
 );

 const expenses=
 commission+
 invoice.noulon+
 invoice.mashal;

 const net=
 gross-
 expenses-
 invoice
 .advance_payment;


 await dbUpdate(
 "invoices",
 invoiceId,
 {
 status:"closed",
 gross,
 total_expenses:
 expenses,
 net
 }
 );

}



// ===============================
// 🧩 EMPTY
// ===============================

function empty(msg){

 return `
 <p>
 ${msg}
 </p>
 `;

}