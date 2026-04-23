import { supabase, dbInsert, getCustomerBalance, getCustomerLedger, addAuditLog } from "../data.js";

export async function renderCustomersPage(app) {
  const { data: customers } = await supabase.from("customers").select("*").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header">
      <h2>👥 العملاء</h2>
      <button class="btn" onclick="openAddCustomer()">➕ إضافة عميل</button>
    </div>
    ${!customers?.length ? empty() : customers.map(renderCard).join("")}
  `;
}

function renderCard(c) {
  return `
    <div class="card">
      <h3>${c.full_name || c.name}</h3>
      <p>📞 ${c.phone || "-"}</p>
      <button class="btn btn-sm" onclick="openCustomer('${c.id}','${c.full_name || c.name}')">📂 عرض الحساب</button>
    </div>
  `;
}

window.openAddCustomer = async function() {
  const name = prompt("اسم العميل");
  const phone = prompt("الموبايل");
  const opening = Number(prompt("رصيد مبدئي") || 0);
  if (!name) return;
  await dbInsert("customers", { full_name: name, phone, opening_balance: opening });
  navigate("customers");
};

window.openCustomer = async function(id, name) {
  const app = document.getElementById("app");
  const ledger = await getCustomerLedger(id);
  const balance = await getCustomerBalance(id);

  app.innerHTML = `
    <button class="btn btn-sm" onclick="navigate('customers')">⬅️ رجوع</button>
    <h2>${name}</h2>
    <div class="card"><h3>🔵 الرصيد الحالي: ${(balance || 0).toLocaleString("ar-EG")} ج</h3></div>
    ${renderLedger(ledger)}
    <hr>
    <button class="btn btn-sm" onclick="recordCollection('${id}','${name}')">💰 تسجيل تحصيل</button>
    <button class="btn btn-sm btn-warning" onclick="recordAllowance('${id}','${name}')">📝 تسجيل مسموح</button>
  `;
};

window.recordCollection = async function(customerId, customerName) {
  const amount = Number(prompt("المبلغ المحصل"));
  if (!amount || amount <= 0) return;
  const balance = await getCustomerBalance(customerId);

  if (amount < balance) {
    const allowance = balance - amount;
    const confirmAllow = confirm(`المبلغ المحصل (${amount}) أقل من الرصيد (${balance}). الفرق (${allowance}) سيتم تسجيله كمسموح. متابعة؟`);
    if (!confirmAllow) return;
    await supabase.from("customer_allowances").insert({
      customer_id: customerId,
      amount: allowance,
      date: new Date().toISOString().split("T")[0],
      reason: "تسوية تحصيل"
    });
    await addAuditLog("customer_allowance", { customerId, allowance, reason: "تسوية تحصيل" });
  }

  await dbInsert("collections", { customer_id: customerId, amount, date: new Date().toISOString() });
  await addAuditLog("collection", { customerId, amount });
  alert("تم التسجيل");
  openCustomer(customerId, customerName);
};

window.recordAllowance = async function(customerId, customerName) {
  const amount = Number(prompt("قيمة المسموح"));
  if (!amount || amount <= 0) return;
  const reason = prompt("سبب المسموح") || "تسوية";
  await supabase.from("customer_allowances").insert({
    customer_id: customerId,
    amount,
    date: new Date().toISOString().split("T")[0],
    reason
  });
  await addAuditLog("customer_allowance", { customerId, amount, reason });
  alert("تم تسجيل المسموح");
  openCustomer(customerId, customerName);
};

function renderLedger(ledger) {
  if (!ledger?.length) return `<p style="text-align:center">لا توجد حركات</p>`;
  return `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
        <tbody>
          ${ledger.map(x => `<tr><td>${x.trx_date}</td><td>${x.description}</td><td>${x.debit}</td><td>${x.credit}</td><td>${x.running_balance}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function empty() { return `<p style="text-align:center;color:#6b7280">لا يوجد عملاء</p>`; }
