import {
supabase,
dbInsert,
getCustomerLedger,
addAuditLog,
ensureUser
} from '../data.js';

import {
toast,
inputModal,
formatCurrency,
formatDate
} from '../ui.js';

export async function renderCustomersPage(app){

const user=
await ensureUser();

const [
{data:customers},
{data:balances}
]=await Promise.all([

supabase
.from('customers')
.select('*')
.eq('user_id',user.id)
.order('full_name'),

supabase
.from('customer_balances')
.select('customer_id,balance')
.eq('user_id',user.id)

]);

const balMap={};
(balances||[])
.forEach(b=>{
balMap[
b.customer_id
]=b.balance;
});

const totalReceivables=
Object.values(
balMap
)
.filter(v=>v>0)
.reduce((s,v)=>s+v,0);

app.innerHTML=`
<div class="page-header">
<div class="page-title">
👥 العملاء
</div>
<div class="page-subtitle">
${(customers||[]).length}
عميل
• ذمم
${formatCurrency(totalReceivables)}
</div>
<button
class="btn"
onclick="openAddCustomer()">
إضافة عميل
</button>
</div>

<input
id="cust-search"
type="search"
placeholder="بحث"
oninput="filterCustomers(this.value)">

<div id="customers-list">
${renderCustomerCards(
customers||[],
balMap
)}
</div>`;

window._allCustomers=
customers||[];
window._balMap=balMap;

}

function renderCustomerCards(
list,
balMap
){

if(!list.length){
return 'لا يوجد عملاء';
}

return list.map(c=>{

const bal=
balMap[c.id]||0;

return `
<div class="card"
onclick="openCustomer(
'${c.id}',
'${(c.full_name||'').replace(/'/g,'&#39;')}'
)">
<div>
${c.full_name}
</div>
<div>
${formatCurrency(
Math.abs(bal)
)}
</div>
</div>`;

}).join('');

}

window.filterCustomers=
function(q){

const list=
window._allCustomers||[];

q=(q||'')
.toLowerCase();

const filtered=q
?list.filter(c=>
(c.full_name||'')
.toLowerCase()
.includes(q)
||
(c.phone||'')
.includes(q)
)
:list;

document
.getElementById(
'customers-list'
)
.innerHTML=
renderCustomerCards(
filtered,
window._balMap||{}
);

};

window.openAddCustomer=
async function(){

inputModal({

title:'إضافة عميل',

fields:[
{
id:'full_name',
label:'الاسم',
required:true
},
{
id:'phone',
label:'هاتف'
},
{
id:'opening_balance',
label:'رصيد مبدئي',
type:'number',
value:0
}
],

onSubmit:
async(vals)=>{

const inserted=
await dbInsert(
'customers',
{
full_name:
vals.full_name,
phone:
vals.phone||null,
opening_balance:
vals.opening_balance||0
}
);

if(!inserted){
throw new Error(
'فشل إضافة العميل'
);
}

closeModal();

toast(
'تمت الإضافة',
'success'
);

navigate(
'customers'
);

}

});

};

window.openCustomer=
async function(id,name){

const app=
document.getElementById(
'app'
);

/* إزالة dynamic import */
const [
ledger,
{data:custBal}
]=await Promise.all([
getCustomerLedger(id),
supabase
.from(
'customer_balances'
)
.select('*')
.eq(
'customer_id',
id
)
.single()
]);

const bal=
custBal?.balance||0;

app.innerHTML=`
<button
onclick="navigate('customers')">
رجوع
</button>

<h3>
${name}
</h3>

<button
onclick="recordCollection(
'${id}',
'${name}'
)">
تحصيل
</button>

<button
onclick="recordAllowance(
'${id}',
'${name}'
)">
قطعية
</button>

<div class="card">
الرصيد:
${formatCurrency(
Math.abs(bal)
)}
</div>

<div class="card">
${(ledger||[]).map(x=>`
<div>
${x.description||''}
-
${formatCurrency(
x.running_balance||0
)}
</div>`).join('')}
</div>`;

};

/* التحصيل + القطعية */
window.recordCollection=
async function(
customerId,
customerName
){

inputModal({

title:
'تسجيل تحصيل',

fields:[
{
id:'amount',
label:'مبلغ التحصيل',
type:'number',
required:true
},
{
id:'allowance',
label:'قطعية (اختياري)',
type:'number',
value:0
}
],

onSubmit:
async(vals)=>{

const amount=
Number(vals.amount||0);

const allowance=
Number(vals.allowance||0);

const inserted=
await dbInsert(
'collections',
{
customer_id:
customerId,
amount,
date:
new Date()
.toISOString()
}
);

if(!inserted){
throw new Error(
'فشل التحصيل'
);
}

/* القطعية مستقلة */
if(
allowance>0
){

await dbInsert(
'customer_allowances',
{
customer_id:
customerId,
amount:
allowance,
reason:
'قطعية تحصيل',
date:
new Date()
.toISOString()
}
);

await addAuditLog(
'customer_allowance',
{
customerId,
allowance
}
);

}

await addAuditLog(
'collection',
{
customerId,
amount
}
);

closeModal();

toast(
'تم التحصيل',
'success'
);

openCustomer(
customerId,
customerName
);

}

});

};

window.recordAllowance=
async function(
customerId,
customerName
){

inputModal({

title:'قطعية',

fields:[
{
id:'amount',
label:'المبلغ',
type:'number',
required:true
},
{
id:'reason',
label:'السبب'
}
],

onSubmit:
async(vals)=>{

await dbInsert(
'customer_allowances',
{
customer_id:
customerId,
amount:
vals.amount,
reason:
vals.reason||
'تسوية'
}
);

await addAuditLog(
'customer_allowance',
{
customerId,
amount:
vals.amount
}
);

closeModal();

openCustomer(
customerId,
customerName
);

}

});

};

window.showAgingReport=
async function(){

const user=
await ensureUser();

/* إصلاح join */
const {data:balances}=
await supabase
.from(
'customer_balances'
)
.select(`
customer_id,
balance,
customers(full_name)
`)
.eq(
'user_id',
user.id
)
.gt(
'balance',0
);

console.log(
balances
);

};