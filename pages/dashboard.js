import { supabase, ensureUser } from '../data.js';
import { formatCurrency, formatDate } from '../ui.js';

export async function renderDashboard(app){
const user=await ensureUser();

app.innerHTML=`
<div class='page-header'>
<div class='page-title'>📊 لوحة التحكم</div>
<button class='btn' onclick="navigate('financial')">المركز المالي</button>
</div>

<div id='kpi-grid'>
${[0,1,2,3].map(()=>`<div class='skeleton skeleton-card'></div>`).join('')}
</div>

<div class='grid-2'>
<div class='card'>
<canvas id='salesChart'></canvas>
<span id='chart-total'></span>
</div>

<div class='card'>
<div id='aging-widget'></div>
</div>
</div>

<div class='grid-2'>
<div class='card'>
<div id='open-invoices'></div>
</div>
<div class='card'>
<div id='activity-feed'></div>
</div>
</div>`;

/* resilience */
await Promise.allSettled([
loadKPIs(user),
loadChart(user),
loadAging(user),
loadOpenInvoices(user),
loadActivity(user)
]);
}

async function loadKPIs(user){
try{
const[
{data:invoices},
{data:customers},
{data:balances},
{data:expenses},
{data:collections}
]=await Promise.all([
supabase.from('invoices').select('commission').eq('user_id',user.id).eq('status','closed'),
supabase.from('customers').select('id').eq('user_id',user.id),
supabase.from('customer_balances').select('balance').eq('user_id',user.id),
supabase.from('expenses').select('amount').eq('user_id',user.id),
supabase.from('collections').select('amount').eq('user_id',user.id)
]);

const totalCommission=(invoices||[]).reduce((s,i)=>s+Number(i.commission||0),0);
const totalReceivables=(balances||[]).filter(b=>Number(b.balance)>0).reduce((s,b)=>s+Number(b.balance),0);
const totalExpenses=(expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
const totalCash=(collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);

/* placeholder until khazna ledger integration */
const cashOnHand=totalCash-totalExpenses;

document.getElementById('kpi-grid').innerHTML=`
<div class='kpi-card'>${formatCurrency(totalCommission)} عمولات</div>
<div class='kpi-card'>${formatCurrency(totalReceivables)} ذمم</div>
<div class='kpi-card'>${formatCurrency(cashOnHand)} خزنة</div>
<div class='kpi-card'>${(customers||[]).length} عميل</div>`;
}catch(e){
console.error(e);
}
}

async function loadChart(user){
try{
const since=new Date();
since.setDate(since.getDate()-13);

const {data:sales,error}=await supabase
.from('daily_sales')
.select('date,total')
.eq('user_id',user.id)
.gte('date',since.toISOString().split('T')[0])
.order('date');

if(error){
console.warn('daily_sales missing');
return;
}

const map={};
for(let i=13;i>=0;i--){
const d=new Date();
d.setDate(d.getDate()-i);
map[d.toISOString().split('T')[0]]=0;
}

(sales||[]).forEach(s=>{
if(map[s.date]!==undefined){
map[s.date]+=Number(s.total||0);
}
});

const total=Object.values(map).reduce((a,b)=>a+b,0);
const badge=document.getElementById('chart-total');
if(badge) badge.textContent=formatCurrency(total);

const ctx=document.getElementById('salesChart');
if(!ctx) return;

/* destroy old chart */
if(window._salesChart){
window._salesChart.destroy();
}

window._salesChart=new Chart(ctx,{
type:'line',
data:{
labels:Object.keys(map),
datasets:[{
data:Object.values(map),
borderColor:'#14b8a6',
fill:false
}]
},
options:{responsive:true}
});

}catch(e){
console.error(e);
}
}

async function loadAging(user){
try{
const container=document.getElementById('aging-widget');
if(!container) return;

/* join fixed */
const {data:balances}=await supabase
.from('customer_balances')
.select(`
customer_id,
balance,
customers(full_name)
`)
.eq('user_id',user.id)
.gt('balance',0)
.order('balance',{ascending:false})
.limit(6);

if(!balances?.length){
container.innerHTML='لا توجد ديون';
return;
}

container.innerHTML=balances.map(b=>`
<div>
${b.customers?.full_name||'عميل'}
-
${formatCurrency(b.balance)}
</div>`).join('');
}catch(e){
console.error(e);
}
}

async function loadOpenInvoices(user){
try{
const c=document.getElementById('open-invoices');
if(!c)return;
const {data:invoices}=await supabase
.from('invoices')
.select('supplier_name,date')
.eq('user_id',user.id)
.eq('status','confirmed')
.limit(5);

c.innerHTML=(invoices||[]).map(i=>`
<div>
${i.supplier_name}
${formatDate(i.date)}
</div>`).join('')||'لا توجد';
}catch(e){console.error(e);}
}

async function loadActivity(user){
try{
const c=document.getElementById('activity-feed');
if(!c)return;
const {data:logs}=await supabase
.from('audit_logs')
.select('action,created_at')
.eq('user_id',user.id)
.order('created_at',{ascending:false})
.limit(8);

c.innerHTML=(logs||[]).map(l=>`
<div>
${l.action}
${formatDate(l.created_at)}
</div>`).join('')||'لا توجد';
}catch(e){console.error(e);}
}