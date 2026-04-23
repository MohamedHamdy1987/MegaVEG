import {
 supabase,
 dbInsert,
 dbUpdate
}
from "../core/data.js";


// ===============================
// 🎯 RENDER PAGE
// ===============================

export async function renderEmployeesPage(app){

 const {
  data
 }=
 await supabase
 .from("employees")
 .select("*")
 .order(
  "created_at",
  {ascending:false}
 );

 app.innerHTML=`

 <div class="header">

 <h2>
 👷 الموظفين
 </h2>

 <button
 onclick="
 openAddEmployee()
 ">

 ➕ إضافة موظف

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

function renderCard(e){

 const active=
 e.active===false
 ? false
 : true;

 return `

 <div class="card">

 <h3>
 ${e.name}
 </h3>

 <p>
 📞
 ${e.phone || "-"}
 </p>

 <p>
 👤
 ${roleLabel(
   e.role
 )}
 </p>

 <div class="actions">

 <button
 onclick="
 toggleEmployee(
 '${e.id}',
 ${active}
 )
 ">

 ${
 active
 ?
 "🚫 تعطيل"
 :
 "✅ تفعيل"
 }

 </button>


 <button
 onclick="
 changeRole(
 '${e.id}'
 )
 ">

 ✏️ تعديل الصلاحية

 </button>

 </div>

 </div>

 `;

}



// ===============================
// ➕ ADD
// ===============================

window.openAddEmployee=
async function(){

 const name=
 prompt(
 "اسم الموظف"
 );

 const phone=
 prompt(
 "الموبايل"
 );

 let role=
 prompt(
 "admin / cashier / worker",
 "worker"
 );

 if(!name)
 return;

 role=
 normalizeRole(
 role
 );

 await dbInsert(
 "employees",
 {
  name,
  phone,
  role,
  active:true
 }
 );

 navigate(
 "employees"
 );

};



// ===============================
// 🔄 TOGGLE
// ===============================

window.toggleEmployee=
async function(
id,
current
){

 await dbUpdate(
 "employees",
 id,
 {
 active:
 !current
 }
 );

 navigate(
 "employees"
 );

};




// ===============================
// ✏️ CHANGE ROLE
// ===============================

window.changeRole=
async function(id){

 let role=
 prompt(
 "admin / cashier / worker"
 );

 if(!role)
 return;

 role=
 normalizeRole(
 role
 );

 await dbUpdate(
 "employees",
 id,
 {
 role
 }
 );

 navigate(
 "employees"
 );

};




// ===============================
// 🎨 HELPERS
// ===============================

function normalizeRole(r){

 if(!r)
 return "worker";

 r=
 String(r)
 .trim()
 .toLowerCase();

 if(
 r==="admin"
 ) return "admin";

 if(
 r==="cashier"
 ) return "cashier";

 return "worker";

}



function roleLabel(r){

 if(
 r==="admin"
 )
 return "مدير";

 if(
 r==="cashier"
 )
 return "كاشير";

 return "عامل";

}



function empty(){

 return `
 <p>
 لا يوجد موظفين
 </p>
 `;

}