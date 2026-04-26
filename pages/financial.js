import { supabase, ensureUser } from "../data.js";
import { formatCurrency } from "../ui.js";

export async function renderFinancialPage(app) {

const user = await ensureUser();

app.innerHTML=`
<div class="page-header">
<div class="page-title">🏦 المركز المالي</div>
</div>
<div id="fin-kpis"></div>
<div id="fin-details"></div>
`;

try{

const [
{data:collections},
{data:expenses},
{data:balances},
{data:closedInvoices},
{data:allowances},
{data:opExpenses}
]=await Promise.all([

supabase.from('collections').select('amount').eq('user_id',user.id),

supabase.from('expenses').select('*').eq('user_id',user.id),

supabase.from('customer_balances').select('balance').eq('user_id',user.id),

supabase.from('invoices').select('net,commission,gross').eq('user_id',user.id).eq('status','closed'),

supabase.from('customer_allowances').select('amount').eq('user_id',user.id),

supabase.from('operating_expenses').select('amount').eq('user_id',user.id)

]);

const cashIn=(collections||[])
.reduce((s,c)=>s+Number(c.amount||0),0);

const operatingCashOut=(expenses||[])
.filter(e=>e.expense_type!=='supplier_payment')
.reduce((s,e)=>s+Number(e.amount||0),0);

const cashOut=operatingCashOut;
const cashOnHand=cashIn-cashOut;

const customerReceivables=(balances||[])
.filter(b=>Number(b.balance)>0)
.reduce((s,b)=>s+Number(b.balance),0);

const grossSupplierLiabilities=(closedInvoices||[])
.reduce((s,i)=>s+Number(i.net||0),0);

const supplierPayments=(expenses||[])
.filter(e=>e.expense_type==='supplier_payment')
.reduce((s,e)=>s+Number(e.amount||0),0);

const supplierLiabilities=grossSupplierLiabilities-supplierPayments;

const netShopEquity=
cashOnHand+
customerReceivables-
supplierLiabilities;

const totalCommission=(closedInvoices||[])
.reduce((s,i)=>s+Number(i.commission||0),0);

const totalGross=(closedInvoices||[])
.reduce((s,i)=>s+Number(i.gross||0),0);

const totalAllowances=(allowances||[])
.reduce((s,a)=>s+Number(a.amount||0),0);

// FIX النهائي: إزالة double counting
// نعتمد operating_expenses فقط ولا نجمع daily_expense/operating_expense من expenses مرة ثانية
const totalOpExpenses=(opExpenses||[])
.reduce(
(s,o)=>s+Number(o.amount||0),
0
);

const netProfit=
 totalCommission
-totalAllowances
-totalOpExpenses;

document.getElementById('fin-kpis').innerHTML=`
<div class="kpi-grid">
<div class="kpi-card">
<div class="kpi-value">${formatCurrency(cashOnHand)}</div>
<div class="kpi-label">النقدية بالصندوق</div>
</div>

<div class="kpi-card">
<div class="kpi-value">${formatCurrency(customerReceivables)}</div>
<div class="kpi-label">ذمم العملاء</div>
</div>

<div class="kpi-card">
<div class="kpi-value">${formatCurrency(supplierLiabilities)}</div>
<div class="kpi-label">التزامات الموردين</div>
</div>

<div class="kpi-card">
<div class="kpi-value">${formatCurrency(netProfit)}</div>
<div class="kpi-label">صافي الربح</div>
</div>
</div>`;

document.getElementById('fin-details').innerHTML=`
<div class="grid-2">

<div class="card">
<h3>حقوق المحل</h3>
<div class="stat-row"><span>نقدية</span><span>${formatCurrency(cashOnHand)}</span></div>
<div class="stat-row"><span>ذمم العملاء</span><span>${formatCurrency(customerReceivables)}</span></div>
<div class="stat-row"><span>التزامات الموردين</span><span>${formatCurrency(supplierLiabilities)}</span></div>
<hr>
<div class="stat-row"><span>صافي حقوق المحل</span><span>${formatCurrency(netShopEquity)}</span></div>
</div>

<div class="card">
<h3>تحليل الربح</h3>
<div class="stat-row"><span>إجمالي العمولات</span><span>${formatCurrency(totalCommission)}</span></div>
<div class="stat-row"><span>القطعيات</span><span>${formatCurrency(totalAllowances)}</span></div>
<div class="stat-row"><span>مصاريف التشغيل</span><span>${formatCurrency(totalOpExpenses)}</span></div>
<div class="stat-row"><span>دفعات الموردين</span><span>${formatCurrency(supplierPayments)} (غير مخصومة من الربح)</span></div>
<hr>
<div class="stat-row"><span>صافي الربح</span><span>${formatCurrency(netProfit)}</span></div>
</div>

</div>`;

}
catch(err){
console.error(err);
app.innerHTML+=`<div class="card">خطأ في تحميل المركز المالي</div>`;
}

}