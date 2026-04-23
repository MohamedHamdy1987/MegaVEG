import { supabase, dbInsert, dbUpdate, confirmInvoice } from "../data.js";

export async function renderInvoicesPage(app) {
  const { data: invoices } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>📄 الفواتير</h2>
      <button class="btn" onclick="openCreateInvoice()">➕ فاتورة جديدة</button>
    </div>
    ${!invoices?.length ? empty() : invoices.map(renderCard).join("")}
  `;
}

function renderCard(inv) {
  const statusBadge = inv.status === "confirmed" ? '<span class="badge badge-green">معتمدة</span>'
    : inv.status === "closed" ? '<span class="badge badge-red">منتهية</span>'
    : '<span class="badge badge-yellow">مسودة</span>';

  return `
    <div class="card">
      <h3>${inv.supplier_name} ${statusBadge}</h3>
      <p>📅 ${inv.date} | 💰 الصافي: ${(inv.net || 0).toLocaleString("ar-EG")} ج</p>
      <button class="btn btn-sm" onclick="openInvoice('${inv.id}')">📂 فتح</button>
    </div>
  `;
}

window.openCreateInvoice = async function() {
  const name = prompt("اسم المورد");
  if (!name) return;
  const { data: supplier } = await supabase.from("suppliers").select("*").eq("name", name).single();
  if (!supplier) { alert("المورد غير موجود"); return; }
  await dbInsert("invoices", {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    date: new Date().toISOString().split("T")[0],
    status: "draft",
    noulon: 0,
    mashal: 0,
    advance_payment: 0,
    commission_rate: 0.07
  });
  alert("تم إنشاء الفاتورة");
  navigate("invoices");
};

window.openInvoice = async function(id) {
  const app = document.getElementById("app");
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: products } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);

  const isLocked = invoice.status === "confirmed" || invoice.status === "closed";

  app.innerHTML = `
    <button class="btn btn-sm" onclick="navigate('invoices')">⬅️ رجوع</button>
    <h2>فاتورة: ${invoice.supplier_name}</h2>
    <div class="grid grid-3">
      <div><label>نولون</label><input id="noulon" value="${invoice.noulon}" ${isLocked ? "disabled" : ""}></div>
      <div><label>مشال</label><input id="mashal" value="${invoice.mashal}" ${isLocked ? "disabled" : ""}></div>
      <div><label>دفعة مقدمة</label><input id="advance" value="${invoice.advance_payment}" ${isLocked ? "disabled" : ""}></div>
    </div>
    ${!isLocked ? `<button class="btn btn-sm" onclick="saveExpenses('${id}')">💾 حفظ المصاريف</button>` : ""}
    <hr>
    ${!isLocked ? `<button class="btn" onclick="openAddProduct('${id}')">➕ إضافة صنف</button>` : ""}
    <div class="table-wrapper">${renderProducts(products)}</div>
    ${invoice.status === "draft" ? `<button class="btn" onclick="confirmInvoiceUI('${id}')">✅ اعتماد الفاتورة</button>` : `<h3 style="color:#5eead4">✔ تم الاعتماد</h3>`}
  `;
};

window.saveExpenses = async function(id) {
  const noulon = Number(document.getElementById("noulon").value);
  const mashal = Number(document.getElementById("mashal").value);
  const advance = Number(document.getElementById("advance").value);
  await dbUpdate("invoices", id, { noulon, mashal, advance_payment: advance });
  alert("تم الحفظ");
};

window.confirmInvoiceUI = async function(id) {
  if (!confirm("تأكيد اعتماد الفاتورة؟ لا يمكن التعديل بعد الاعتماد.")) return;
  const done = await confirmInvoice(id);
  if (!done) { alert("فشل الاعتماد"); return; }
  alert("تم الترحيل والاعتماد");
  openInvoice(id);
};

window.openAddProduct = function(invoiceId) {
  const name = prompt("اسم الصنف");
  const qty = Number(prompt("العدد"));
  const unit = prompt("الوحدة");
  if (!name || !qty) return;
  addProduct(invoiceId, name, qty, unit);
};

async function addProduct(invoiceId, name, qty, unit) {
  await supabase.from("invoice_products").insert({ invoice_id: invoiceId, name, qty, unit, sold: 0, returned: 0 });
  alert("تم إضافة الصنف");
  openInvoice(invoiceId);
}

function renderProducts(products) {
  if (!products?.length) return empty("لا توجد أصناف");
  return `
    <table class="table">
      <thead><tr><th>الصنف</th><th>الكمية</th><th>مباع</th><th>مرتجع</th><th>متبقي</th></tr></thead>
      <tbody>
        ${products.map(p => {
          const remain = p.qty - p.sold - (p.returned || 0);
          return `<tr><td>${p.name}</td><td>${p.qty}</td><td>${p.sold}</td><td>${p.returned || 0}</td><td style="color:${remain > 0 ? '#5eead4' : '#fca5a5'}">${remain}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function empty(msg = "لا يوجد بيانات") { return `<p style="text-align:center;color:#6b7280">${msg}</p>`; }
