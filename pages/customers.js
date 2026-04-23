import {
 supabase,
 dbInsert,
 getCustomerBalance,
 getCustomerLedger
}
from "../core/data.js";


// ===============================
// 🎯 RENDER CUSTOMERS
// ===============================

export async function renderCustomersPage(app){

 const {
  data:customers
 }=
 await supabase
 .from("customers")
 .select("*")
 .order(
  "created_at",
  {ascending:false}
 );

 app.innerHTML=`

 <div class="header">

  <h2>👥 العملاء</h2>

  <button
   onclick="
   openAddCustomer()
   "
  >

  ➕ إضافة عميل

  </button>

 </div>

 ${
 !customers?.length
 ?
 empty()
 :
 customers
 .map(renderCard)
 .join("")
 }

 `;

}



// ===============================
// 📦 CARD
// ===============================

function renderCard(c){

 return `

 <div class="card">

  <h3>
  ${
   c.full_name || c.name
  }
  </h3>

  <button
   onclick="
   openCustomer(
    '${c.id}',
    '${
      c.full_name || c.name
    }'
   )
  ">

  📂 عرض الحساب

  </button>

 </div>

 `;

}



// ===============================
// ➕ ADD CUSTOMER
// ===============================

window.openAddCustomer =
async function(){

 const name=
 prompt(
 "اسم العميل"
 );

 const phone=
 prompt(
 "الموبايل"
 );

 const opening=
 Number(
 prompt(
 "رصيد مبدئي"
 ) || 0
 );

 if(!name)
 return;

 await dbInsert(
 "customers",
 {
  full_name:name,
  phone:phone,
  opening_balance:opening
 }
 );

 navigate(
 "customers"
 );

};




// ===============================
// 📂 OPEN CUSTOMER
// ===============================

window.openCustomer=
async function(
id,
name
){

 const app=
 document
 .getElementById(
 "app"
 );

 // 🔥 من الـ ledger الحقيقي
 const ledger=
 await getCustomerLedger(
  id
 );

 // 🔥 الرصيد من view
 const balance=
 await getCustomerBalance(
  id
 );

 app.innerHTML=`

 <button
 onclick="
 navigate(
 'customers'
 )
 "
 >
 ⬅️ رجوع
 </button>

 <h2>
 ${name}
 </h2>

 <div class="card">

 ${renderLedger(
    ledger
 )}

 <hr>

 <h3>

 🔵 الرصيد الحالي:

 ${balance}

 </h3>

 </div>

 `;

};




// ===============================
// 📒 RENDER LEDGER
// ===============================

function renderLedger(
ledger
){

 if(
 !ledger?.length
 ){
  return `
  <p>
  لا توجد حركات
  </p>
  `;
 }

 return ledger
 .map(x=>`

 <div class="row">

  📅
  ${x.trx_date}

  <br>

  ${x.description}

  <br>

  مدين:
  ${x.debit}

  -

  دائن:
  ${x.credit}

  <br>

  رصيد:
  ${x.running_balance}

 </div>

 <hr>

 `)
 .join("");

}



// ===============================
// 🧩 EMPTY
// ===============================

function empty(){

 return `
 <p>
 لا يوجد عملاء
 </p>
 `;

}