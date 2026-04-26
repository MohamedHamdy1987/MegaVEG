import { supabase, dbInsert, addAuditLog, ensureUser } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency, formatDate } from "../ui.js";

export async function renderMarketShopsPage(app) {
  const user = await ensureUser();

  const { data: shops } = await supabase
    .from("market_shops")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🏬 محلات السوق</div>
        <div class="page-subtitle">${(shops||[]).length} محل مسجل</div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openAddShop()">➕ إضافة محل</button>
      </div>
    </div>

    <div id="shops-list">
      ${renderShopCards(shops||[])}
    </div>
  `;
}

function renderShopCards(list) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">🏬</div>
      <div class="empty-title">لا يوجد محلات</div>
      <div class="empty-sub">أضف محلات السوق لتتبع حسابها</div>
      <button class="btn" onclick="openAddShop()">➕ إضافة محل</button>
    </div>`;

  return list.map(s => `
    <div class="card" style="cursor:pointer;" onclick="openShop('${s.id}','${(s.name||'').replace(/'/g,"&#39;")}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:16px;">🏬 ${s.name}</div>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openShop('${s.id}','${(s.name||'').replace(/'/g,"&#39;")}')">
          حساب →
        </button>
      </div>
    </div>`).join('');
}

window.openAddShop = async function() {
  inputModal({
    title: '🏬 إضافة محل جديد',
    fields: [
      { id:'name', label:'اسم المحل', type:'text', required:true, placeholder:'مثال: محل أبو أحمد' }
    ],
    submitLabel: '✅ إضافة المحل',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("market_shops", { name: vals.name });
      if (!inserted) throw new Error("فشل إضافة المحل");
      closeModal();
      toast(`تم إضافة المحل: ${vals.name}`, "success");
      navigate("market_shops");
    }
  });
};

window.openShop = async function(id, name) {
  const app = document.getElementById("app");
  const user = await ensureUser();

  const [{ data: credits }, { data: debits }] = await Promise.all([
    supabase.from("shop_credits").select("*").eq("shop_id",id).eq("user_id",user.id).order("date",{ascending:false}),
    supabase.from("shop_debits").select("*").eq("shop_id",id).eq("user_id",user.id).order("created_at",{ascending:false})
  ]);

  const totalCredit = (credits||[]).reduce((s,x)=>s+Number(x.amount||0),0);
  const totalDebit  = (debits||[]).reduce((s,x) =>s+Number(x.total||0),0);
  const balance     = totalCredit - totalDebit;

  app.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="navigate('market_shops')" style="margin-bottom:var(--sp-4);">← رجوع</button>

    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🏬 ${name}</div>
        <div class="page-subtitle">حساب المحل</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-sm" onclick="openAddDebit('${id}','${name}')">➕ بضاعة عليهم</button>
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="margin-bottom:var(--sp-5);">
      <div class="kpi-card" style="--kpi-color:#4ade80">
        <span class="kpi-icon">🟢</span>
        <div class="kpi-value" style="color:#4ade80">${formatCurrency(totalCredit)}</div>
        <div class="kpi-label">لنا (من بيعاتهم)</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#f87171">
        <span class="kpi-icon">🔴</span>
        <div class="kpi-value" style="color:#f87171">${formatCurrency(totalDebit)}</div>
        <div class="kpi-label">عليهم (بضاعة أخذوها)</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${balance>=0?'#14b8a6':'#f87171'}">
        <span class="kpi-icon">⚖️</span>
        <div class="kpi-value" style="color:${balance>=0?'#14b8a6':'#f87171'}">${formatCurrency(Math.abs(balance))}</div>
        <div class="kpi-label">${balance>=0?'الرصيد لصالحنا':'الرصيد علينا'}</div>
      </div>
    </div>

    <div class="grid-2" style="gap:var(--sp-4);">
      <!-- لنا: مبيعاتهم التي سجلنا فيها عمولة -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🟢 لنا – من مبيعاتهم</span>
          <span class="badge badge-green">${(credits||[]).length} حركة</span>
        </div>
        ${!(credits||[]).length
          ? `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا يوجد</p>`
          : `<div class="table-wrapper table-desktop">
              <table class="table">
                <thead><tr><th>التاريخ</th><th>المبلغ</th><th>المصدر</th></tr></thead>
                <tbody>
                  ${(credits||[]).map(x=>`
                    <tr>
                      <td style="font-size:12px;">${formatDate(x.date||x.created_at)}</td>
                      <td style="color:#4ade80;font-weight:700;">${formatCurrency(x.amount)}</td>
                      <td style="font-size:12px;">${x.source==='sale'?'بيع':'–'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
             </div>
             <div class="mobile-card-list">
               ${(credits||[]).map(x=>`
                 <div class="row" style="justify-content:space-between;">
                   <div style="font-size:12px;color:var(--c-text-muted);">${formatDate(x.date||x.created_at)}</div>
                   <span style="color:#4ade80;font-weight:700;">${formatCurrency(x.amount)}</span>
                 </div>`).join('')}
             </div>`}
      </div>

      <!-- عليهم: بضاعة أخذوها -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔴 عليهم – بضاعة أخذوها</span>
          <span class="badge badge-red">${(debits||[]).length} حركة</span>
        </div>
        ${!(debits||[]).length
          ? `<p style="text-align:center;color:var(--c-text-muted);padding:20px;">لا يوجد</p>`
          : `<div class="table-wrapper table-desktop">
              <table class="table">
                <thead><tr><th>الصنف</th><th>ك</th><th>سعر</th><th>إجمالي</th><th>نوع</th></tr></thead>
                <tbody>
                  ${(debits||[]).map(x=>`
                    <tr>
                      <td style="font-weight:600;">${x.product_name}</td>
                      <td>${x.qty}</td>
                      <td>${formatCurrency(x.price)}</td>
                      <td style="color:#f87171;font-weight:700;">${formatCurrency(x.total)}</td>
                      <td>${x.type==='credit'
                        ? `<span class="badge badge-yellow">آجل</span>`
                        : `<span class="badge badge-green">كاش</span>`}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
             </div>
             <div class="mobile-card-list">
               ${(debits||[]).map(x=>`
                 <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                   <div style="display:flex;justify-content:space-between;align-items:center;">
                     <span style="font-weight:600;font-size:14px;">📦 ${x.product_name}</span>
                     <span style="color:#f87171;font-weight:700;">${formatCurrency(x.total)}</span>
                   </div>
                   <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px;">
                     ${x.qty} × ${formatCurrency(x.price)}
                     &nbsp;|&nbsp;
                     ${x.type==='credit'
                       ? '<span class="badge badge-yellow" style="font-size:10px;">آجل</span>'
                       : '<span class="badge badge-green" style="font-size:10px;">كاش</span>'}
                   </div>
                 </div>`).join('')}
             </div>`}
      </div>
    </div>
  `;
};

window.openAddDebit = async function(shopId, shopName) {
  const user = await ensureUser();
  const { data: customers } = await supabase
    .from("customers").select("id,full_name").eq("user_id",user.id).order("full_name");

  inputModal({
    title: `🔴 تسجيل بضاعة عليهم – ${shopName}`,
    fields: [
      { id:'product_name', label:'اسم الصنف',  type:'text',   required:true },
      { id:'qty',          label:'الكمية',      type:'number', min:0.01, step:0.01, required:true },
      { id:'price',        label:'السعر',       type:'number', min:0.01, step:0.01, required:true },
      { id:'type',         label:'نوع البيع',   type:'select', required:true, options:[
          {value:'cash',  label:'💵 كاش'},
          {value:'credit',label:'📋 آجل (عميل)'}
        ]
      },
      { id:'customer_id',  label:'العميل (للآجل)', type:'select',
        options: (customers||[]).map(c=>({value:c.id, label:c.full_name}))
      }
    ],
    submitLabel: '✅ تسجيل البضاعة',
    onSubmit: async (vals) => {
      if (vals.type==='credit' && !vals.customer_id) throw new Error('اختر العميل للبيع الآجل');

      const total   = vals.qty * vals.price;
     
      const custObj = (customers||[]).find(c=>c.id===vals.customer_id);

      const inserted = await dbInsert("shop_debits", {
        shop_id:       shopId,
        product_name:  vals.product_name,
        qty:           vals.qty,
        price:         vals.price,
        total,
        type:          vals.type,
        customer_id:   vals.customer_id   || null,
        customer_name: custObj?.full_name || null
      });
      if (!inserted) throw new Error("فشل تسجيل البضاعة");

      // إضافة سجل في daily_sales إذا كان البيع آجل مع الحقول المطلوبة
      if (vals.type === 'credit') {
        const { error: salesErr } = await supabase
          .from("daily_sales")
          .insert({
            user_id: user.id,
            shop_id: shopId,
            customer_id: vals.customer_id,
            customer_name: custObj?.full_name || null,
            sale_type: 'shop_credit',
            total: total,
            date: new Date().toISOString().split("T")[0]
          });

        if (salesErr) {
          throw new Error(salesErr.message);
        }
      }

      await addAuditLog("shop_debit", { shopId, shopName, ...vals, total });
      closeModal();
      toast(`تم تسجيل ${formatCurrency(total)}`, "success");
      openShop(shopId, shopName);
    }
  });
};