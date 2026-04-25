import { supabase, dbInsert } from "../data.js";
import { toast, inputModal, formatCurrency, formatDate } from "../ui.js";

export async function renderSuppliersPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🚚 الموردين</div>
        <div class="page-subtitle">${(suppliers||[]).length} مورد مسجل</div>
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

function renderSupplierCards(list) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">🚚</div>
      <div class="empty-title">لا يوجد موردين</div>
      <div class="empty-sub">أضف أول مورد لتتمكن من إنشاء الفواتير</div>
      <button class="btn" onclick="openAddSupplier()">➕ إضافة مورد</button>
    </div>`;

  return list.map(s => `
    <div class="card" style="cursor:pointer;" onclick="openSupplier('${s.id}','${(s.name||'').replace(/'/g,"&#39;")}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:16px;">🚚 ${s.name}</div>
          ${s.phone ? `<div style="font-size:13px;color:var(--c-text-muted);margin-top:4px;">📞 ${s.phone}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openSupplier('${s.id}','${(s.name||'').replace(/'/g,"&#39;")}')">
          حساب →
        </button>
      </div>
    </div>`).join('');
}

window.openAddSupplier = async function() {
  inputModal({
    title: '🚚 إضافة مورد جديد',
    fields: [
      { id:'name',  label:'اسم المورد', type:'text', required:true },
      { id:'phone', label:'رقم الهاتف', type:'tel',  placeholder:'05xxxxxxxx' }
    ],
    submitLabel: '✅ إضافة المورد',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("suppliers", {
        name:  vals.name,
        phone: vals.phone || null
      });
      if (!inserted) throw new Error("فشل إضافة المورد");
      closeModal();
      toast(`تم إضافة المورد: ${vals.name}`, "success");
      navigate("suppliers");
    }
  });
};

window.openSupplier = async function(supplierId, supplierName) {
  const app = document.getElementById("app");

  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .eq("supplier_id", supplierId)
    .order("date", { ascending: false });

  const closed    = (invoices||[]).filter(i => i.status === 'closed');
  const confirmed = (invoices||[]).filter(i => i.status === 'confirmed');
  const drafts    = (invoices||[]).filter(i => i.status === 'draft');

  // الرصيد المستحق = مجموع صافي الفواتير المغلقة (ما يُدفع للمورد)
  const totalOwed      = closed.reduce((s,i) => s + Number(i.net||0), 0);
  const totalGross     = closed.reduce((s,i) => s + Number(i.gross||0), 0);
  const totalCommission= closed.reduce((s,i) => s + Number(i.commission||0), 0);

  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('suppliers')" style="margin-bottom:var(--sp-4);">← رجوع</button>

    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🚚 ${supplierName}</div>
        <div class="page-subtitle">سجل الحساب الكامل</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة</button>
        <button class="btn btn-sm" onclick="navigate('invoices')">📄 فاتورة جديدة</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="margin-bottom:var(--sp-5);">
      <div class="kpi-card" style="--kpi-color:#f87171">
        <span class="kpi-icon">💰</span>
        <div class="kpi-value" style="color:#f87171">${formatCurrency(totalOwed)}</div>
        <div class="kpi-label">إجمالي المستحق للمورد</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#4ade80">
        <span class="kpi-icon">📦</span>
        <div class="kpi-value" style="color:#4ade80">${formatCurrency(totalGross)}</div>
        <div class="kpi-label">إجمالي المبيعات</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#14b8a6">
        <span class="kpi-icon">💎</span>
        <div class="kpi-value" style="color:#14b8a6">${formatCurrency(totalCommission)}</div>
        <div class="kpi-label">إجمالي العمولات</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#a78bfa">
        <span class="kpi-icon">📄</span>
        <div class="kpi-value" style="color:#a78bfa">${(invoices||[]).length}</div>
        <div class="kpi-label">عدد الفواتير</div>
      </div>
    </div>

    <!-- فواتير مفتوحة -->
    ${confirmed.length ? `
      <div class="card" style="border-color:rgba(34,197,94,0.2);margin-bottom:var(--sp-4);">
        <div class="card-header">
          <span class="card-title">🟢 فواتير مفتوحة للبيع (${confirmed.length})</span>
          <button class="btn btn-sm" onclick="navigate('sales')">بيع →</button>
        </div>
        ${confirmed.map(inv=>`
          <div class="row" style="justify-content:space-between;">
            <span style="font-size:14px;">📅 ${formatDate(inv.date)}</span>
            <span class="badge badge-green">معتمدة</span>
          </div>`).join('')}
      </div>` : ''}

    <!-- جدول الفواتير -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">📋 سجل الفواتير (${(invoices||[]).length})</span>
      </div>

      ${!(invoices||[]).length
        ? `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا توجد فواتير لهذا المورد</p>`
        : `
          <!-- Desktop -->
          <div class="table-wrapper table-desktop">
            <table class="table">
              <thead>
                <tr><th>التاريخ</th><th>الحالة</th><th>إجمالي المبيعات</th><th>العمولة</th><th>الصافي للمورد</th></tr>
              </thead>
              <tbody>
                ${(invoices||[]).map(inv => {
                  const statusMap = {
                    closed:    `<span class="badge badge-red">منتهية</span>`,
                    confirmed: `<span class="badge badge-green">معتمدة</span>`,
                    draft:     `<span class="badge badge-yellow">مسودة</span>`
                  };
                  return `
                    <tr>
                      <td>${formatDate(inv.date)}</td>
                      <td>${statusMap[inv.status]||''}</td>
                      <td style="color:#4ade80;">${inv.gross  ? formatCurrency(inv.gross)      : '–'}</td>
                      <td style="color:#14b8a6;">${inv.commission ? formatCurrency(inv.commission) : '–'}</td>
                      <td style="font-weight:700;color:#f87171;">${inv.net ? formatCurrency(inv.net) : '–'}</td>
                    </tr>`;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:rgba(20,184,166,0.06);">
                  <td colspan="2" style="font-weight:700;color:var(--c-brand-light);">الإجمالي</td>
                  <td style="font-weight:700;color:#4ade80;">${formatCurrency(totalGross)}</td>
                  <td style="font-weight:700;color:#14b8a6;">${formatCurrency(totalCommission)}</td>
                  <td style="font-weight:800;color:#f87171;font-size:16px;">${formatCurrency(totalOwed)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Mobile -->
          <div class="mobile-card-list">
            ${(invoices||[]).map(inv => {
              const statusMap = {
                closed:    `<span class="badge badge-red">منتهية</span>`,
                confirmed: `<span class="badge badge-green">معتمدة</span>`,
                draft:     `<span class="badge badge-yellow">مسودة</span>`
              };
              return `
                <div style="padding:var(--sp-3) 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:14px;font-weight:600;">📅 ${formatDate(inv.date)}</span>
                    ${statusMap[inv.status]||''}
                  </div>
                  ${inv.status==='closed' ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;text-align:center;">
                      <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                        <div style="color:var(--c-text-muted);">مبيعات</div>
                        <div style="color:#4ade80;font-weight:700;">${formatCurrency(inv.gross||0)}</div>
                      </div>
                      <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                        <div style="color:var(--c-text-muted);">عمولة</div>
                        <div style="color:#14b8a6;font-weight:700;">${formatCurrency(inv.commission||0)}</div>
                      </div>
                      <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                        <div style="color:var(--c-text-muted);">صافي</div>
                        <div style="color:#f87171;font-weight:700;">${formatCurrency(inv.net||0)}</div>
                      </div>
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>
        `}
    </div>
  `;
};
