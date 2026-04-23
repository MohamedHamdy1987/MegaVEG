import {
 supabase,
 dbInsert,
 dbUpdate,
 confirmInvoice
}
from "../core/data.js";


// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderInvoicesPage(app){

 const {
  data: invoices
 }=
 await supabase
 .from("invoices")
 .select("*")
 .order(
  "created_at",
  {ascending:false}
 );

 app.innerHTML=`

 <div class="header">

 <h2>
 📄 الفواتير
 </h2>

 <button
 class="btn btn-primary"
 onclick="
 openCreateInvoice()
 ">

 ➕ فاتورة جديدة

 </button>

 </div>

 ${
 !invoices?.length
 ?
 empty()
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

 <p>
 الحالة:
 ${inv.status}
 </p>

 <button
 onclick="
 openInvoice(
 '${inv.id}'
 )
 ">

 📂 فتح

 </button>

 </div>

 `;

}



// ===============================
// ➕ CREATE
// ===============================

window.openCreateInvoice=
async function(){

 const name=
 prompt(
 "اسم المورد"
 );

 if(!name)
 return;

 const {
  data:supplier
 }=
 await supabase
 .from("suppliers")
 .select("*")
 .eq("name",name)
 .single();

 if(!supplier){

  alert(
  "المورد غير موجود"
  );

  return;
 }

 await dbInsert(
 "invoices",
 {
  supplier_id:
  supplier.id,

  supplier_name:
  supplier.name,

  date:
  new Date()
  .toISOString()
  .split("T")[0],

  status:"draft",

  noulon:0,
  mashal:0,
  advance_payment:0
 }
 );

 alert(
 "تم إنشاء الفاتورة"
 );

 navigate(
 "invoices"
 );

};



// ===============================
// 📂 OPEN INVOICE
// ===============================

window.openInvoice=
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
 'invoices'
 )
 ">

 ⬅️ رجوع

 </button>

 <h2>
 فاتورة:
 ${invoice.supplier_name}
 </h2>

 <div class="grid">

 <input
 id="noulon"
 value="${
 invoice.noulon
 }"
 placeholder="نولون"
 >

 <input
 id="mashal"
 value="${
 invoice.mashal
 }"
 placeholder="مشال"
 >

 <input
 id="advance"
 value="${
 invoice.advance_payment
 }"
 placeholder="دفعة"
 >

 <button
 onclick="
 saveExpenses(
 '${id}'
 )
 ">

 💾 حفظ

 </button>

 </div>


 <button
 class="btn"
 onclick="
 openAddProduct(
 '${id}'
 )
 ">

 ➕ إضافة صنف

 </button>


 ${
 renderProducts(
 products
 )
 }


 ${
 invoice.status !==
 "confirmed"
 ?

 `
 <hr>

 <button
 class="btn"
 onclick="
 confirmInvoiceUI(
 '${id}'
 )
 ">

 ✅ اعتماد الفاتورة

 </button>
 `
 :

 `
 <h3>
 ✔ تم الاعتماد
 </h3>
 `
 }

 `;

};



// ===============================
// 💰 SAVE EXPENSES
// ===============================

window.saveExpenses=
async function(id){

 const noulon=
 Number(
 document
 .getElementById(
 "noulon"
 ).value
 );

 const mashal=
 Number(
 document
 .getElementById(
 "mashal"
 ).value
 );

 const advance=
 Number(
 document
 .getElementById(
 "advance"
 ).value
 );

 await dbUpdate(
 "invoices",
 id,
 {
  noulon,
  mashal,
  advance_payment:
  advance
 }
 );

 alert(
 "تم الحفظ"
 );

};




// ===============================
// ✅ CONFIRM
// ===============================

window.confirmInvoiceUI=
async function(id){

 const ok=
 confirm(
 "تأكيد اعتماد الفاتورة؟"
 );

 if(!ok)
 return;

 const done=
 await confirmInvoice(
 id
 );

 if(!done){

  alert(
  "فشل الاعتماد"
  );

  return;
 }

 alert(
 "تم الترحيل والاعتماد"
 );

 openInvoice(id);

};




// ===============================
// ➕ ADD PRODUCT
// ===============================

window.openAddProduct=
function(invoiceId){

 const name=
 prompt("اسم الصنف");

 const qty=
 Number(
 prompt("العدد")
 );

 const unit=
 prompt("الوحدة");

 if(
 !name ||
 !qty
 ) return;

 addProduct(
 invoiceId,
 name,
 qty,
 unit
 );

};



async function addProduct(
invoiceId,
name,
qty,
unit
){

 await supabase
 .from(
 "invoice_products"
 )
 .insert({

 invoice_id:
 invoiceId,

 name,
 qty,
 unit,

 sold:0,
 returned:0

 });

 alert(
 "تم إضافة الصنف"
 );

 openInvoice(
 invoiceId
 );

}




// ===============================
// 📦 PRODUCTS
// ===============================

function renderProducts(
products
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
 <th>كمية</th>
 <th>مباع</th>
 <th>متبقي</th>
 </tr>

 </thead>

 <tbody>

 ${
 products.map(p=>`

 <tr>

 <td>
 ${p.name}
 </td>

 <td>
 ${p.qty}
 </td>

 <td>
 ${p.sold}
 </td>

 <td>
 ${
 p.qty-
 p.sold-
 p.returned
 }
 </td>

 </tr>

 `)
 .join("")
 }

 </tbody>

 </table>

 `;

}



// ===============================
// 🧩 EMPTY
// ===============================

function empty(
msg="لا يوجد بيانات"
){

 return `
 <p>
 ${msg}
 </p>
 `;

}