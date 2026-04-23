import { supabase, dbInsert } from "../data.js";

export async function renderSuppliersPage(app) {
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>🚚 الموردين</h2>
      <button class="btn" onclick="openAddSupplier()">➕ إضافة مورد</button>
    </div>
    ${!suppliers?.length ? empty("لا يوجد موردين") : suppliers.map(renderCard).join("")}
  `;
}

function renderCard(s) {
  return `
    <div class="card">
      <h3>${s.name}</h3>
      <p>📞 ${s.phone || "-"}</p>
      <button class="btn btn-sm" onclick="openSupplier('${s.id}','${s.name}')">📂 عرض الحساب</button>
    </div>
  `;
}

window.openAddSupplier = function() {
  const name = prompt("اسم المورد");
  const phone = prompt("رقم الهاتف");
  if (!name) return;
  addSupplier(name, phone);
};

async function addSupplier(name, phone) {
  const ok = await dbInsert("suppliers", { name, phone });
  if (ok) { alert("تم إضافة المورد"); navigate("suppliers"); }
}

window.openSupplier = async function(supplierId, supplierName) {
  const app = document.getElementById("app");
  const { data: invoices } = await supabase.from("invoices").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
  const balance = calculateBalance(invoices);

  app.innerHTML = `
    <button class="btn btn-sm" onclick="navigate('suppliers')">⬅️ رجوع</button>
    <h2>📊 حساب المورد: ${supplierName}</h2>
    <div class="card"><h3>الرصيد: ${balance.toLocaleString("ar-EG")} ج</h3></div>
    ${renderInvoices(invoices)}
  `;
};

function calculateBalance(invoices) {
  let total = 0;
  (invoices || []).forEach(inv => { if (inv.status === "closed") total += inv.net || 0; });
  return total;
}

function renderInvoices(invoices) {
  if (!invoices?.length) return empty("لا توجد فواتير");
  return `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>الحالة</th><th>الصافي</th></tr></thead>
        <tbody>
          ${invoices.map(inv => `<tr><td>${inv.date}</td><td>${status(inv.status)}</td><td>${(inv.net || 0).toLocaleString("ar-EG")} ج</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function status(s) {
  if (s === "closed") return '<span class="badge badge-red">منتهية</span>';
  if (s === "confirmed") return '<span class="badge badge-green">معتمدة</span>';
  return '<span class="badge badge-yellow">مسودة</span>';
}

function empty(msg) { return `<p style="text-align:center;color:#6b7280">${msg}</p>`; }
