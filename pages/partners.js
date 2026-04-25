import { supabase, dbInsert, addAuditLog } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate } from "../ui.js";

export async function renderPartnersPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🤝 الشركاء</div>
        <div class="page-subtitle">${(partners||[]).length} شريك مسجل</div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openAddPartner()">➕ إضافة شريك</button>
      </div>
    </div>

    <div id="partners-list">
      ${renderPartnerCards(partners||[])}
    </div>
  `;
}

function renderPartnerCards(list) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">🤝</div>
      <div class="empty-title">لا يوجد شركاء</div>
      <div class="empty-sub">أضف شركاء لتتبع حصصهم من الأرباح</div>
      <button class="btn" onclick="openAddPartner()">➕ إضافة شريك</button>
    </div>`;

  return list.map(p => `
    <div class="card" style="cursor:pointer;" onclick="openPartner('${p.id}','${(p.name||'').replace(/'/g,"&#39;")}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:16px;">🤝 ${p.name}</div>
          <div style="font-size:13px;color:var(--c-text-muted);margin-top:4px;">
            ${p.phone ? `📞 ${p.phone} &nbsp;|&nbsp; ` : ''}
            <span class="badge badge-teal">حصة: ${p.profit_share||0}%</span>
          </div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openPartner('${p.id}','${(p.name||'').replace(/'/g,"&#39;")}')">
          حساب →
        </button>
      </div>
    </div>`).join('');
}

window.openAddPartner = async function() {
  inputModal({
    title: '🤝 إضافة شريك جديد',
    fields: [
      { id:'name',         label:'اسم الشريك',     type:'text',   required:true },
      { id:'phone',        label:'رقم الهاتف',      type:'tel',    placeholder:'05xxxxxxxx' },
      { id:'profit_share', label:'نسبة الربح %',    type:'number', min:0, max:100, step:0.5, value:0,
        hint:'مثال: 25 تعني 25% من صافي الربح' },
      { id:'opening_equity', label:'رصيد افتتاحي', type:'number', min:0, value:0,
        hint:'رأس المال الذي أدخله الشريك مسبقاً' }
    ],
    submitLabel: '✅ إضافة الشريك',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("partners", {
        name:         vals.name,
        phone:        vals.phone || null,
        profit_share: vals.profit_share || 0
      });
      if (!inserted) throw new Error("فشل إضافة الشريك");

      // إنشاء سجل حقوق الملكية الافتتاحي
      await supabase.from("partner_equity").insert({
        partner_id:     inserted.id,
        opening_equity: vals.opening_equity || 0
      });

      closeModal();
      toast(`تم إضافة الشريك: ${vals.name}`, "success");
      navigate("partners");
    }
  });
};

window.openPartner = async function(id, name) {
  const app = document.getElementById("app");
  const { data: { user } } = await supabase.auth.getUser();

  // Skeleton
  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('partners')" style="margin-bottom:var(--sp-4);">← رجوع</button>
    <div class="kpi-grid">${[0,1,2].map(()=>`<div class="skeleton skeleton-card" style="height:110px;"></div>`).join('')}</div>
    <div class="skeleton skeleton-card"></div>
  `;

  const [
    { data: partner },
    { data: accounts },
    { data: equity },
    { data: invoices },
    { data: allowances },
    { data: opExpenses }
  ] = await Promise.all([
    supabase.from("partners").select("*").eq("id",id).single(),
    supabase.from("partner_current_accounts").select("*").eq("partner_id",id).order("created_at",{ascending:false}),
    supabase.from("partner_equity").select("*").eq("partner_id",id).single(),
    supabase.from("invoices").select("commission").eq("user_id",user.id).eq("status","closed"),
    supabase.from("customer_allowances").select("amount").eq("user_id",user.id),
    supabase.from("operating_expenses").select("amount").eq("user_id",user.id)
  ]);

  // حساب صافي الربح
  const totalCommission = (invoices||[]).reduce((s,i)=>s+Number(i.commission||0),0);
  const totalAllowances = (allowances||[]).reduce((s,a)=>s+Number(a.amount||0),0);
  const totalOpExpenses = (opExpenses||[]).reduce((s,o)=>s+Number(o.amount||0),0);
  const netProfit       = totalCommission - totalAllowances - totalOpExpenses;

  // حصة الشريك
  const sharePercent      = partner?.profit_share || 0;
  const openingEquity     = equity?.opening_equity || 0;
  const profitShare       = netProfit * (sharePercent / 100);
  const totalRights       = openingEquity + profitShare;

  // المسحوبات والمخصصات
  const totalWithdrawals  = (accounts||[]).reduce((s,a)=>s+Number(a.withdrawal_amount||0),0);
  const totalAllws        = (accounts||[]).reduce((s,a)=>s+Number(a.allowance||0),0);
  const totalDeductions   = (accounts||[]).reduce((s,a)=>s+Number(a.absence_deduction||0),0);
  const totalOut          = totalWithdrawals + totalAllws + totalDeductions;
  const balance           = totalRights - totalOut;

  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('partners')" style="margin-bottom:var(--sp-4);">← رجوع</button>

    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🤝 ${name}</div>
        <div class="page-subtitle">حصة: ${sharePercent}% من صافي الربح</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-sm" onclick="addPartnerWithdrawal('${id}','${name}')">💸 مسحوبات</button>
        <button class="btn btn-sm btn-warning" onclick="addPartnerAllowance('${id}','${name}')">📝 مخصصات</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="margin-bottom:var(--sp-5);">
      <div class="kpi-card" style="--kpi-color:#a78bfa">
        <span class="kpi-icon">🏦</span>
        <div class="kpi-value" style="color:#a78bfa">${formatCurrency(openingEquity)}</div>
        <div class="kpi-label">رأس المال المدخل</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#14b8a6">
        <span class="kpi-icon">💎</span>
        <div class="kpi-value" style="color:#14b8a6">${formatCurrency(profitShare)}</div>
        <div class="kpi-label">حصة الأرباح (${sharePercent}%)</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#f87171">
        <span class="kpi-icon">💸</span>
        <div class="kpi-value" style="color:#f87171">${formatCurrency(totalOut)}</div>
        <div class="kpi-label">إجمالي المسحوبات</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${balance>=0?'#4ade80':'#f87171'}">
        <span class="kpi-icon">⚖️</span>
        <div class="kpi-value" style="color:${balance>=0?'#4ade80':'#f87171'}">${formatCurrency(balance)}</div>
        <div class="kpi-label">الرصيد المستحق</div>
      </div>
    </div>

    <!-- تفاصيل الحساب -->
    <div class="grid-2" style="gap:var(--sp-4);">
      <div class="card">
        <div class="card-header"><span class="card-title">📊 ملخص الحساب</span></div>
        <div class="stat-row">
          <span class="stat-label">🏦 رأس مال افتتاحي</span>
          <span class="stat-value">${formatCurrency(openingEquity)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">💎 حصة من الأرباح</span>
          <span class="stat-value positive">${formatCurrency(profitShare)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">= إجمالي الحقوق</span>
          <span class="stat-value positive" style="font-size:16px;">${formatCurrency(totalRights)}</span>
        </div>
        <hr>
        <div class="stat-row">
          <span class="stat-label">💸 مسحوبات</span>
          <span class="stat-value negative">(${formatCurrency(totalWithdrawals)})</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">📝 مخصصات</span>
          <span class="stat-value negative">(${formatCurrency(totalAllws)})</span>
        </div>
        <hr>
        <div class="stat-row" style="font-size:16px;">
          <span style="font-weight:800;">الرصيد المستحق</span>
          <span style="font-weight:800;font-size:18px;color:${balance>=0?'#4ade80':'#f87171'};">${formatCurrency(balance)}</span>
        </div>
        <p style="font-size:11px;color:var(--c-text-muted);margin-top:8px;">
          صافي الربح الكلي: ${formatCurrency(netProfit)} | حصة ${sharePercent}%
        </p>
      </div>

      <!-- حركات الحساب -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📒 سجل الحركات</span>
          <span class="badge badge-teal">${(accounts||[]).length} حركة</span>
        </div>
        ${!(accounts||[]).length
          ? `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا توجد حركات بعد</p>`
          : `<div style="max-height:280px;overflow-y:auto;">
              ${(accounts||[]).map(a => {
                const typeMap = {
                  withdrawal: { icon:'💸', label:'مسحوبات', color:'#f87171', amount: a.withdrawal_amount },
                  allowance:  { icon:'📝', label:'مخصصات',  color:'#fbbf24', amount: a.allowance },
                  absence_deduction: { icon:'⛔', label:'خصم غياب', color:'#f87171', amount: a.absence_deduction }
                };
                const t = typeMap[a.type] || { icon:'⚡', label:a.type, color:'var(--c-text-muted)', amount:0 };
                return `
                  <div class="row" style="justify-content:space-between;">
                    <div>
                      <div style="font-weight:600;font-size:14px;">${t.icon} ${t.label}</div>
                      <div style="font-size:11px;color:var(--c-text-muted);">${formatDate(a.created_at)}</div>
                    </div>
                    <span style="color:${t.color};font-weight:700;">${formatCurrency(t.amount||0)}</span>
                  </div>`;
              }).join('')}
             </div>`}
      </div>
    </div>
  `;
};

window.addPartnerWithdrawal = async function(partnerId, partnerName) {
  inputModal({
    title: `💸 تسجيل مسحوبات – ${partnerName}`,
    fields: [
      { id:'amount', label:'المبلغ المسحوب', type:'number', min:0.01, step:0.01, required:true }
    ],
    submitLabel: '✅ تسجيل المسحوبات',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("partner_current_accounts", {
        partner_id:        partnerId,
        type:              "withdrawal",
        withdrawal_amount: vals.amount
      });
      if (!inserted) throw new Error("فشل تسجيل المسحوبات");
      await addAuditLog("partner_withdrawal", { partnerId, amount: vals.amount });
      closeModal();
      toast(`تم تسجيل مسحوبات ${formatCurrency(vals.amount)}`, "success");
      openPartner(partnerId, partnerName);
    }
  });
};

window.addPartnerAllowance = async function(partnerId, partnerName) {
  inputModal({
    title: `📝 تسجيل مخصصات – ${partnerName}`,
    fields: [
      { id:'amount', label:'المبلغ', type:'number', min:0.01, step:0.01, required:true }
    ],
    submitLabel: '✅ تسجيل المخصصات',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("partner_current_accounts", {
        partner_id: partnerId,
        type:       "allowance",
        allowance:  vals.amount
      });
      if (!inserted) throw new Error("فشل تسجيل المخصصات");
      await addAuditLog("partner_allowance", { partnerId, amount: vals.amount });
      closeModal();
      toast(`تم تسجيل مخصصات ${formatCurrency(vals.amount)}`, "success");
      openPartner(partnerId, partnerName);
    }
  });
};
