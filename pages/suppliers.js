import { supabase, dbInsert, ensureUser } from "../data.js";
import { toast, inputModal, formatCurrency, formatDate } from "../ui.js";

export async function renderSuppliersPage(app){
const user=await ensureUser();

const {data:suppliers}=await supabase
.from('suppliers')
.select('*')
.eq('user_id',user.id)
.order('name');

app.innerHTML=`
<div class="page-header">
<div class="page-header-left">
<div class="page-title">🚚 الموردين</div>
<div class="page-subtitle">${(suppliers||[]).length} مورد</div>
</div>
<div class="page-actions">
<button class="btn" onclick="openAddSupplier()">➕ إضافة مورد</button>
</div>
</div>

<div id="suppliers-list">
${renderSupplierCards(suppliers||[])}
</div>
`;
}

function renderSupplierCards(list){
if(!list.length){
return `
<div class="empty-state">
<div class="empty-title">لا يوجد موردين</div>
<button class="btn" onclick="openAddSupplier()">➕ إضافة مورد</button>
</div>`;
}

return list.map(s=>`
<div class="card"
style="cursor:pointer;"
onclick="openSupplier('${s.id}','${(s.name||'').replace(/'/g,"&#39;")}')">

<div style="display:flex;justify-content:space-between;">
<div>
<div style="font-weight:700;">🚚 ${s.name}</div>
${s.phone?`<div>📞 ${s.phone}</div>`:''}
</div>

<button class="btn btn-sm btn-ghost">
حساب →
</button>
</div>

</div>
`).join('');
}

window.openAddSupplier=async function(){
inputModal({
title:'إضافة مورد',
fields:[
{id:'name',label:'اسم المورد',type:'text',required:true},
{id:'phone',label:'الهاتف',type:'tel'}
],
submitLabel:'حفظ',
onSubmit:async(vals)=>{
await dbInsert('suppliers',{
name:vals.name,
});
toast('تم إضافة المورد','success');
navigate('suppliers');
}
});
};

window.openSupplier=async function(supplierId,supplierName){

const app=document.getElementById('app');
const user=await ensureUser();

const [
{data:invoices},
{data:supplierPayments}
]=await Promise.all([

supabase.from('invoices')
.select('*')
.eq('user_id',user.id)
.eq('supplier_id',supplierId)
.order('date',{ascending:false}),

supabase.from('expenses')
.select('*')
.eq('user_id',user.id)
.eq('expense_type','supplier_payment')
.eq('supplier_id',supplierId)
.order('created_at',{ascending:false})

]);

const closed=(invoices||[])
.filter(i=>i.status==='closed');

const totalOwed=closed
.reduce((s,i)=>s+Number(i.net||0),0);

const totalGross=closed
.reduce((s,i)=>s+Number(i.gross||0),0);

const totalCommission=closed
.reduce((s,i)=>s+Number(i.commission||0),0);

const paidToSupplier=(supplierPayments||[])
.reduce((s,p)=>s+Number(p.amount||0),0);

const remainingBalance=
Math.max(
0,
totalOwed-paidToSupplier
);

/* Ledger موحد */
const ledger=[];

closed.forEach(i=>{
ledger.push({
trx_date:i.date,
type:'invoice',
label:'فاتورة مصفاة',
amount:Number(i.net||0)
});
});

(supplierPayments||[]).forEach(p=>{
ledger.push({
trx_date:p.date||p.created_at,
type:'payment',
label:'دفعة للمورد',
amount:Number(p.amount||0)
});
});

ledger.sort(
(a,b)=>new Date(a.trx_date)-new Date(b.trx_date)
);

let running=0;
ledger.forEach(x=>{
if(x.type==='invoice') running+=x.amount;
if(x.type==='payment') running-=x.amount;
x.running=running;
});

app.innerHTML=`

<button class="btn btn-ghost btn-sm"
onclick="navigate('suppliers')">
← رجوع
</button>

<div class="page-header">
<div class="page-header-left">
<div class="page-title">🚚 ${supplierName}</div>
<div class="page-subtitle">كشف حساب المورد</div>
</div>

<div class="page-actions">
<button class="btn btn-sm"
onclick="openSupplierPayment(
'${supplierId}',
'${supplierName}',
${remainingBalance}
)">
💵 دفعة للمورد
</button>
</div>
</div>

<div class="kpi-grid">

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(remainingBalance)}
</div>
<div class="kpi-label">
المتبقي للمورد
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(paidToSupplier)}
</div>
<div class="kpi-label">
المدفوع للمورد
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(totalGross)}
</div>
<div class="kpi-label">
إجمالي المبيعات
</div>
</div>

<div class="kpi-card">
<div class="kpi-value">
${formatCurrency(totalCommission)}
</div>
<div class="kpi-label">
إجمالي العمولات
</div>
</div>

</div>

<div class="card">
<div class="card-header">
<span class="card-title">
📒 كشف الحساب
</span>
</div>

${!ledger.length
?`<p style="padding:20px;">لا توجد حركات</p>`
:`
<div class="table-wrapper">
<table class="table">
<thead>
<tr>
<th>التاريخ</th>
<th>البيان</th>
<th>مدين</th>
<th>دائن</th>
<th>الرصيد</th>
</tr>
</thead>
<tbody>
${ledger.map(x=>`
<tr>
<td>${formatDate(x.trx_date)}</td>
<td>${x.label}</td>
<td>
${x.type==='invoice'
?formatCurrency(x.amount)
:'—'}
</td>
<td>
${x.type==='payment'
?formatCurrency(x.amount)
:'—'}
</td>
<td style="font-weight:700;">
${formatCurrency(x.running)}
</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
`}

</div>
`;
};

window.openSupplierPayment=
async function(
supplierId,
supplierName,
remainingBalance
){

inputModal({

title:`دفعة للمورد ${supplierName}`,

fields:[
{
id:'amount',
label:'المبلغ',
type:'number',
required:true
},
{
id:'treasury_type',
label:'الخزنة',
type:'select',
options:[
{value:'financial_manager',label:'المدير المالي'},
{value:'cashier_1',label:'المحاسب 1'},
{value:'cashier_2',label:'المحاسب 2'},
{value:'cashier_3',label:'المحاسب 3'}
]
}
],

submitLabel:'دفع',

onSubmit:async(vals)=>{

const amount=Number(vals.amount||0);

/* حماية منع overpayment */
if(amount>remainingBalance){
throw new Error(
'المبلغ أكبر من المتبقي للمورد'
);
}

await dbInsert(
'expenses',
{
description:`دفعة مورد ${supplierName}`,
amount,
expense_type:'supplier_payment',
supplier_id:supplierId,
treasury_type:vals.treasury_type,
date:new Date().toISOString()
}
);

toast('تم تسجيل دفعة المورد','success');

openSupplier(
supplierId,
supplierName
);

}

});

};
