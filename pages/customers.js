import { supabase, dbInsert, getCustomerLedger, addAuditLog } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate, mobileCardTable } from "../ui.js";

export async function renderCustomersPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: customers }, { data: balances }] = await Promise.all([
    supabase.from("customers").select("*").eq("user_id",user.id).order("full_name"),
    supabase.from("customer_balances").select("customer_id,balance").eq("user_id",user.id)
  ]);

  const balMap = {};
  (balances||[]).forEach(b => { balMap[b.customer_id] = b.balance; });

  const totalReceivables = Object.values(balMap).filter(v=>v>0).reduce((s,v)=>s+v,0);

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">👥 العملاء</div>
        <div class="page-subtitle">${(customers||[]).length} عميل • ذمم: <span style="color:#f87171">${formatCurrency(totalReceivables)}</span></div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="showAgingReport()">📋 تقرير الديون</button>
        <button class="btn" onclick="openAddCustomer()">➕ عميل جديد</button>
      </div>
    </div>

    <div class="search-bar" style="position:relative;margin-bottom:var(--sp-4);">
      <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--c-text-muted);font-size:16px;pointer-events:none;">🔍</span>
      <input type="search" id="cust-search" placeholder="بحث بالاسم أو الهاتف..." style="padding-right:44px;"
        oninput="filterCustomers(this.value)">
    </div>

    <div id="customers-list">
      ${renderCustomerCards(customers||[], balMap)}
    </div>
  `;

  window._allCustomers = customers || [];
  window._balMap = balMap;
}

function renderCustomerCards(list, balMap) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">👥</div>
      <div class="empty-title">لا يوجد عملاء</div>
      <div class="empty-sub">أضف أول عميل للبدء</div>
      <button class="btn" onclick="openAddCustomer()">➕ إضافة عميل</button>
    </div>`;

  return list.map(c => {
    const bal = balMap[c.id] || 0;
    const balColor = bal > 0 ? '#f87171' : bal < 0 ? '#4ade80' : 'var(--c-text-muted)';
    const balLabel = bal > 0 ? 'مدين' : bal < 0 ? 'دائن' : 'صفر';
    return `
      <div class="card" style="cursor:pointer;" onclick="openCustomer('${c.id}','${(c.full_name||'').replace(/'/g,'&#39;')}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:16px;color:var(--c-text-primary);">
              👤 ${c.full_name}
            </div>
            ${c.phone ? `<div style="font-size:13px;color:var(--c-text-muted);margin-top:4px;">📞 ${c.phone}</div>` : ''}
          </div>
          <div style="text-align:left;">
            <div style="font-weight:800;font-size:17px;color:${balColor};">${formatCurrency(Math.abs(bal))}</div>
            <div style="font-size:11px;color:${balColor};text-align:center;">${balLabel}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.filterCustomers = function(q) {
  const list = window._allCustomers || [];
  const filtered = q
    ? list.filter(c =>
        (c.full_name||'').includes(q) || (c.phone||'').includes(q)
      )
    : list;
  document.getElementById("customers-list").innerHTML =
    renderCustomerCards(filtered, window._balMap || {});
};

window.openAddCustomer = async function() {
  inputModal({
    title: '👥 إضافة عميل جديد',
    fields: [
      { id:'full_name', label:'اسم العميل',    type:'text',   required:true },
      { id:'phone',     label:'الهاتف',         type:'tel',    placeholder:'05xxxxxxxx' },
      { id:'opening_balance', label:'رصيد مبدئي (اختياري)', type:'number', min:0, value:0,
        hint:'الرصيد الذي كان عليه العميل قبل استخدام البرنامج' }
    ],
    submitLabel: '✅ إضافة العميل',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("customers", {
        full_name: vals.full_name,
        phone: vals.phone || null,
        opening_balance: vals.opening_balance || 0
      });
      if (!inserted) throw new Error("فشل إضافة العميل");
      closeModal();
      toast(`تم إضافة العميل: ${vals.full_name}`, "success");
      navigate("customers");
    }
  });
};

window.openCustomer = async function(id, name) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('customers')" style="margin-bottom:var(--sp-4);">← رجوع</button>
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">👤 ${name}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-sm" onclick="recordCollection('${id}','${name}')">💰 تحصيل</button>
        <button class="btn btn-sm btn-warning" onclick="recordAllowance('${id}','${name}')">📝 مسموح</button>
        <button class="btn btn-sm btn-ghost" onclick="printStatement('${id}','${name}')">🖨️ طباعة</button>
      </div>
    </div>
    <div id="balance-card" class="card">
      <div class="skeleton skeleton-text" style="height:30px;width:200px;"></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">📒 كشف الحساب</span></div>
      <div id="ledger-container">
        ${[0,1,2].map(()=>`<div class="skeleton skeleton-text"></div>`).join('')}
      </div>
    </div>
  `;

  const [ledger, { data: custBal }] = await Promise.all([
    import("../data.js").then(m => m.getCustomerLedger(id)),
    supabase.from("customer_balances").select("*").eq("customer_id",id).single()
  ]);

  const bal = custBal?.balance || 0;
  const balColor = bal > 0 ? '#f87171' : bal < 0 ? '#4ade80' : 'var(--c-text-muted)';

  document.getElementById("balance-card").innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--sp-3);">
      <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
        <div style="font-size:11px;color:var(--c-text-muted);">الرصيد الحالي</div>
        <div style="font-size:22px;font-weight:800;color:${balColor};margin-top:4px;">${formatCurrency(Math.abs(bal))}</div>
        <div style="font-size:12px;color:${balColor};">${bal>0?'مدين':bal<0?'دائن':'سوّي'}</div>
      </div>
      <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
        <div style="font-size:11px;color:var(--c-text-muted);">إجمالي المبيعات</div>
        <div style="font-size:18px;font-weight:700;color:#f87171;margin-top:4px;">${formatCurrency(custBal?.total_sales||0)}</div>
      </div>
      <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
        <div style="font-size:11px;color:var(--c-text-muted);">إجمالي التحصيلات</div>
        <div style="font-size:18px;font-weight:700;color:#4ade80;margin-top:4px;">${formatCurrency(custBal?.total_collections||0)}</div>
      </div>
    </div>
  `;

  // Render ledger
  const lc = document.getElementById("ledger-container");
  if (!ledger?.length) {
    lc.innerHTML = `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا توجد حركات بعد</p>`;
    return;
  }

  lc.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>البيان</th>
            <th>مدين</th>
            <th>دائن</th>
            <th>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          ${ledger.map(x => {
            const rb = x.running_balance || 0;
            return `
              <tr>
                <td style="font-size:12px;">${x.trx_date||'–'}</td>
                <td>${x.description||'–'}</td>
                <td style="color:#f87171;">${x.debit>0?formatCurrency(x.debit):'–'}</td>
                <td style="color:#4ade80;">${x.credit>0?formatCurrency(x.credit):'–'}</td>
                <td style="font-weight:700;color:${rb>=0?'#f87171':'#4ade80'};">${formatCurrency(Math.abs(rb))}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="text-align:left;margin-top:var(--sp-3);padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-md);">
      <span style="color:var(--c-text-muted);font-size:13px;">الرصيد الختامي: </span>
      <span style="font-weight:800;font-size:16px;color:${bal>=0?'#f87171':'#4ade80'};">${formatCurrency(Math.abs(bal))}</span>
    </div>
  `;
};

window.recordCollection = async function(customerId, customerName) {
  const { data: custBal } = await supabase
    .from("customer_balances").select("balance").eq("customer_id",customerId).single();
  const currentBalance = custBal?.balance || 0;

  inputModal({
    title: `💰 تسجيل تحصيل – ${customerName}`,
    fields: [
      { id:'amount', label:'المبلغ المحصل', type:'number', min:0.01, step:0.01, required:true,
        hint: currentBalance > 0 ? `الرصيد الحالي: ${formatCurrency(currentBalance)}` : '' }
    ],
    submitLabel: '✅ تسجيل التحصيل',
    onSubmit: async (vals) => {
      const amount = vals.amount;

      // إذا المبلغ أقل من الرصيد – سنسجل مسموح تلقائياً
      if (currentBalance > 0 && amount < currentBalance) {
        const diff = currentBalance - amount;
        // نسجل المسموح أولاً
        await supabase.from("customer_allowances").insert({
          customer_id: customerId,
          amount: diff,
          date: new Date().toISOString().split("T")[0],
          reason: "تسوية تحصيل"
        });
        await addAuditLog("customer_allowance", { customerId, allowance: diff, reason:"تسوية تحصيل" });
      }

      const inserted = await dbInsert("collections", {
        customer_id: customerId,
        amount,
        date: new Date().toISOString()
      });
      if (!inserted) throw new Error("فشل تسجيل التحصيل");

      await addAuditLog("collection", { customerId, amount });
      closeModal();
      toast(`✅ تم تسجيل تحصيل ${formatCurrency(amount)}`, "success");
      openCustomer(customerId, customerName);
    }
  });
};

window.recordAllowance = async function(customerId, customerName) {
  inputModal({
    title: `📝 تسجيل مسموح – ${customerName}`,
    fields: [
      { id:'amount', label:'قيمة المسموح', type:'number', min:0.01, step:0.01, required:true },
      { id:'reason', label:'السبب',         type:'text',   placeholder:'مثال: بضاعة تالفة' }
    ],
    submitLabel: '✅ تسجيل المسموح',
    onSubmit: async (vals) => {
      const { error } = await supabase.from("customer_allowances").insert({
        customer_id: customerId,
        amount: vals.amount,
        date: new Date().toISOString().split("T")[0],
        reason: vals.reason || 'تسوية'
      });
      if (error) throw new Error(error.message);
      await addAuditLog("customer_allowance", { customerId, ...vals });
      closeModal();
      toast("تم تسجيل المسموح", "success");
      openCustomer(customerId, customerName);
    }
  });
};

window.printStatement = function(id, name) {
  window.print();
};

window.showAgingReport = async function() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: balances } = await supabase
    .from("customer_balances")
    .select("*")
    .eq("user_id", user.id)
    .gt("balance", 0)
    .order("balance", { ascending:false });

  const total = (balances||[]).reduce((s,b)=>s+Number(b.balance||0),0);

  import("../ui.js").then(({ modal }) => {
    modal(`
      <h3 class="modal-title">📋 تقرير أعمار الديون</h3>
      <div style="display:flex;justify-content:space-between;padding:12px;background:rgba(239,68,68,0.1);border-radius:12px;margin-bottom:16px;">
        <span style="font-weight:700;">إجمالي الذمم</span>
        <span style="color:#f87171;font-weight:800;font-size:18px;">${formatCurrency(total)}</span>
      </div>
      <div style="max-height:380px;overflow-y:auto;">
        ${(balances||[]).length === 0
          ? `<p style="text-align:center;color:var(--c-text-muted);padding:30px;">✅ لا توجد ديون مستحقة</p>`
          : (balances||[]).map((b,i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="font-weight:600;font-size:14px;">${i+1}. ${b.full_name}</div>
              <div style="color:#f87171;font-weight:700;font-size:15px;">${formatCurrency(b.balance)}</div>
            </div>`).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="window.print()">🖨️ طباعة</button>
        <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
      </div>
    `);
  });
};
