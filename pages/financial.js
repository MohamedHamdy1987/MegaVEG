import { supabase } from "../data.js";
import { formatCurrency } from "../ui.js";

export async function renderFinancialPage(app) {
  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🏦 المركز المالي</div>
        <div class="page-subtitle">الجرد المالي الشامل – ${new Date().toLocaleDateString("ar-EG",{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة</button>
      </div>
    </div>
    <div class="kpi-grid" id="fin-kpis">
      ${[0,1,2,3].map(()=>`<div class="skeleton skeleton-card" style="height:110px;"></div>`).join('')}
    </div>
    <div class="grid-2" id="fin-details"></div>
  `;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const [
      { data: collections },
      { data: expenses },
      { data: balances },
      { data: closedInvoices },
      { data: allowances },
      { data: opExpenses }
    ] = await Promise.all([
      supabase.from("collections").select("amount").eq("user_id",user.id),
      supabase.from("expenses").select("amount").eq("user_id",user.id),
      supabase.from("customer_balances").select("balance").eq("user_id",user.id),
      supabase.from("invoices").select("net,commission,gross").eq("user_id",user.id).eq("status","closed"),
      supabase.from("customer_allowances").select("amount").eq("user_id",user.id),
      supabase.from("operating_expenses").select("amount").eq("user_id",user.id)
    ]);

    const cashIn  = (collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);
    const cashOut = (expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
    const cashOnHand = cashIn - cashOut;

    const customerReceivables = (balances||[])
      .filter(b=>Number(b.balance)>0)
      .reduce((s,b)=>s+Number(b.balance),0);

    const supplierLiabilities = (closedInvoices||[]).reduce((s,i)=>s+Number(i.net||0),0);
    const netShopEquity = cashOnHand + customerReceivables - supplierLiabilities;

    const totalCommission  = (closedInvoices||[]).reduce((s,i)=>s+Number(i.commission||0),0);
    const totalGross       = (closedInvoices||[]).reduce((s,i)=>s+Number(i.gross||0),0);
    const totalAllowances  = (allowances||[]).reduce((s,a)=>s+Number(a.amount||0),0);
    const totalOpExpenses  = (opExpenses||[]).reduce((s,o)=>s+Number(o.amount||0),0);
    const netProfit = totalCommission - totalAllowances - totalOpExpenses;

    // KPIs
    document.getElementById("fin-kpis").innerHTML = [
      { icon:'💵', label:'النقدية في الصندوق', value:cashOnHand, color: cashOnHand>=0?'#4ade80':'#f87171' },
      { icon:'👥', label:'ذمم العملاء',         value:customerReceivables, color:'#f87171' },
      { icon:'🚚', label:'التزامات الموردين',   value:supplierLiabilities, color:'#fbbf24' },
      { icon:'💎', label:'صافي الربح',           value:netProfit, color: netProfit>=0?'#14b8a6':'#f87171' }
    ].map(k => `
      <div class="kpi-card" style="--kpi-color:${k.color}">
        <span class="kpi-icon">${k.icon}</span>
        <div class="kpi-value" style="color:${k.color}">${formatCurrency(k.value)}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    `).join('');

    // Details
    document.getElementById("fin-details").innerHTML = `
      <!-- حقوق الملكية -->
      <div class="card">
        <div class="card-header"><span class="card-title">🏬 حقوق الملكية (Equity)</span></div>
        <div class="stat-row">
          <span class="stat-label">💵 النقدية في الصندوق</span>
          <span class="stat-value ${cashOnHand>=0?'positive':'negative'}">${formatCurrency(cashOnHand)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">+ 👥 ذمم العملاء</span>
          <span class="stat-value positive">${formatCurrency(customerReceivables)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">− 🚚 التزامات الموردين</span>
          <span class="stat-value negative">(${formatCurrency(supplierLiabilities)})</span>
        </div>
        <hr>
        <div class="stat-row" style="font-size:17px;">
          <span style="font-weight:800;">صافي حقوق المحل</span>
          <span style="font-weight:800;font-size:19px;color:${netShopEquity>=0?'#4ade80':'#f87171'};">
            ${formatCurrency(netShopEquity)}
          </span>
        </div>
      </div>

      <!-- الأرباح -->
      <div class="card">
        <div class="card-header"><span class="card-title">📊 الأرباح التشغيلية</span></div>
        <div class="stat-row">
          <span class="stat-label">📈 إجمالي مبيعات الفواتير</span>
          <span class="stat-value">${formatCurrency(totalGross)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">💎 عمولات (${((totalCommission/totalGross)*100||0).toFixed(1)}%)</span>
          <span class="stat-value positive">${formatCurrency(totalCommission)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">− 📝 مسموحات العملاء</span>
          <span class="stat-value negative">(${formatCurrency(totalAllowances)})</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">− 💸 مصاريف تشغيلية</span>
          <span class="stat-value negative">(${formatCurrency(totalOpExpenses)})</span>
        </div>
        <hr>
        <div class="stat-row" style="font-size:17px;">
          <span style="font-weight:800;">صافي الربح</span>
          <span style="font-weight:800;font-size:19px;color:${netProfit>=0?'#14b8a6':'#f87171'};">
            ${formatCurrency(netProfit)}
          </span>
        </div>
        <p style="font-size:11px;color:var(--c-text-muted);margin-top:8px;">
          = عمولات − مسموحات − مصاريف تشغيلية
        </p>
      </div>
    `;

  } catch (err) {
    console.error("FINANCIAL ERROR:", err);
    app.innerHTML += `<div class="card" style="border-color:rgba(239,68,68,0.3);">
      <h3 style="color:#f87171;">⚠️ خطأ في تحميل المركز المالي</h3>
      <p style="color:var(--c-text-muted);font-size:13px;">${err.message}</p>
    </div>`;
  }
}
