import { supabase, dbInsert, dbUpdate, confirmInvoice, addAuditLog } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate } from "../ui.js";

export async function renderInvoicesPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const counts = { draft:0, confirmed:0, closed:0 };
  (invoices||[]).forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">📄 الفواتير</div>
        <div class="page-subtitle">
          <span class="badge badge-yellow">${counts.draft} مسودة</span>&nbsp;
          <span class="badge badge-green">${counts.confirmed} معتمدة</span>&nbsp;
          <span class="badge badge-red">${counts.closed} منتهية</span>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openCreateInvoice()">➕ فاتورة جديدة</button>
      </div>
    </div>

    <div class="filter-bar" id="inv-filter">
      <button class="filter-pill active" data-filter="all" onclick="filterInvoices('all')">الكل</button>
      <button class="filter-pill" data-filter="confirmed" onclick="filterInvoices('confirmed')">معتمدة</button>
      <button class="filter-pill" data-filter="draft"     onclick="filterInvoices('draft')">مسودة</button>
      <button class="filter-pill" data-filter="closed"    onclick="filterInvoices('closed')">منتهية</button>
    </div>

    <div id="invoices-list">
      ${renderInvoiceCards(invoices||[])}
    </div>
  `;

  window._allInvoices = invoices || [];
}

function renderInvoiceCards(list) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <div class="empty-title">لا توجد فواتير</div>
      <div class="empty-sub">أنشئ أول فاتورة للبدء في تسجيل البضاعة</div>
      <button class="btn" onclick="openCreateInvoice()">➕ فاتورة جديدة</button>
    </div>`;

  return list.map(inv => {
    const statusMap = {
      confirmed: { badge:'badge-green', label:'معتمدة ✓', border:'rgba(34,197,94,0.2)' },
      closed:    { badge:'badge-red',   label:'منتهية 🔒', border:'rgba(239,68,68,0.2)' },
      draft:     { badge:'badge-yellow',label:'مسودة',    border:'rgba(245,158,11,0.2)' }
    };
    const s = statusMap[inv.status] || statusMap.draft;

    return `
      <div class="card" style="border-color:${s.border};cursor:pointer;" onclick="openInvoice('${inv.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--sp-3);">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:6px;">
              <span style="font-weight:700;font-size:16px;">🚚 ${inv.supplier_name}</span>
              <span class="badge ${s.badge}">${s.label}</span>
            </div>
            <div style="font-size:13px;color:var(--c-text-muted);">
              📅 ${formatDate(inv.date)}
              ${inv.gross ? ` &nbsp;|&nbsp; 📦 ${formatCurrency(inv.gross)}` : ''}
              ${inv.commission ? ` &nbsp;|&nbsp; 💎 ${formatCurrency(inv.commission)}` : ''}
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openInvoice('${inv.id}')">فتح →</button>
        </div>
      </div>`;
  }).join('');
}

window.filterInvoices = function(filter) {
  document.querySelectorAll('#inv-filter .filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.filter === filter);
  });
  const list = filter === 'all'
    ? (window._allInvoices||[])
    : (window._allInvoices||[]).filter(i => i.status === filter);
  document.getElementById('invoices-list').innerHTML = renderInvoiceCards(list);
};

window.openCreateInvoice = async function() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: suppliers } = await supabase
    .from("suppliers").select("id,name").eq("user_id",user.id).order("name");

  if (!suppliers?.length) {
    toast("يرجى إضافة موردين أولاً من صفحة الموردين", "warning");
    return;
  }

  inputModal({
    title: '📄 فاتورة جديدة',
    fields: [
      { id:'supplier_id',      label:'المورد',         type:'select', required:true,
        options: suppliers.map(s=>({value:s.id, label:s.name})) },
      { id:'date',             label:'التاريخ',        type:'date',   value: new Date().toISOString().split("T")[0] },
      { id:'commission_rate',  label:'نسبة العمولة %', type:'number', min:0, step:0.5, value:7,
        hint:'مثال: 7 تعني 7%' },
      { id:'noulon',           label:'نولون (مصاريف نقل)',  type:'number', min:0, value:0 },
      { id:'mashal',           label:'مشال',           type:'number', min:0, value:0 },
      { id:'advance_payment',  label:'دفعة مقدمة',     type:'number', min:0, value:0 }
    ],
    submitLabel: '✅ إنشاء الفاتورة',
    onSubmit: async (vals) => {
      const supplier = suppliers.find(s=>s.id===vals.supplier_id);
      const inserted = await dbInsert("invoices", {
        supplier_id:     vals.supplier_id,
        supplier_name:   supplier?.name || '',
        date:            vals.date || new Date().toISOString().split("T")[0],
        status:          "draft",
        commission_rate: (vals.commission_rate||7) / 100,
        noulon:          vals.noulon   || 0,
        mashal:          vals.mashal   || 0,
        advance_payment: vals.advance_payment || 0
      });
      if (!inserted) throw new Error("فشل إنشاء الفاتورة");
      closeModal();
      toast("تم إنشاء الفاتورة بنجاح", "success");
      navigate("invoices");
    }
  });
};

window.openInvoice = async function(id) {
  const app = document.getElementById("app");

  const [{ data: invoice }, { data: products }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id",id).single(),
    supabase.from("invoice_products").select("*").eq("invoice_id",id).order("name")
  ]);

  if (!invoice) {
    app.innerHTML = `<div class="card"><h3 style="color:#f87171">الفاتورة غير موجودة</h3></div>`;
    return;
  }

  const isLocked = invoice.status !== "draft";
  const isClosed = invoice.status === "closed";

  const statusBadge = {
    draft:     `<span class="badge badge-yellow">مسودة</span>`,
    confirmed: `<span class="badge badge-green">معتمدة ✓</span>`,
    closed:    `<span class="badge badge-red">منتهية 🔒</span>`
  }[invoice.status] || '';

  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('invoices')" style="margin-bottom:var(--sp-4);">← رجوع</button>

    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🚚 ${invoice.supplier_name} ${statusBadge}</div>
        <div class="page-subtitle">📅 ${formatDate(invoice.date)}</div>
      </div>
      <div class="page-actions">
        ${!isClosed ? `<button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة</button>` : ''}
        ${invoice.status === 'draft' ? `<button class="btn" onclick="confirmInvoiceUI('${id}')">✅ اعتماد الفاتورة</button>` : ''}
        ${invoice.status === 'confirmed' ? `<button class="btn" onclick="navigate('sales')">🛒 بيع</button>` : ''}
      </div>
    </div>

    <!-- مصاريف الفاتورة -->
    <div class="card">
      <div class="card-header"><span class="card-title">⚙️ بيانات الفاتورة</span>
        ${!isLocked ? `<button class="btn btn-sm" onclick="saveExpenses('${id}')">💾 حفظ</button>` : ''}
      </div>
      <div class="grid-3" style="gap:var(--sp-3);">
        <div class="form-group" style="margin:0">
          <label>نولون</label>
          <input id="inv-noulon"   type="number" value="${invoice.noulon||0}"           ${isLocked?'disabled':''}>
        </div>
        <div class="form-group" style="margin:0">
          <label>مشال</label>
          <input id="inv-mashal"   type="number" value="${invoice.mashal||0}"           ${isLocked?'disabled':''}>
        </div>
        <div class="form-group" style="margin:0">
          <label>دفعة مقدمة</label>
          <input id="inv-advance"  type="number" value="${invoice.advance_payment||0}"  ${isLocked?'disabled':''}>
        </div>
      </div>
      ${invoice.status === 'closed' ? `
        <hr>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--sp-3);margin-top:var(--sp-3);">
          <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
            <div style="font-size:11px;color:var(--c-text-muted);">إجمالي المبيعات</div>
            <div style="font-weight:800;font-size:16px;color:#4ade80;">${formatCurrency(invoice.gross)}</div>
          </div>
          <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
            <div style="font-size:11px;color:var(--c-text-muted);">العمولة</div>
            <div style="font-weight:800;font-size:16px;color:#14b8a6;">${formatCurrency(invoice.commission)}</div>
          </div>
          <div style="text-align:center;padding:var(--sp-3);background:var(--c-surface-1);border-radius:var(--r-lg);">
            <div style="font-size:11px;color:var(--c-text-muted);">صافي المورد</div>
            <div style="font-weight:800;font-size:16px;color:#f87171;">${formatCurrency(invoice.net)}</div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- الأصناف -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">📦 الأصناف (${(products||[]).length})</span>
        ${!isLocked ? `<button class="btn btn-sm" onclick="openAddProduct('${id}')">➕ إضافة صنف</button>` : ''}
      </div>
      ${renderProductsTable(products, isLocked)}
    </div>
  `;
};

function renderProductsTable(products, isLocked) {
  if (!products?.length) return `
    <div class="empty-state" style="padding:30px">
      <div class="empty-icon" style="font-size:36px;">📦</div>
      <div class="empty-title" style="font-size:15px;">لا توجد أصناف</div>
    </div>`;

  return `
    <!-- Desktop -->
    <div class="table-wrapper table-desktop">
      <table class="table">
        <thead>
          <tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>مباع</th><th>مرتجع</th><th>متبقي</th></tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const rem = (p.qty||0) - (p.sold||0) - (p.returned||0);
            return `
              <tr>
                <td style="font-weight:600;">${p.name}</td>
                <td>${p.unit||'–'}</td>
                <td>${p.qty}</td>
                <td style="color:#f87171;">${p.sold||0}</td>
                <td style="color:#fbbf24;">${p.returned||0}</td>
                <td style="font-weight:700;color:${rem>0?'#5eead4':'#6b7280'};">${rem}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="mobile-card-list">
      ${products.map(p => {
        const rem = (p.qty||0) - (p.sold||0) - (p.returned||0);
        return `
          <div style="padding:var(--sp-3) 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:15px;">📦 ${p.name}</span>
              <span style="font-weight:700;color:${rem>0?'#5eead4':'#6b7280'};">متبقي: ${rem}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;font-size:12px;color:var(--c-text-muted);">
              <div>الكمية: <b style="color:var(--c-text-primary)">${p.qty}</b></div>
              <div>مباع: <b style="color:#f87171">${p.sold||0}</b></div>
              <div>مرتجع: <b style="color:#fbbf24">${p.returned||0}</b></div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

window.saveExpenses = async function(id) {
  const noulon  = Number(document.getElementById("inv-noulon")?.value  || 0);
  const mashal  = Number(document.getElementById("inv-mashal")?.value  || 0);
  const advance = Number(document.getElementById("inv-advance")?.value || 0);

  const updated = await dbUpdate("invoices", id, { noulon, mashal, advance_payment: advance });
  if (!updated) { toast("فشل حفظ المصاريف", "error"); return; }
  toast("تم حفظ المصاريف ✓", "success");
};

window.confirmInvoiceUI = async function(id) {
  confirmModal(
    "سيتم اعتماد الفاتورة وتحويلها للبيع. لا يمكن تعديلها بعد ذلك. هل تريد المتابعة؟",
    async () => {
      const result = await confirmInvoice(id);
      if (!result.success) {
        toast("فشل الاعتماد: " + (result.error||"خطأ غير معروف"), "error");
        return;
      }
      await addAuditLog("confirm_invoice", { invoiceId: id });
      toast("تم اعتماد الفاتورة ✓", "success");
      openInvoice(id);
    }
  );
};

window.openAddProduct = async function(invoiceId) {
  inputModal({
    title: '📦 إضافة صنف جديد',
    fields: [
      { id:'name', label:'اسم الصنف',  type:'text',   required:true, placeholder:'مثال: تفاح أحمر' },
      { id:'qty',  label:'الكمية',     type:'number', required:true, min:0.01, step:0.01 },
      { id:'unit', label:'الوحدة',     type:'select',
        options:[
          {value:'كرتون',label:'كرتون'},{value:'كيس',label:'كيس'},
          {value:'صندوق',label:'صندوق'},{value:'كيلو',label:'كيلو'},
          {value:'حبة',label:'حبة'},{value:'طرد',label:'طرد'}
        ]}
    ],
    submitLabel: '✅ إضافة الصنف',
    onSubmit: async (vals) => {
      const { data: existing } = await supabase
        .from("invoice_products").select("id")
        .eq("invoice_id", invoiceId).eq("name", vals.name).maybeSingle();
      if (existing) throw new Error("هذا الصنف موجود بالفعل في الفاتورة");

      const { error } = await supabase.from("invoice_products").insert({
        invoice_id: invoiceId,
        name: vals.name,
        qty:  vals.qty,
        unit: vals.unit || 'كرتون',
        sold: 0, returned: 0
      });
      if (error) throw new Error(error.message);
      closeModal();
      toast("تم إضافة الصنف ✓", "success");
      openInvoice(invoiceId);
    }
  });
};
