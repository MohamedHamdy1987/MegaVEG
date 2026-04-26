import { supabase, dbInsert, addAuditLog, ensureUser } from "../data.js";
import { toast, inputModal, formatCurrency, formatDate } from "../ui.js";

export async function renderKhaznaPage(app) {
  const user = await ensureUser();

  const [
    { data: collections },
    { data: expenses },
    { data: treasuries },
    { data: handovers }
  ] = await Promise.all([
    supabase.from("collections")
      .select("*,customers(full_name)")
      .eq("user_id", user.id)
      .order("created_at",{ascending:false}),

    supabase.from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at",{ascending:false}),

    supabase.from("treasury_accounts")
      .select("*")
      .eq("user_id",user.id)
      .order("treasury_type"),

    supabase.from("cash_handover_requests")
      .select("*")
      .eq("user_id",user.id)
      .eq("status","pending")
      .order("requested_at",{ascending:false})
  ]);

  const cashIn  = (collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);
  const cashOut = (expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const net     = cashIn - cashOut;

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">💰 الخزنة</div>
        <div class="page-subtitle">الخزنة الرئيسية + خزن المحاسبين</div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openAddCollection()">➕ تحصيل</button>
        <button class="btn btn-danger" onclick="openAddExpense()">➖ مصروف</button>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:var(--sp-6);">
      <div class="kpi-card" style="--kpi-color:#4ade80">
        <span class="kpi-icon">📥</span>
        <div class="kpi-value" style="color:#4ade80">${formatCurrency(cashIn)}</div>
        <div class="kpi-label">إجمالي التحصيلات</div>
      </div>

      <div class="kpi-card" style="--kpi-color:#f87171">
        <span class="kpi-icon">📤</span>
        <div class="kpi-value" style="color:#f87171">${formatCurrency(cashOut)}</div>
        <div class="kpi-label">إجمالي المصروفات</div>
      </div>

      <div class="kpi-card" style="--kpi-color:${net>=0?'#14b8a6':'#f87171'}">
        <span class="kpi-icon">💎</span>
        <div class="kpi-value" style="color:${net>=0?'#14b8a6':'#f87171'}">${formatCurrency(net)}</div>
        <div class="kpi-label">صافي الخزنة العامة</div>
      </div>
    </div>

    ${renderTreasuryTabs(treasuries||[], handovers||[])}

    <div class="grid-2" style="gap:var(--sp-4);">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📥 التحصيلات (${(collections||[]).length})</span>
        </div>
        ${renderCollections(collections||[])}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📤 المصروفات (${(expenses||[]).length})</span>
        </div>
        ${renderExpenses(expenses||[])}
      </div>
    </div>
  `;
}

function renderTreasuryTabs(list, handovers){
  if(!list.length) return '';

  return `
  <div class="card" style="margin-bottom:var(--sp-5);">
    <div class="card-header">
      <span class="card-title">🏦 الخزن التشغيلية</span>
    </div>

    <div class="grid-2">
      ${list.map(t=>`
        <div class="card">
          <div style="font-weight:800;font-size:16px;">${t.name}</div>
          <div style="margin-top:8px;">💵 كاش: ${formatCurrency(t.cash_balance||0)}</div>
          <div>📲 فودافون: ${formatCurrency(t.vodafone_balance||0)}</div>

          ${t.treasury_type !== 'financial_manager' ? `
            <button class="btn btn-sm" onclick="requestCashHandover('${t.id}')">
            📤 تسليم للمدير
            </button>
          `:''}
        </div>
      `).join('')}
    </div>

    ${handovers.length ? `
      <hr>
      <h4>طلبات التسليم المعلقة</h4>
      ${handovers.map(r=>`
        <div class="row" style="justify-content:space-between;">
          <span>
          طلب تسليم ${formatCurrency(r.cash_amount||0)}
          </span>

          <button class="btn btn-sm btn-success"
          onclick="approveCashHandover('${r.id}')">
          ✅ اعتماد
          </button>
        </div>
      `).join('')}
    `:''}

  </div>
  `;
}

function renderCollections(list){
if(!list.length) return `<p style="padding:20px;text-align:center;">لا توجد تحصيلات</p>`;
return `
<div class="table-wrapper table-desktop">
<table class="table">
<thead>
<tr>
<th>التاريخ</th>
<th>العميل</th>
<th>المبلغ</th>
</tr>
</thead>
<tbody>
${list.map(x=>`
<tr>
<td>${formatDate(x.date||x.created_at)}</td>
<td>${x.customers?.full_name||'-'}</td>
<td style="color:#4ade80;font-weight:700;">${formatCurrency(x.amount)}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>`;
}

function renderExpenses(list){
if(!list.length) return `<p style="padding:20px;text-align:center;">لا توجد مصروفات</p>`;
return `
<div class="table-wrapper table-desktop">
<table class="table">
<thead>
<tr>
<th>التاريخ</th>
<th>الوصف</th>
<th>النوع</th>
<th>المبلغ</th>
</tr>
</thead>
<tbody>
${list.map(x=>`
<tr>
<td>${formatDate(x.date||x.created_at)}</td>
<td>${x.description||'-'}</td>
<td>${x.expense_type||'general'}</td>
<td style="color:#f87171;font-weight:700;">${formatCurrency(x.amount)}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>`;
}

window.openAddCollection=async function(){
const user=await ensureUser();

const {data:customers}=await supabase
.from('customers')
.select('id,full_name')
.eq('user_id',user.id)
.order('full_name');

inputModal({
title:'تسجيل تحصيل',
fields:[
{
id:'customer_id',
label:'العميل',
type:'select',
required:true,
options:(customers||[]).map(c=>({value:c.id,label:c.full_name}))
},
{
id:'amount',
label:'المبلغ',
type:'number',
required:true
},
{
id:'treasury_id',
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
submitLabel:'حفظ',
onSubmit:async(vals)=>{
await dbInsert('collections',{
customer_id:vals.customer_id,
amount:vals.amount,
treasury_type:vals.treasury_id,
date:new Date().toISOString()
});
await addAuditLog('collection',vals);
toast('تم تسجيل التحصيل','success');
navigate('khazna');
}
});
};

window.openAddExpense=async function(){
inputModal({
title:'تسجيل مصروف',
fields:[
{id:'description',label:'الوصف',type:'text',required:true},
{id:'amount',label:'المبلغ',type:'number',required:true},
{
id:'expense_type',
label:'نوع المصروف',
type:'select',
options:[
{value:'general',label:'مصاريف عامة'},
{value:'supplier_payment',label:'دفعة مورد'},
{value:'salary',label:'رواتب'},
{value:'partner_cost',label:'تكاليف شركاء'}
]
},
{
id:'treasury_id',
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
submitLabel:'حفظ',
onSubmit:async(vals)=>{
await dbInsert('expenses',{
description:vals.description,
amount:vals.amount,
expense_type:vals.expense_type,
treasury_type:vals.treasury_id,
date:new Date().toISOString()
});
await addAuditLog('expense',vals);
toast('تم تسجيل المصروف','success');
navigate('khazna');
}
});
};

window.requestCashHandover=async function(fromId){
inputModal({
title:'طلب تسليم عهدة',
fields:[
{id:'cash_amount',label:'كاش',type:'number'},
{id:'vodafone_amount',label:'فودافون',type:'number'}
],
submitLabel:'إرسال',
onSubmit:async(vals)=>{
const user=await ensureUser();
const {data:manager}=await supabase
.from('treasury_accounts')
.select('id')
.eq('user_id',user.id)
.eq('treasury_type','financial_manager')
.single();

await dbInsert('cash_handover_requests',{
from_treasury_id:fromId,
to_treasury_id:manager.id,
cash_amount:vals.cash_amount||0,
vodafone_amount:vals.vodafone_amount||0,
status:'pending'
});

toast('تم إرسال طلب التسليم','success');
navigate('khazna');
}
});
};

window.approveCashHandover=async function(id){
const {data,error}=await supabase.rpc(
'approve_handover',
{p_request_id:id}
);

if(error){
toast('فشل الاعتماد','error');
return;
}

if(data===false){
toast('الرصيد غير كاف','warning');
return;
}

toast('تم اعتماد التسليم','success');
navigate('khazna');
};