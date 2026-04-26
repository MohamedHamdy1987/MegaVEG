import {
supabase,
dbInsert,
addAuditLog,
ensureUser
} from "../data.js";

import {
toast,
inputModal,
formatCurrency,
formatDate
} from "../ui.js";

export async function renderPartnersPage(app){

const user=await ensureUser();

const {data:partners}=await supabase
.from('partners')
.select('*')
.eq('user_id',user.id)
.order('name');

app.innerHTML=`
<div class="page-header">
<div class="page-title">🤝 الشركاء</div>
<div class="page-actions">
<button class="btn"
onclick="openAddPartner()">
➕ إضافة شريك
</button>
</div>
</div>

<div id="partners-list">
${renderPartnerCards(partners||[])}
</div>
`;

}

function renderPartnerCards(list){

if(!list.length){
return `لا يوجد شركاء`;
}

return list.map(p=>`
<div class="card"
onclick="openPartner('${p.id}','${(p.name||'').replace(/'/g,"&#39;")}')">
<div style="display:flex;justify-content:space-between;">
<div>
<div style="font-weight:700;">🤝 ${p.name}</div>
<div>حصة ${p.profit_share||0}%</div>
</div>
<button class="btn btn-sm btn-ghost">حساب →</button>
</div>
</div>
`).join('');

}

window.openAddPartner=async function(){

inputModal({

title:'إضافة شريك',

fields:[
{id:'name',label:'الاسم',type:'text'},
{id:'profit_share',label:'نسبة الربح',type:'number'},
{id:'opening_equity',label:'رأس مال افتتاحي',type:'number'}
],

submitLabel:'حفظ',

onSubmit:async(vals)=>{

const inserted=await dbInsert(
'partners',
{
name:vals.name,
profit_share:vals.profit_share
}
);

await supabase
.from('partner_equity')
.insert({
partner_id:inserted.id,
opening_equity:vals.opening_equity||0
});

toast('تمت الإضافة','success');
navigate('partners');

}

});

};

window.openPartner=async function(id,name){

const app=document.getElementById('app');
const user=await ensureUser();

const [
{data:partner},
{data:equity},
{data:accounts},
{data:invoices},
{data:allowances},
{data:expenses}
]=await Promise.all([

supabase.from('partners')
.select('*')
.eq('id',id)
.single(),

supabase.from('partner_equity')
.select('*')
.eq('partner_id',id)
.single(),

supabase.from('partner_current_accounts')
.select('*')
.eq('partner_id',id)
.order('created_at',{ascending:false}),

supabase.from('invoices')
.select('commission')
.eq('user_id',user.id)
.eq('status','closed'),

supabase.from('customer_allowances')
.select('amount')
.eq('user_id',user.id),

supabase.from('expenses')
.select('amount,expense_type')
.eq('user_id',user.id)
.in(
'expense_type',
['general','salary','partner_cost']
)

]);

/* الربح */
const totalCommission=(invoices||[])
.reduce((s,i)=>s+Number(i.commission||0),0);

const totalAllowances=(allowances||[])
.reduce((s,a)=>s+Number(a.amount||0),0);

const totalExpenses=(expenses||[])
.reduce((s,e)=>s+Number(e.amount||0),0);

const netProfit=

totalCommission
-totalAllowances
-totalExpenses;

/* نصيب الشريك */
const sharePercent=
Number(partner?.profit_share||0);

const openingEquity=
Number(equity?.opening_equity||0);

const profitShare=
netProfit*(sharePercent/100);

const totalRights=
openingEquity+
profitShare;

/* مسحوبات */
const withdrawals=(accounts||[])
.reduce((s,a)=>
s+Number(a.withdrawal_amount||0),0);

const partnerAllow=(accounts||[])
.reduce((s,a)=>
s+Number(a.allowance||0),0);

const deductions=(accounts||[])
.reduce((s,a)=>
s+Number(a.absence_deduction||0),0);

const totalOut=
withdrawals+
partnerAllow+
deductions;

const balance=

totalRights-totalOut;

app.innerHTML=`

<button class="btn btn-ghost btn-sm"
onclick="navigate('partners')">
← رجوع
</button>

<div class="page-header">
<div class="page-title">
🤝 ${name}
</div>

<div class="page-actions">
<button class="btn"
onclick="addPartnerWithdrawal(
'${id}',
'${name}'
)">
💸 مسحوبات
</button>
</div>
</div>

<div class="kpi-grid">

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(openingEquity)}
</div>
<div class="kpi-label">
رأس المال
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(profitShare)}
</div>
<div class="kpi-label">
حصة الربح
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(totalOut)}
</div>
<div class="kpi-label">
مسحوبات
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(balance)}
</div>
<div class="kpi-label">
الرصيد المستحق
</div>
</div>

</div>

<div class="card">
<div class="card-header">
<span class="card-title">
📒 كشف حساب الشريك
</span>
</div>

${!(accounts||[]).length
?`لا توجد حركات`
:`
<div class="table-wrapper">
<table class="table">
<thead>
<tr>
<th>تاريخ</th>
<th>بيان</th>
<th>مبلغ</th>
</tr>
</thead>
<tbody>
${accounts.map(a=>`
<tr>
<td>${formatDate(a.created_at)}</td>
<td>${a.type}</td>
<td>${formatCurrency(
a.withdrawal_amount||
a.allowance||
a.absence_deduction||0
)}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
`}

</div>

<div class="card">
<div class="stat-row">
<span>إجمالي عمولات</span>
<span>${formatCurrency(totalCommission)}</span>
</div>

<div class="stat-row">
<span>قطعيات</span>
<span>(${formatCurrency(totalAllowances)})</span>
</div>

<div class="stat-row">
<span>مصاريف</span>
<span>(${formatCurrency(totalExpenses)})</span>
</div>

<hr>

<div class="stat-row">
<span>صافي الربح</span>
<span>${formatCurrency(netProfit)}</span>
</div>

</div>

`;

};

window.addPartnerWithdrawal=
async function(
partnerId,
partnerName
){

inputModal({

title:`مسحوبات ${partnerName}`,

fields:[
{
id:'amount',
label:'المبلغ',
type:'number'
}
],

submitLabel:'حفظ',

onSubmit:async(vals)=>{

/* حركة شريك */
await dbInsert(
'partner_current_accounts',
{
partner_id:partnerId,
type:'withdrawal',
withdrawal_amount:vals.amount
}
);

/* خروج من الخزنة */
await dbInsert(
'expenses',
{
description:
`سحب شريك ${partnerName}`,
amount:vals.amount,
expense_type:
'partner_withdrawal',
treasury_type:
'financial_manager',
date:
new Date().toISOString()
}
);

await addAuditLog(
'partner_withdrawal',
{
partnerId,
amount:vals.amount
}
);

toast(
'تم تسجيل المسحوبات',
'success'
);

openPartner(
partnerId,
partnerName
);

}

});

};