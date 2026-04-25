import { supabase } from "../data.js";
import { formatCurrency, formatDate } from "../ui.js";

export async function renderTarhilPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">📋 دفتر الترحيلات</div>
        <div class="page-subtitle">كشف حساب جميع العملاء</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة الكل</button>
      </div>
    </div>
    <div id="tarhil-content">
      <div>
        ${[0,1,2].map(()=>`<div class="skeleton skeleton-card" style="height:120px;"></div>`).join('')}
      </div>
    </div>
  `;

  const { data, error } = await supabase
    .from("customer_ledger")
    .select("*")
    .eq("user_id", user.id)
    .order("customer_name", { ascending: true })
    .order("trx_date",      { ascending: true });

  const container = document.getElementById("tarhil-content");

  if (error) {
    container.innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.3);">
        <h3 style="color:#f87171;">⚠️ خطأ في تحميل الترحيلات</h3>
        <p style="color:var(--c-text-muted);font-size:13px;">${error.message}</p>
      </div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">لا توجد ترحيلات</div>
        <div class="empty-sub">ستظهر هنا بعد تسجيل مبيعات وتحصيلات</div>
      </div>`;
    return;
  }

  const grouped = groupByCustomer(data);
  const ids = Object.keys(grouped);

  // إجمالي كل العملاء
  const grandTotalDebit  = ids.reduce((s,id)=>s+grouped[id].debit,  0);
  const grandTotalCredit = ids.reduce((s,id)=>s+grouped[id].credit, 0);
  const grandBalance     = ids.reduce((s,id)=>s+grouped[id].balance,0);
  const debtorsCount     = ids.filter(id=>grouped[id].balance>0).length;

  container.innerHTML = `
    <!-- Summary Bar -->
    <div class="kpi-grid" style="margin-bottom:var(--sp-5);">
      <div class="kpi-card" style="--kpi-color:#f87171">
        <span class="kpi-icon">📤</span>
        <div class="kpi-value" style="color:#f87171">${formatCurrency(grandTotalDebit)}</div>
        <div class="kpi-label">إجمالي المديونيات</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#4ade80">
        <span class="kpi-icon">📥</span>
        <div class="kpi-value" style="color:#4ade80">${formatCurrency(grandTotalCredit)}</div>
        <div class="kpi-label">إجمالي التحصيلات</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${grandBalance>=0?'#f87171':'#4ade80'}">
        <span class="kpi-icon">⚖️</span>
        <div class="kpi-value" style="color:${grandBalance>=0?'#f87171':'#4ade80'}">${formatCurrency(Math.abs(grandBalance))}</div>
        <div class="kpi-label">${grandBalance>=0?'صافي الذمم':'صافي دائن'}</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#fbbf24">
        <span class="kpi-icon">👥</span>
        <div class="kpi-value" style="color:#fbbf24">${debtorsCount}</div>
        <div class="kpi-label">عملاء مدينون</div>
      </div>
    </div>

    <!-- Customer Sections -->
    ${ids.map(id => renderCustomerSection(grouped[id])).join('')}
  `;
}

function groupByCustomer(rows = []) {
  const map = {};

  rows.forEach(r => {
    if (!r.customer_id) return;
    if (!map[r.customer_id]) {
      map[r.customer_id] = {
        id:      r.customer_id,
        name:    r.customer_name || 'عميل',
        debit:   0,
        credit:  0,
        balance: 0,
        items:   []
      };
    }
    map[r.customer_id].debit  += Number(r.debit  || 0);
    map[r.customer_id].credit += Number(r.credit || 0);
    map[r.customer_id].items.push(r);
  });

  // آخر running_balance هو الرصيد الختامي
  Object.values(map).forEach(c => {
    const last = c.items[c.items.length - 1];
    c.balance = Number(last?.running_balance || 0);
  });

  // ترتيب: المدينون الأكبر أولاً
  return Object.fromEntries(
    Object.entries(map).sort((a,b) => b[1].balance - a[1].balance)
  );
}

function renderCustomerSection(g) {
  const balColor = g.balance > 0 ? '#f87171' : g.balance < 0 ? '#4ade80' : 'var(--c-text-muted)';
  const balLabel = g.balance > 0 ? 'مدين' : g.balance < 0 ? 'دائن' : 'سوّي';

  return `
    <div class="card" style="margin-bottom:var(--sp-4);${g.balance>0?'border-color:rgba(239,68,68,0.15);':''}">
      <!-- Customer Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4);">
        <div>
          <div style="font-weight:800;font-size:17px;">👤 ${g.name}</div>
          <div style="font-size:12px;color:var(--c-text-muted);margin-top:2px;">${g.items.length} حركة</div>
        </div>
        <div style="text-align:left;">
          <div style="font-weight:800;font-size:20px;color:${balColor};">${formatCurrency(Math.abs(g.balance))}</div>
          <div style="font-size:12px;color:${balColor};text-align:center;">${balLabel}</div>
        </div>
      </div>

      <!-- Desktop Table -->
      <div class="table-wrapper table-desktop">
        <table class="table">
          <thead>
            <tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
          </thead>
          <tbody>
            ${g.items.map(i => {
              const rb = Number(i.running_balance||0);
              return `
                <tr>
                  <td style="font-size:12px;white-space:nowrap;">${formatDate(i.trx_date)}</td>
                  <td style="font-size:13px;">${i.description||'–'}</td>
                  <td style="color:#f87171;font-weight:600;">${i.debit>0  ? formatCurrency(i.debit)  : '–'}</td>
                  <td style="color:#4ade80;font-weight:600;">${i.credit>0 ? formatCurrency(i.credit) : '–'}</td>
                  <td style="font-weight:700;color:${rb>=0?'#f87171':'#4ade80'};">${formatCurrency(Math.abs(rb))}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile List -->
      <div class="mobile-card-list">
        ${g.items.map(i => {
          const rb = Number(i.running_balance||0);
          return `
            <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${i.description||'–'}</div>
                <div style="font-size:11px;color:var(--c-text-muted);">${formatDate(i.trx_date)}</div>
              </div>
              <div style="text-align:left;flex-shrink:0;">
                ${i.debit>0
                  ? `<div style="color:#f87171;font-weight:700;font-size:13px;">+${formatCurrency(i.debit)}</div>`
                  : `<div style="color:#4ade80;font-weight:700;font-size:13px;">-${formatCurrency(i.credit)}</div>`}
                <div style="font-size:11px;color:${rb>=0?'#f87171':'#4ade80'};text-align:left;">${formatCurrency(Math.abs(rb))}</div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- Footer Totals -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-3);margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--c-border);">
        <div style="text-align:center;background:rgba(239,68,68,0.06);padding:var(--sp-3);border-radius:var(--r-md);">
          <div style="font-size:11px;color:var(--c-text-muted);">إجمالي مدين</div>
          <div style="font-weight:700;color:#f87171;font-size:14px;">${formatCurrency(g.debit)}</div>
        </div>
        <div style="text-align:center;background:rgba(34,197,94,0.06);padding:var(--sp-3);border-radius:var(--r-md);">
          <div style="font-size:11px;color:var(--c-text-muted);">إجمالي دائن</div>
          <div style="font-weight:700;color:#4ade80;font-size:14px;">${formatCurrency(g.credit)}</div>
        </div>
        <div style="text-align:center;background:rgba(${g.balance>=0?'239,68,68':'34,197,94'},0.08);padding:var(--sp-3);border-radius:var(--r-md);">
          <div style="font-size:11px;color:var(--c-text-muted);">الرصيد الختامي</div>
          <div style="font-weight:800;color:${balColor};font-size:16px;">${formatCurrency(Math.abs(g.balance))}</div>
        </div>
      </div>
    </div>`;
}
