import { supabase, ensureUser } from "../data.js";
import { formatCurrency, formatDate } from "../ui.js";

export async function renderTarhilPage(app){

const user=await ensureUser();

app.innerHTML=`
<div class='page-header'>
<div class='page-header-left'>
<div class='page-title'>📋 دفتر الترحيلات</div>
<div class='page-subtitle'>كشف حساب العملاء</div>
</div>
<div class='page-actions'>
<button class='btn btn-ghost btn-sm' onclick='window.print()'>🖨️ طباعة</button>
</div>
</div>

<div id='tarhil-content'>
<div class='skeleton skeleton-card'></div>
</div>`;

const {data,error}=await supabase
.from('customer_ledger')
.select('*')
.eq('user_id',user.id)
.order('customer_name',{ascending:true})
.order('trx_date',{ascending:true});

const container=document.getElementById('tarhil-content');

if(error){
container.innerHTML=`
<div class='card'>
⚠️ ${error.message}
</div>`;
return;
}

if(!data?.length){
container.innerHTML=`
<div class='empty-state'>
<div class='empty-title'>لا توجد ترحيلات</div>
</div>`;
return;
}

const grouped=groupByCustomer(data);
const ids=Object.keys(grouped);

const grandDebit=ids.reduce((s,id)=>s+grouped[id].debit,0);
const grandCredit=ids.reduce((s,id)=>s+grouped[id].credit,0);
const grandBalance=ids.reduce((s,id)=>s+grouped[id].balance,0);

const debtorsCount=ids.filter(id=>grouped[id].balance>0).length;

const doubtfulCount=ids.filter(
id=>grouped[id].balance>5000
).length;

container.innerHTML=`

<div class='kpi-grid'>

<div class='kpi-card'>
<div class='kpi-value'>${formatCurrency(grandDebit)}</div>
<div class='kpi-label'>إجمالي المدين</div>
</div>

<div class='kpi-card'>
<div class='kpi-value'>${formatCurrency(grandCredit)}</div>
<div class='kpi-label'>إجمالي الدائن</div>
</div>

<div class='kpi-card'>
<div class='kpi-value'>${formatCurrency(Math.abs(grandBalance))}</div>
<div class='kpi-label'>صافي الذمم</div>
</div>

<div class='kpi-card'>
<div class='kpi-value'>${debtorsCount}</div>
<div class='kpi-label'>عملاء مدينون</div>
</div>

<div class='kpi-card'>
<div class='kpi-value'>${doubtfulCount}</div>
<div class='kpi-label'>ذمم مشكوك فيها</div>
</div>

</div>

${ids.map(id=>renderCustomerSection(grouped[id])).join('')}

`;
}

function groupByCustomer(rows=[]){

const map={};

rows.forEach(r=>{

if(!r.customer_id) return;

if(!map[r.customer_id]){
map[r.customer_id]={
id:r.customer_id,
name:r.customer_name||'عميل',
debit:0,
credit:0,
balance:0,
items:[]
};
}

map[r.customer_id].debit += Number(r.debit||0);
map[r.customer_id].credit += Number(r.credit||0);
map[r.customer_id].items.push(r);

});

Object.values(map).forEach(c=>{

// تعديل جوهري:
// بدل آخر running_balance
c.balance=
Number(c.debit||0)-Number(c.credit||0);

});

return Object.fromEntries(
Object.entries(map).sort((a,b)=>{

let A=a[1].balance;
let B=b[1].balance;

if(A>0 && B<=0) return -1;
if(A<=0 && B>0) return 1;

return B-A;

})
);
}

function renderCustomerSection(g){

const highRisk=g.balance>5000;

const balColor=
g.balance>0
?'#f87171'
:g.balance<0
?'#4ade80'
:'gray';

const balLabel=
g.balance>0
?'مدين'
:g.balance<0
?'دائن'
:'سوي';

return `
<div class='card'
style='
margin-bottom:16px;
${highRisk?
'border:2px solid rgba(239,68,68,.4);':''}
'>

<div style='display:flex;justify-content:space-between;'>
<div>
<div style='font-weight:800;'>👤 ${g.name}</div>
<div>${g.items.length} حركة</div>
${highRisk?
"<span class='badge badge-red'>⚠ عالي المخاطر</span>"
:''}
</div>

<div style='text-align:left;'>
<div style='font-size:20px;color:${balColor}'>
${formatCurrency(Math.abs(g.balance))}
</div>
<div>${balLabel}</div>
</div>
</div>

<div class='table-wrapper table-desktop'>
<table class='table'>
<thead>
<tr>
<th>تاريخ</th>
<th>بيان</th>
<th>مدين</th>
<th>دائن</th>
</tr>
</thead>
<tbody>

${g.items.map(i=>`
<tr>
<td>${formatDate(i.trx_date)}</td>
<td>${i.description||'-'}</td>
<td>
${i.debit>0?
formatCurrency(i.debit):'-'}
</td>
<td>
${i.credit>0?
formatCurrency(i.credit):'-'}
</td>
</tr>
`).join('')}

</tbody>
</table>
</div>

<div class='mobile-card-list'>
${g.items.map(i=>`
<div class='row' style='justify-content:space-between;'>
<span>${i.description||'-'}</span>
<span>
${i.debit>0?
'+'+formatCurrency(i.debit)
:'-'+formatCurrency(i.credit)}
</span>
</div>
`).join('')}
</div>

<div style='display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;'>
<div>
<div>مدين</div>
<div>${formatCurrency(g.debit)}</div>
</div>
<div>
<div>دائن</div>
<div>${formatCurrency(g.credit)}</div>
</div>
<div>
<div>رصيد</div>
<div style='color:${balColor};font-weight:800'>
${formatCurrency(Math.abs(g.balance))}
</div>
</div>
</div>

</div>`;

}