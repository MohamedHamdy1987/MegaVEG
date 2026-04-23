import {
 supabase,
 dbInsert
}
from "../core/data.js";


// ===============================
// 🎯 RENDER
// ===============================

export async function renderMarketShopsPage(app){

 const {
  data
 }=
 await supabase
 .from("market_shops")
 .select("*")
 .order(
  "created_at",
  {ascending:false}
 );

 app.innerHTML=`

 <div class="header">

 <h2>
 🏬 محلات السوق
 </h2>

 <button
 onclick="
 addShop()
 ">

 ➕ إضافة محل

 </button>

 </div>

 ${
 !data?.length
 ?
 empty()
 :
 data
 .map(renderCard)
 .join("")
 }

 `;

}



// ===============================
// 📦 CARD
// ===============================

function renderCard(s){

 return `

 <div class="card">

 <h3>
 ${s.name}
 </h3>

 <button
 onclick="
 openShop(
 '${s.id}',
 '${s.name}'
 )
 ">

 📂 فتح الحساب

 </button>

 </div>

 `;

}



// ===============================
// ➕ ADD SHOP
// ===============================

window.addShop=
async function(){

 const name=
 prompt(
 "اسم المحل"
 );

 if(!name)
 return;

 await dbInsert(
 "market_shops",
 {
 name
 }
 );

 navigate(
 "market_shops"
 );

};




// ===============================
// 📂 OPEN SHOP
// ===============================

window.openShop=
async function(
id,
name
){

 const app=
 document
 .getElementById(
 "app"
 );

 const {
  data:credits
 }=
 await supabase
 .from(
 "shop_credits"
 )
 .select("*")
 .eq(
 "shop_id",
 id
 );

 const {
  data:debits
 }=
 await supabase
 .from(
 "shop_debits"
 )
 .select("*")
 .eq(
 "shop_id",
 id
 );

 const totalCredit=
 sum(
 credits,
 "amount"
 );

 const totalDebit=
 sum(
 debits,
 "total"
 );

 const balance=
 totalCredit-
 totalDebit;

 app.innerHTML=`

 <button
 onclick="
 navigate(
 'market_shops'
 )
 ">

 ⬅️ رجوع

 </button>

 <h2>
 ${name}
 </h2>


 <div class="grid">

 <div class="card">

 <h3>
 🟢 لنا
 </h3>

 ${
 renderCredits(
 credits
 )
 }

 <h4>
 الإجمالي:
 ${totalCredit}
 </h4>

 </div>


 <div class="card">

 <h3>
 🔴 لهم
 </h3>

 <button
 class="btn"
 onclick="
 addDebit(
 '${id}'
 )
 ">

 ➕ إضافة

 </button>

 ${
 renderDebits(
 debits
 )
 }

 <h4>

 الإجمالي:
 ${totalDebit}

 </h4>

 </div>

 </div>


 <hr>

 <h2>

 💰 الفرق:
 ${balance}

 </h2>

 `;

};




// ===============================
// ➕ ADD DEBIT
// ===============================

window.addDebit=
async function(shopId){

 const product=
 prompt(
 "الصنف"
 );

 const qty=
 Number(
 prompt(
 "العدد"
 )
 );

 const price=
 Number(
 prompt(
 "السعر"
 )
 );

 if(
 !product ||
 !qty ||
 !price
 ) return;


 const type=
 prompt(
 "cash / credit"
 );


 let customerId=null;
 let customerName=null;


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

 return;
 }

 customerId=
 customer.id;

 }


 const total=
 qty*price;

 const today=
 new Date()
 .toISOString()
 .split("T")[0];


 // تسجيل علينا
 await dbInsert(
 "shop_debits",
 {

 shop_id:
 shopId,

 product_name:
 product,

 qty,
 price,
 total,

 customer_id:
 customerId,

 customer_name:
 customerName,

 type

 }
 );


 // لو آجل
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
 product+
 " (من محل)",

 qty,
 price,
 total,

 date:
 today

 });

 }

 openShop(
 shopId
 );

};




// ===============================
// 📋 RENDER
// ===============================

function renderCredits(
list
){

 if(
 !list?.length
 ){

 return `
 <p>
 لا يوجد
 </p>
 `;
 }

 return list.map(x=>`

 <div class="row">

 💰
 ${x.amount}

 </div>

 `)
 .join("");

}



function renderDebits(
list
){

 if(
 !list?.length
 ){

 return `
 <p>
 لا يوجد
 </p>
 `;
 }

 return list.map(x=>`

 <div class="row">

 ${x.product_name}

 -

 ${x.total}

 </div>

 `)
 .join("");

}



function sum(
arr,
key
){

 return arr.reduce(

 (s,x)=>

 s+
 Number(
 x[key]||0
 ),

 0

 );

}



function empty(){

 return `
 <p>
 لا يوجد محلات
 </p>
 `;

}