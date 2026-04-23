import { supabase } from "../data.js";

export async function renderFinancialPage(app) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const { data: collections } = await supabase.from("collections").select("*");
    const { data: expenses } = await supabase.from("expenses").select("*");
    let cashIn = 0, cashOut = 0;
    (collections || []).forEach(c => cashIn += Number(c.amount || 0));
    (expenses || []).forEach(e => cashOut += Number(e.amount || 0));
    const cashOnHand = cashIn - cashOut;

    const { data: balances } = await supabase.from("customer_balances").select("*");
    let customerReceivables = 0;
    (balances || []).forEach(b => { if (Number(b.balance || 0) > 0) customerReceivables += Number(b.balance); });

    const { data: invoices } = await supabase.from("invoices").select("*").neq("status", "draft");
    let supplierLiabilities = 0;
    (invoices || []).forEach(inv => {
      if (inv.status === "closed") supplierLiabilities += Number(inv.net || 0);
      else supplierLiabilities += Number(inv.advance_payment || 0);
    });

    const netShopEquity = cashOnHand + customerReceivables - supplierLiabilities;

    let totalCommission = 0;
    (invoices || []).forEach(inv => {
      if (inv.status === "closed") totalCommission += Number(inv.commission || 0);
    });

    const { data: allowances } = await supabase.from("customer_allowances").select("*");
    let totalAllowances = 0;
    (allowances || []).forEach(a => totalAllowances += Number(a.amount || 0));

    const { data: opExpenses } = await supabase.from("operating_expenses").select("*");
    let totalOpExpenses = 0;
    (opExpenses || []).forEach(oe => totalOpExpenses += Number(oe.amount || 0));

    const netProfit = totalCommission - totalAllowances - totalOpExpenses;

    app.innerHTML = `
      <div class="header"><h2>🏦 المركز المالي</h2></div>
      <div class="card">
        <h3>🏬 حقوق الملكية (Shop Equity)</h3>
        <div class="grid grid-3">
          <div class="card"><h4>💵 النقدية</h4><h2>${cashOnHand.toLocaleString("ar-EG")} ج</h2></div>
          <div class="card"><h4>👥 ذمم العملاء</h4><h2>${customerReceivables.toLocaleString("ar-EG")} ج</h2></div>
          <div class="card"><h4>🚚 التزامات الموردين</h4><h2 style="color:#fca5a5">${supplierLiabilities.toLocaleString("ar-EG")} ج</h2></div>
        </div>
        <hr>
        <h3>💰 صافي حقوق المحل: <span style="color:#5eead4">${netShopEquity.toLocaleString("ar-EG")} ج</span></h3>
      </div>
      <div class="card">
        <h3>📊 الأرباح التشغيلية</h3>
        <div class="grid grid-3">
          <div class="card"><h4>📈 إجمالي العمولات</h4><h2>${totalCommission.toLocaleString("ar-EG")} ج</h2></div>
          <div class="card"><h4>📝 مسموحات العملاء</h4><h2 style="color:#fca5a5">${totalAllowances.toLocaleString("ar-EG")} ج</h2></div>
          <div class="card"><h4>💸 مصاريف تشغيلية</h4><h2 style="color:#fca5a5">${totalOpExpenses.toLocaleString("ar-EG")} ج</h2></div>
        </div>
        <hr>
        <h3>💎 صافي الربح: <span style="color:#5eead4">${netProfit.toLocaleString("ar-EG")} ج</span></h3>
      </div>
    `;
  } catch (err) {
    console.error("FINANCIAL ERROR:", err);
    app.innerHTML = `<div class="card"><h3>حدث خطأ</h3></div>`;
  }
}
