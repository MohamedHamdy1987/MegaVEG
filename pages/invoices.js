import {
supabase,
dbInsert,
dbUpdate,
confirmInvoice,
addAuditLog,
ensureUser
} from "../data.js";

import {
toast,
inputModal,
confirmModal,
formatCurrency,
formatDate
} from "../ui.js";

export async function renderInvoicesPage(app){

const user=await ensureUser();

const {data:invoices}=await supabase
.from('invoices')
.select('*')
.eq('user_id',user.id)
.order('created_at',{ascending:false});

app.innerHTML=`
<div class="page-header">
<div class="page-title">📄 الفواتير</div>
<div class="page-actions">
<button class="btn"
onclick="openCreateInvoice()">
➕ فاتورة جديدة
</button>
</div>
</div>

<div id="invoices-list">
${renderInvoiceCards(invoices||[])}
</div>
`;

window._allInvoices=invoices||[];

}

function renderInvoiceCards(list){

if(!list.length){
return `<div class="empty-state">لا توجد فواتير</div>`;
}

return list.map(inv=>`
<div class="card"
onclick="openInvoice('${inv.id}')">

<div style="display:flex;justify-content:space-between;">
<div>
<div style="font-weight:700;">
🚚 ${inv.supplier_name}
</div>

<div>
📅 ${formatDate(inv.date)}
</div>
</div>

<div>
${inv.status}
</div>
</div>

</div>
`).join('');

}

window.openCreateInvoice=async function(){

const user=await ensureUser();

const {data:suppliers}=await supabase
.from('suppliers')
.select('id,name')
.eq('user_id',user.id)
.order('name');

inputModal({

title:'فاتورة جديدة',

fields:[
{
id:'supplier_id',
label:'المورد',
type:'select',
options:suppliers.map(s=>({
value:s.id,
label:s.name
}))
},
{id:'commission_rate',label:'عمولة %',type:'number',value:7},
{id:'noulon',label:'نولون',type:'number',value:0},
{id:'mashal',label:'مشال',type:'number',value:0},
{id:'advance_payment',label:'دفعة مقدمة',type:'number',value:0}
],

submitLabel:'إنشاء',

onSubmit:async(vals)=>{

const supplier=suppliers.find(
s=>s.id===vals.supplier_id
);

await dbInsert(
'invoices',
{
supplier_id:vals.supplier_id,
supplier_name:supplier?.name,
status:'draft',
commission_rate:
Number(vals.commission_rate||7)/100,
noulon:vals.noulon||0,
mashal:vals.mashal||0,
advance_payment:vals.advance_payment||0,
date:new Date().toISOString()
}
);

toast('تم إنشاء الفاتورة','success');
navigate('invoices');

}

});

};

window.openInvoice=async function(id){

const app=document.getElementById('app');

const [
{data:invoice},
{data:products}
]=await Promise.all([

supabase
.from('invoices')
.select('*')
.eq('id',id)
.single(),

supabase
.from('invoice_products')
.select('*')
.eq('invoice_id',id)
.order('name')

]);

const isDraft=invoice.status==='draft';
const isConfirmed=invoice.status==='confirmed';
const isClosed=invoice.status==='closed';

app.innerHTML=`

<button class="btn btn-ghost btn-sm"
onclick="navigate('invoices')">
← رجوع
</button>

<div class="page-header">
<div class="page-title">
🚚 ${invoice.supplier_name}
</div>

<div class="page-actions">

${isDraft?`
<button class="btn"
onclick="confirmInvoiceUI('${id}')">
اعتماد
</button>
`:''}

${isConfirmed?`
<button class="btn btn-warning"
onclick="openSupplierReturn('${id}')">
↩️ رفع بضاعة
</button>
`:''}

${isClosed?`
<button class="btn btn-sm"
onclick="openEditCommission('${id}')">
✏️ تعديل العمولة
</button>
`:''}

</div>
</div>

<div class="card">
<div class="card-header">
<span class="card-title">
📦 الأصناف
</span>

${isDraft?`
<button class="btn btn-sm"
onclick="openAddProduct('${id}')">
➕ صنف
</button>
`:''}

</div>

${renderProductsTable(products||[])}

</div>

${isClosed?`
<div class="card">

<div>Gross:
${formatCurrency(invoice.gross||0)}
</div>

<div>Commission:
${formatCurrency(invoice.commission||0)}
</div>

<div>Net:
${formatCurrency(invoice.net||0)}
</div>

</div>
`:''}

`;

};

function renderProductsTable(products){
if(!products.length){
return 'لا توجد أصناف';
}

return `
<table class="table">
<thead>
<tr>
<th>صنف</th>
<th>كمية</th>
<th>مباع</th>
<th>رفع</th>
<th>متبقي</th>
</tr>
</thead>
<tbody>
${products.map(p=>{
const rem=
Number(p.qty)-
Number(p.sold||0)-
Number(p.returned||0);

return `
<tr>
<td>${p.name}</td>
<td>${p.qty}</td>
<td>${p.sold||0}</td>
<td>${p.returned||0}</td>
<td>${rem}</td>
</tr>
`;
}).join('')}
</tbody>
</table>
`;
}

window.confirmInvoiceUI=async function(id){
confirmModal(
'اعتماد الفاتورة؟',
async()=>{
const result=await confirmInvoice(id);
if(!result.success){
toast('فشل الاعتماد','error');
return;
}
await addAuditLog(
'confirm_invoice',
{invoiceId:id}
);
toast('تم الاعتماد','success');
openInvoice(id);
}
);
};

window.openAddProduct=async function(invoiceId){
inputModal({
title:'إضافة صنف',
fields:[
{
id:'name',
label:'اسم',
type:'text',
required:true
},
{
id:'qty',
label:'كمية',
type:'number',
required:true,
min:1
}
],
submitLabel:'حفظ',
onSubmit:async(vals)=>{
onSubmit: async(vals)=>{

const { error } = await supabase
.from('invoice_products')
.insert({
  invoice_id: invoiceId,
  name: vals.name,
  qty: vals.qty,
  sold: 0,
  returned: 0
});

if(error){
  alert(error.message);
  throw error;
}

toast('تمت الإضافة','success');
location.reload();

}
toast('تمت الإضافة','success');
openInvoice(invoiceId);
}
});
};

/* رفع بضاعة المورد */
window.openSupplierReturn=async function(invoiceId){

const {data:products}=await supabase
.from('invoice_products')
.select('*')
.eq('invoice_id',invoiceId);

inputModal({

title:'رفع بضاعة',

fields:[
{
id:'product_id',
label:'الصنف',
type:'select',
options:products.map(p=>({
value:p.id,
label:p.name
}))
},
{
id:'qty',
label:'كمية الرفع',
type:'number'
}
],

submitLabel:'حفظ',

onSubmit:async(vals)=>{

const p=products.find(
x=>x.id===vals.product_id
);

const available=
Number(p.qty)-
Number(p.sold)-
Number(p.returned||0);

if(vals.qty>available){
throw new Error(
'أكبر من المتبقي'
);
}

await dbUpdate(
'invoice_products',
p.id,
{
returned:
Number(p.returned||0)+
Number(vals.qty)
}
);

await addAuditLog(
'supplier_return',
{invoiceId,...vals}
);

toast('تم رفع البضاعة','success');
openInvoice(invoiceId);

}

});

};

/* تعديل العمولة */
window.openEditCommission=
async function(invoiceId){

const {data:inv}=await supabase
.from('invoices')
.select('*')
.eq('id',invoiceId)
.single();

inputModal({

title:'تعديل العمولة',

fields:[
{
id:'rate',
label:'نسبة العمولة %',
type:'number',
value:
Number(inv.commission_rate)*100
}
],

submitLabel:'تحديث',

onSubmit:async(vals)=>{

const rate=
Number(vals.rate)/100;

const gross=
Number(inv.gross||0);

const commission=
gross*rate;

const net=

gross
-commission
-Number(inv.noulon||0)
-Number(inv.mashal||0)
-Number(inv.advance_payment||0);

await dbUpdate(
'invoices',
invoiceId,
{
commission_rate:rate,
commission,
net
}
);

await addAuditLog(
'edit_commission',
{invoiceId,rate}
);

toast(
'تم تعديل العمولة',
'success'
);

openInvoice(invoiceId);

}

});

};
