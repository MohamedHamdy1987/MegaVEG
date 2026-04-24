import { supabase } from "../data.js";
import { formatCurrency, formatDate } from "../ui.js";

export async function renderDashboard(app) {
  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">📊 لوحة التحكم</div>
        <div class="page-subtitle" id="dash-date"></div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="navigate('financial')">📈 المركز المالي</button>
      </div>
    </div>

    <!-- KPI -->
    <div class="kpi-grid" id="kpi-grid">
      ${[0,1,2,3].map(()=>`<div class="skeleton skeleton-card" style="height:110px"></div>`).join('')}
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="quick-btn" onclick="navigate('invoices')"><span class="q-icon">📄</span>فاتورة جديدة</button>
      <button class="quick-btn" onclick="navigate('sales')"><span class="q-icon">🛒</span>بيع</button>
      <button class="quick-btn" onclick="navigate('khazna')"><span class="q-icon">💰</span>تحصيل</button>
      <button class="quick-btn" onclick="navigate('customers')"><span class="q-icon">👥</span>العملاء</button>
      <button class="quick-btn" onclick="navigate('financial')"><span class="q-icon">📊</span>الجرد</button>
    </div>

    <!-- Charts + Aging -->
    <div class="grid-2" style="gap:var(--sp-4)">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📈 المبيعات (آخر 14 يوم)</span>
          <span id="chart-total" class="badge badge-teal"></span>
        </div>
        <canvas id="salesChart" style="max-height:210px"></canvas>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔴 أعلى الديون</span>
          <button class="btn btn-sm btn-ghost" onclick="navigate('customers')">الكل ←</button>
        </div>
        <div id="aging-widget">
          ${[0,1,2].map(()=>`<div class="skeleton skeleton-text" style="height:40px;margin-bottom:8px;"></div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Open Invoices + Activity -->
    <div class="grid-2" style="gap:var(--sp-4);margin-top:var(--sp-4)">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📄 فواتير مفتوحة للبيع</span>
          <button class="btn btn-sm" onclick="navigate('sales')">بيع →</button>
        </div>
        <div id="open-invoices"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">⚡ آخر العمليات</span>
        </div>
        <div id="activity-feed"></div>
      </div>
    </div>
  `;

  document.getElementById("dash-date").textContent =
    new Date().toLocaleDateString("ar-EG", { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  await Promise.all([loadKPIs(), loadChart(), loadAging(), loadOpenInvoices(), loadActivity()]);
}

async function loadKPIs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const [
    { data: invoices },
    { data: customers },
    { data: balances },
    { data: expenses },
    { data: collections }
  ] = await Promise.all([
    supabase.from("invoices").select("commission").eq("user_id",user.id).eq("status","closed"),
    supabase.from("customers").select("id").eq("user_id",user.id),
    supabase.from("customer_balances").select("balance").eq("user_id",user.id),
    supabase.from("expenses").select("amount").eq("user_id",user.id),
    supabase.from("collections").select("amount").eq("user_id",user.id)
  ]);

  const totalCommission  = (invoices||[]).reduce((s,i)=>s+Number(i.commission||0),0);
  const totalReceivables = (balances||[]).filter(b=>Number(b.balance)>0).reduce((s,b)=>s+Number(b.balance),0);
  const totalExpenses    = (expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const totalCash        = (collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);
  const cashOnHand       = totalCash - totalExpenses;

  const kpis = [
    { icon:'💎', label:'صافي العمولات',  value: formatCurrency(totalCommission), color:'#14b8a6' },
    { icon:'👥', label:'ذمم العملاء',    value: formatCurrency(totalReceivables), color:'#f87171' },
    { icon:'💵', label:'الصافي في الخزنة',value: formatCurrency(cashOnHand),    color: cashOnHand >= 0 ? '#4ade80' : '#f87171' },
    { icon:'🏪', label:'عدد العملاء',    value: (customers||[]).length,          color:'#a78bfa' }
  ];

  document.getElementById("kpi-grid").innerHTML = kpis.map(k => `
    <div class="kpi-card" style="--kpi-color:${k.color}">
      <span class="kpi-icon">${k.icon}</span>
      <div class="kpi-value" style="color:${k.color}">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>
  `).join('');
}

async function loadChart() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const since = new Date();
  since.setDate(since.getDate() - 13);

  const { data: sales } = await supabase
    .from("daily_sales")
    .select("date,total")
    .eq("user_id", user.id)
    .gte("date", since.toISOString().split("T")[0])
    .order("date");

  // بناء خريطة 14 يوم
  const map = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    map[d.toISOString().split("T")[0]] = 0;
  }
  (sales||[]).forEach(s => { if (map[s.date] !== undefined) map[s.date] += Number(s.total||0); });

  const total = Object.values(map).reduce((a,b)=>a+b,0);
  const badge = document.getElementById("chart-total");
  if (badge) badge.textContent = formatCurrency(total);

  const ctx = document.getElementById("salesChart");
  if (!ctx) return;

  const labels = Object.keys(map).map(d => {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth()+1}`;
  });

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: Object.values(map),
        borderColor: "#14b8a6",
        backgroundColor: ctx2 => {
          const g = ctx2.chart.ctx.createLinearGradient(0,0,0,210);
          g.addColorStop(0,"rgba(20,184,166,0.28)");
          g.addColorStop(1,"rgba(20,184,166,0)");
          return g;
        },
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: "#14b8a6"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks:{ color:"#6b7280", font:{size:11} }, grid:{ display:false } },
        y: {
          ticks:{ color:"#6b7280", font:{size:11},
            callback: v => v >= 1000 ? (v/1000).toFixed(0)+'ك' : v },
          grid:{ color:"rgba(255,255,255,0.04)" }
        }
      }
    }
  });
}

async function loadAging() {
  const { data: { user } } = await supabase.auth.getUser();
  const container = document.getElementById("aging-widget");
  if (!container) return;

  const { data: balances } = await supabase
    .from("customer_balances")
    .select("*")
    .eq("user_id", user.id)
    .gt("balance", 0)
    .order("balance", { ascending: false })
    .limit(6);

  if (!balances?.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="font-size:36px;margin-bottom:8px;">✅</div>
        <div style="font-size:14px;color:var(--c-text-secondary);">لا توجد ديون مستحقة</div>
      </div>`;
    return;
  }

  const maxBal = Math.max(...balances.map(b=>b.balance));

  container.innerHTML = balances.map(b => `
    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-weight:600;font-size:14px;">👤 ${b.full_name||'عميل'}</span>
        <span style="color:#f87171;font-weight:700;font-size:14px;">${formatCurrency(b.balance)}</span>
      </div>
      <div style="background:rgba(239,68,68,0.1);border-radius:4px;height:4px;overflow:hidden;">
        <div style="background:#ef4444;height:100%;width:${Math.min(100,(b.balance/maxBal)*100).toFixed(0)}%;border-radius:4px;"></div>
      </div>
    </div>
  `).join('');
}

async function loadOpenInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  const container = document.getElementById("open-invoices");
  if (!container) return;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,supplier_name,date")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .order("date", { ascending:false })
    .limit(5);

  if (!invoices?.length) {
    container.innerHTML = `<p style="color:var(--c-text-muted);text-align:center;padding:20px;font-size:13px;">لا توجد فواتير مفتوحة للبيع حالياً</p>`;
    return;
  }

  container.innerHTML = invoices.map(inv => `
    <div class="row" style="justify-content:space-between;">
      <div>
        <div style="font-weight:600;font-size:14px;">🚚 ${inv.supplier_name}</div>
        <div style="font-size:12px;color:var(--c-text-muted);">${formatDate(inv.date)}</div>
      </div>
      <button class="btn btn-sm" onclick="navigate('sales')">بيع →</button>
    </div>
  `).join('');
}

async function loadActivity() {
  const { data: { user } } = await supabase.auth.getUser();
  const container = document.getElementById("activity-feed");
  if (!container) return;

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("action,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending:false })
    .limit(8);

  if (!logs?.length) {
    container.innerHTML = `<p style="color:var(--c-text-muted);text-align:center;padding:20px;font-size:13px;">لا توجد عمليات سابقة</p>`;
    return;
  }

  const labels = {
    sell_product:   '🛒 بيع منتج',
    return_product: '↩️ مرتجع',
    close_invoice:  '🔒 إغلاق فاتورة',
    collection:     '💰 تحصيل',
    expense:        '📤 مصروف',
    customer_allowance: '📝 مسموح'
  };

  container.innerHTML = logs.map(l => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-content">
        <div>${labels[l.action] || '⚡ ' + l.action}</div>
        <div class="activity-time">${formatDate(l.created_at)}</div>
      </div>
    </div>
  `).join('');
}
