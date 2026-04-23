import { supabase, dbInsert, addAuditLog } from "../data.js";

export async function renderPartnersPage(app) {
  const { data: partners } = await supabase.from("partners").select("*").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header"><h2>🤝 الشركاء</h2><button class="btn" onclick="openAddPartner()">➕ إضافة شريك</button></div>
    ${!partners?.length ? '<p style="text-align:center;color:#6b7280">لا يوجد شركاء</p>' : partners.map(renderPartnerCard).join("")}
  `;
}

function renderPartnerCard(p) {
  return `
    <div class="card">
      <h3>${p.name}</h3>
      <p>📞 ${p.phone || "-"} | حصة: ${(p.profit_share || 0)}%</p>
      <button class="btn btn-sm" onclick="openPartner('${p.id}','${p.name}')">📂 فتح الحساب</button>
    </div>`;
}

window.openAddPartner = async function() {
  const name = prompt("اسم الشريك");
  const phone = prompt("الموبايل");
  const share = Number(prompt("نسبة الربح %"));
  if (!name) return;
  await dbInsert("partners", { name, phone, profit_share: share });
  navigate("partners");
};

window.openPartner = async function(id, name) {
  const app = document.getElementById("app");
  const { data: partner } = await supabase.from("partners").select("*").eq("id", id).single();
  const { data: accounts } = await supabase.from("partner_current_accounts").select("*").eq("partner_id", id).order("created_at", { ascending: false });

  let totalWithdrawals = 0, totalAllowances = 0, totalDeductions = 0;
  (accounts || []).forEach(a => {
    totalWithdrawals += Number(a.withdrawal_amount || 0);
    totalAllowances += Number(a.allowance || 0);
    totalDeductions += Number(a.absence_deduction || 0);
  });

  const profitShare = await calculatePartnerProfitShare(partner?.profit_share || 0);
  const balance = profitShare - totalWithdrawals;

  app.innerHTML = `
    <button class="btn btn-sm" onclick="navigate('partners')">⬅️ رجوع</button>
    <h2>حساب الشريك: ${name}</h2>
    <div class="grid grid-3">
      <div class="card"><h4>حصة الأرباح</h4><h2>${profitShare.toLocaleString("ar-EG")} ج</h2></div>
      <div class="card"><h4>المسحوبات</h4><h2 style="color:#fca5a5">${totalWithdrawals.toLocaleString("ar-EG")} ج</h2></div>
      <div class="card"><h4>الرصيد المستحق</h4><h2 style="color:${balance >= 0 ? '#5eead4' : '#fca5a5'}">${balance.toLocaleString("ar-EG")} ج</h2></div>
    </div>
    <hr>
    <button class="btn btn-sm" onclick="addPartnerWithdrawal('${id}')">💸 تسجيل مسحوبات</button>
    <button class="btn btn-sm btn-warning" onclick="addPartnerAllowance('${id}')">📝 تسجيل مخصصات</button>
    <hr>
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${(accounts || []).map(a => `<tr><td>${a.created_at?.split("T")[0]}</td><td>${a.type}</td><td>${(a.withdrawal_amount || a.allowance || 0).toLocaleString("ar-EG")} ج</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
};

window.addPartnerWithdrawal = async function(partnerId) {
  const amount = Number(prompt("المبلغ"));
  if (!amount || amount <= 0) return;
  await dbInsert("partner_current_accounts", { partner_id: partnerId, type: "withdrawal", withdrawal_amount: amount });
  await addAuditLog("partner_withdrawal", { partnerId, amount });
  alert("تم التسجيل");
  const { data: p } = await supabase.from("partners").select("*").eq("id", partnerId).single();
  openPartner(partnerId, p.name);
};

window.addPartnerAllowance = async function(partnerId) {
  const amount = Number(prompt("المبلغ"));
  if (!amount || amount <= 0) return;
  await dbInsert("partner_current_accounts", { partner_id: partnerId, type: "allowance", allowance: amount });
  await addAuditLog("partner_allowance", { partnerId, amount });
  alert("تم التسجيل");
  const { data: p } = await supabase.from("partners").select("*").eq("id", partnerId).single();
  openPartner(partnerId, p.name);
};

async function calculatePartnerProfitShare(sharePercent) {
  const { data: invoices } = await supabase.from("invoices").select("*").eq("status", "closed");
  let totalCommission = 0;
  (invoices || []).forEach(inv => totalCommission += Number(inv.commission || 0));

  const { data: allowances } = await supabase.from("customer_allowances").select("*");
  let totalAllowances = 0;
  (allowances || []).forEach(a => totalAllowances += Number(a.amount || 0));

  const { data: opExpenses } = await supabase.from("operating_expenses").select("*");
  let totalOpExpenses = 0;
  (opExpenses || []).forEach(oe => totalOpExpenses += Number(oe.amount || 0));

  const netProfit = totalCommission - totalAllowances - totalOpExpenses;
  return netProfit * (sharePercent / 100);
}
