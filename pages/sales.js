import { supabase, dbUpdate, addAuditLog, sellProductAtomic } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate } from "../ui.js";

// ── إصلاح B4: import الدالة الذرية للمرتجع
async function returnProductAtomic(productId, qty) {
  const { data, error } = await supabase.rpc("return_product_atomic", {
    p_product_id: productId,
    p_qty:        qty,
    p_user_id:    (await supabase.auth.getUser()).data.user?.id
  });
  if (error) return { success:false, error:error.message };
  return { success:true };
}

export async function renderSalesPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "confirmed")        // فقط المعتمدة للبيع
    .order("date", { ascending: false });

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🛒 المبيعات</div>
        <div class="page-subtitle">${(invoices||[]).length} فاتورة مفتوحة للبيع</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="navigate('invoices')">📄 إدارة الفواتير</button>
      </div>
    </div>

    ${!(invoices||[]).length
      ? `<div class="empty-state">
           <div class="empty-icon">📭</div>
           <div class="empty-title">لا توجد فواتير مفتوحة</div>
           <div class="empty-sub">اعتمد فاتورة أولاً لتبدأ بالبيع منها</div>
           <button class="btn" onclick="navigate('invoices')">📄 إدارة الفواتير</button>
         </div>`
      : (invoices||[]).map(inv => `
          <div class="card" style="cursor:pointer;border-color:rgba(20,184,166,0.2);" onclick="openSalesInvoice('${inv.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:700;font-size:16px;">🚚 ${inv.supplier_name}</div>
                <div style="font-size:13px;color:var(--c-text-muted);">📅 ${formatDate(inv.date)}</div>
              </div>
              <button class="btn btn-sm" onclick="event.stopPropagation();openSalesInvoice('${inv.id}')">بيع →</button>
            </div>
          </div>`).join('')
    }
  `;
}

window.openSalesInvoice = async function(id) {
  const app = document.getElementById("app");

  const [{ data: invoice }, { data: products }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id",id).single(),
    supabase.from("invoice_products").select("*").eq("invoice_id",id).order("name")
  ]);

  if (!invoice) { toast("الفاتورة غير موجودة","error"); return; }

  const totalSold = (products||[]).reduce((s,p)=>s+(p.sold||0),0);
  const totalRem  = (products||[]).reduce((s,p)=>s+(p.qty-(p.sold||0)-(p.returned||0)),0);

  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('sales')" style="margin-bottom:var(--sp-4);">← رجوع</button>
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🛒 بيع من: ${invoice.supplier_name}</div>
        <div class="page-subtitle">📅 ${formatDate(invoice.date)}</div>
      </div>
    </div>

    <!-- Progress -->
    <div class="card" style="padding:var(--sp-4);">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
        <span style="color:var(--c-text-muted);">تقدم البيع</span>
        <span style="color:var(--c-brand-light);font-weight:700;">${totalSold} مباع • ${totalRem} متبقي</span>
      </div>
      <div style="background:rgba(255,255,255,0.06);border-radius:8px;height:8px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,var(--c-brand),var(--c-accent));height:100%;
          width:${totalSold+totalRem>0 ? Math.round(totalSold/(totalSold+totalRem)*100) : 0}%;
          border-radius:8px;transition:width 1s ease;"></div>
      </div>
    </div>

    <!-- Products -->
    <div id="sales-products-list">
      ${renderSalesProducts(products, id)}
    </div>
  `;
};

function renderSalesProducts(products, invoiceId) {
  if (!products?.length) return `
    <div class="empty-state"><div class="empty-icon">📦</div>
    <div class="empty-title">لا توجد أصناف في هذه الفاتورة</div></div>`;

  return `
    <!-- Desktop Table -->
    <div class="table-wrapper table-desktop">
      <table class="table">
        <thead>
          <tr><th>الصنف</th><th>الكمية</th><th>مباع</th><th>مرتجع</th><th>متبقي</th><th>إجراء</th></tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const rem = (p.qty||0) - (p.sold||0) - (p.returned||0);
            return `
              <tr>
                <td style="font-weight:600;">${p.name}
                  <div style="font-size:11px;color:var(--c-text-muted);">${p.unit||''}</div>
                </td>
                <td>${p.qty}</td>
                <td style="color:#f87171;">${p.sold||0}</td>
                <td style="color:#fbbf24;">${p.returned||0}</td>
                <td style="font-weight:800;color:${rem>0?'#5eead4':'#6b7280'};">${rem}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    ${rem > 0
                      ? `<button class="btn btn-sm" onclick="sellProduct('${p.id}','${invoiceId}')">💰 بيع</button>`
                      : `<span class="badge badge-red">نفذ</span>`}
                    ${(p.sold||0) > 0
                      ? `<button class="btn btn-sm btn-warning" onclick="returnProduct('${p.id}','${invoiceId}')">↩️</button>`
                      : ''}
                  </div>
                </td>
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
          <div class="card" style="padding:var(--sp-4);margin-bottom:var(--sp-3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3);">
              <div>
                <div style="font-weight:700;font-size:16px;">📦 ${p.name}</div>
                <div style="font-size:12px;color:var(--c-text-muted);">${p.unit||''}</div>
              </div>
              <div style="text-align:left;">
                <div style="font-size:22px;font-weight:800;color:${rem>0?'#5eead4':'#6b7280'};">${rem}</div>
                <div style="font-size:11px;color:var(--c-text-muted);">متبقي</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:var(--sp-3);font-size:12px;text-align:center;">
              <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                <div style="color:var(--c-text-muted);">الكمية</div>
                <div style="font-weight:700;">${p.qty}</div>
              </div>
              <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                <div style="color:#f87171;">مباع</div>
                <div style="font-weight:700;color:#f87171;">${p.sold||0}</div>
              </div>
              <div style="background:var(--c-surface-1);padding:6px;border-radius:8px;">
                <div style="color:#fbbf24;">مرتجع</div>
                <div style="font-weight:700;color:#fbbf24;">${p.returned||0}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              ${rem > 0
                ? `<button class="btn" style="flex:1;" onclick="sellProduct('${p.id}','${invoiceId}')">💰 تسجيل بيع</button>`
                : `<span class="badge badge-red" style="flex:1;justify-content:center;padding:10px;">نفذت الكمية</span>`}
              ${(p.sold||0) > 0
                ? `<button class="btn btn-warning btn-sm" onclick="returnProduct('${p.id}','${invoiceId}')">↩️ مرتجع</button>`
                : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

window.sellProduct = async function(productId, invoiceId) {
  if (window._saleLock) { toast("العملية قيد التنفيذ...","warning"); return; }

  const [{ data: customers }, { data: shops }] = await Promise.all([
    supabase.from("customers").select("id,full_name"),
    supabase.from("market_shops").select("id,name")
  ]);

  inputModal({
    title: '💰 تسجيل بيع',
    fields: [
      { id:'qty',   label:'الكمية', type:'number', min:0.01, step:0.01, required:true },
      { id:'price', label:'السعر',  type:'number', min:0.01, step:0.01, required:true },
      { id:'type',  label:'نوع البيع', type:'select', required:true, options:[
          {value:'cash',  label:'💵 كاش'},
          {value:'credit',label:'📋 آجل (عميل)'},
          {value:'shop',  label:'🏬 محل'}
        ]
      },
      { id:'customer_id', label:'العميل (للآجل)', type:'select',
        options:(customers||[]).map(c=>({value:c.id,label:c.full_name}))
      },
      { id:'shop_id', label:'المحل (لبيع المحل)', type:'select',
        options:(shops||[]).map(s=>({value:s.id,label:s.name}))
      }
    ],
    submitLabel: '✅ تأكيد البيع',
    onSubmit: async (vals) => {
      if (vals.type==='credit' && !vals.customer_id) throw new Error('اختر العميل للبيع الآجل');
      if (vals.type==='shop'   && !vals.shop_id)     throw new Error('اختر المحل');

      window._saleLock = true;
      try {
        const customerName = vals.customer_id
          ? (customers||[]).find(c=>c.id===vals.customer_id)?.full_name
          : null;

        const result = await sellProductAtomic({
          p_product_id:    productId,
          p_qty:           vals.qty,
          p_price:         vals.price,
          p_total:         vals.qty * vals.price,
          p_type:          vals.type,
          p_customer_id:   vals.customer_id  || null,
          p_shop_id:       vals.shop_id      || null,
          p_customer_name: customerName,
          p_invoice_id:    invoiceId,
          p_date:          new Date().toISOString().split("T")[0]
        });

        if (!result.success) throw new Error(result.error||"خطأ غير معروف");

        await addAuditLog("sell_product",{ productId, invoiceId,
          qty:vals.qty, price:vals.price, type:vals.type, customer_id:vals.customer_id });
        await checkInvoiceClose(invoiceId);
        closeModal();
        toast(`✅ تم البيع – ${formatCurrency(vals.qty*vals.price)}`,"success");
        openSalesInvoice(invoiceId);
      } finally {
        window._saleLock = false;
      }
    }
  });
};

window.returnProduct = async function(productId, invoiceId) {
  inputModal({
    title: '↩️ تسجيل مرتجع',
    fields: [
      { id:'qty', label:'الكمية المرتجعة', type:'number', min:0.01, step:0.01, required:true }
    ],
    submitLabel: '✅ تسجيل المرتجع',
    onSubmit: async (vals) => {
      // ✅ استخدام الدالة الذرية (Patch B4)
      const result = await returnProductAtomic(productId, vals.qty);
      if (!result.success) throw new Error(result.error);
      await addAuditLog("return_product",{ productId, invoiceId, qty:vals.qty });
      closeModal();
      toast("تم تسجيل المرتجع ✓","success");
      openSalesInvoice(invoiceId);
    }
  });
};

// ── إغلاق الفاتورة تلقائياً (Patch B: إصلاح المعادلة) ──
async function checkInvoiceClose(invoiceId) {
  const { data: products } = await supabase
    .from("invoice_products").select("*").eq("invoice_id", invoiceId);

  const allDone = (products||[]).every(p => {
    return ((p.qty||0) - (p.sold||0) - (p.returned||0)) <= 0;
  });

  if (!allDone) return;

  const { data: invoice } = await supabase
    .from("invoices").select("*").eq("id",invoiceId).single();
  if (!invoice || invoice.status !== 'confirmed') return;

  const gross = (products||[]).reduce((s,p)=>s+Number(p.sales_total||0),0);
  const commissionRate = invoice.commission_rate || 0.07;
  const commission     = gross * commissionRate;

  // ✅ المعادلة الصحيحة: مصاريف النقل فقط (noulon + mashal)
  // advance_payment يُطرح من مستحقات المورد، ليس من الإجمالي
  const transportExpenses = (invoice.noulon||0) + (invoice.mashal||0);
  const net = gross - commission - transportExpenses - (invoice.advance_payment||0);

  await dbUpdate("invoices", invoiceId, {
    status:         "closed",
    gross,
    commission,
    total_expenses: transportExpenses,
    net
  });

  await addAuditLog("close_invoice",{ invoiceId, gross, commission, net });
  toast(`🔒 تم إغلاق الفاتورة – عمولة: ${formatCurrency(commission)}`,"info", 5000);
}
