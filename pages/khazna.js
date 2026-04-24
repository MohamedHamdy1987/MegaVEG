import { supabase, dbInsert, addAuditLog } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate } from "../ui.js";

export async function renderKhaznaPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: collections }, { data: expenses }] = await Promise.all([
    supabase.from("collections").select("*,customers(full_name)")
      .eq("user_id", user.id).order("created_at",{ascending:false}),
    supabase.from("expenses").select("*")
      .eq("user_id", user.id).order("created_at",{ascending:false})
  ]);

  const cashIn  = (collections||[]).reduce((s,c)=>s+Number(c.amount||0),0);
  const cashOut = (expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const net     = cashIn - cashOut;

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">💰 الخزنة</div>
        <div class="page-subtitle">الحركات المالية اليومية</div>
      </div>
      <div class="page-actions">
        <button class="btn"            onclick="openAddCollection()">➕ تحصيل</button>
        <button class="btn btn-danger" onclick="openAddExpense()">➖ مصروف</button>
      </div>
    </div>

    <!-- KPIs -->
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
        <div class="kpi-label">الصافي في الخزنة</div>
      </div>
    </div>

    <div class="grid-2" style="gap:var(--sp-4);">
      <!-- التحصيلات -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📥 التحصيلات (${(collections||[]).length})</span>
        </div>
        ${renderCollections(collections||[])}
      </div>

      <!-- المصروفات -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📤 المصروفات (${(expenses||[]).length})</span>
        </div>
        ${renderExpenses(expenses||[])}
      </div>
    </div>
  `;
}

function renderCollections(list) {
  if (!list.length) return `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا توجد تحصيلات</p>`;

  return `
    <!-- Desktop -->
    <div class="table-wrapper table-desktop">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>العميل</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${list.map(x=>`
            <tr>
              <td style="font-size:12px;">${formatDate(x.date||x.created_at)}</td>
              <td>${x.customers?.full_name || '–'}</td>
              <td style="color:#4ade80;font-weight:700;">${formatCurrency(x.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <!-- Mobile -->
    <div class="mobile-card-list">
      ${list.slice(0,20).map(x=>`
        <div class="row" style="justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:14px;">👤 ${x.customers?.full_name||'–'}</div>
            <div style="font-size:12px;color:var(--c-text-muted);">${formatDate(x.date||x.created_at)}</div>
          </div>
          <span style="color:#4ade80;font-weight:700;font-size:15px;">${formatCurrency(x.amount)}</span>
        </div>`).join('')}
    </div>`;
}

function renderExpenses(list) {
  if (!list.length) return `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا توجد مصروفات</p>`;

  return `
    <!-- Desktop -->
    <div class="table-wrapper table-desktop">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>الوصف</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${list.map(x=>`
            <tr>
              <td style="font-size:12px;">${formatDate(x.date||x.created_at)}</td>
              <td>${x.description||'–'}</td>
              <td style="color:#f87171;font-weight:700;">${formatCurrency(x.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <!-- Mobile -->
    <div class="mobile-card-list">
      ${list.slice(0,20).map(x=>`
        <div class="row" style="justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:14px;">📝 ${x.description||'–'}</div>
            <div style="font-size:12px;color:var(--c-text-muted);">${formatDate(x.date||x.created_at)}</div>
          </div>
          <span style="color:#f87171;font-weight:700;font-size:15px;">${formatCurrency(x.amount)}</span>
        </div>`).join('')}
    </div>`;
}

window.openAddCollection = async function() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: customers } = await supabase
    .from("customers").select("id,full_name").eq("user_id",user.id).order("full_name");

  if (!customers?.length) {
    toast("يرجى إضافة عملاء أولاً","warning");
    return;
  }

  inputModal({
    title: '💰 تسجيل تحصيل',
    fields: [
      { id:'customer_id', label:'العميل', type:'select', required:true,
        options: customers.map(c=>({value:c.id,label:c.full_name})) },
      { id:'amount', label:'المبلغ المحصل', type:'number', min:0.01, step:0.01, required:true }
    ],
    submitLabel: '✅ تسجيل التحصيل',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("collections",{
        customer_id: vals.customer_id,
        amount:      vals.amount,
        date:        new Date().toISOString()
      });
      if (!inserted) throw new Error("فشل تسجيل التحصيل");
      const custName = customers.find(c=>c.id===vals.customer_id)?.full_name;
      await addAuditLog("collection",{ customer_id:vals.customer_id, customer_name:custName, amount:vals.amount });
      closeModal();
      toast(`✅ تم تسجيل ${formatCurrency(vals.amount)}`,"success");
      navigate("khazna");
    }
  });
};

window.openAddExpense = async function() {
  inputModal({
    title: '📤 تسجيل مصروف',
    fields: [
      { id:'description', label:'الوصف',   type:'text',   required:true, placeholder:'مثال: شراء أكياس نايلون' },
      { id:'amount',      label:'المبلغ',  type:'number', min:0.01, step:0.01, required:true }
    ],
    submitLabel: '✅ تسجيل المصروف',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("expenses",{
        description: vals.description,
        amount:      vals.amount,
        date:        new Date().toISOString()
      });
      if (!inserted) throw new Error("فشل تسجيل المصروف");
      await addAuditLog("expense",{ description:vals.description, amount:vals.amount });
      closeModal();
      toast("تم تسجيل المصروف ✓","success");
      navigate("khazna");
    }
  });
};
