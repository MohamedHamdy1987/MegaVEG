import { supabase } from "../data.js";

export async function renderTarhilPage(app) {
  const { data, error } = await supabase.from("customer_ledger").select("*").order("trx_date", { ascending: false });

  if (error) { console.error("LEDGER ERROR:", error.message); app.innerHTML = `<p>حدث خطأ</p>`; return; }

  const grouped = groupByCustomer(data);
  app.innerHTML = `
    <div class="header"><h2>📋 دفتر ترحيلات العملاء</h2></div>
    ${renderCustomers(grouped)}
  `;
}

function groupByCustomer(rows = []) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.customer_id]) {
      map[r.customer_id] = { name: r.customer_name || "عميل", debit: 0, credit: 0, balance: 0, items: [] };
    }
    map[r.customer_id].debit += Number(r.debit || 0);
    map[r.customer_id].credit += Number(r.credit || 0);
    map[r.customer_id].balance = Number(r.running_balance || 0);
    map[r.customer_id].items.push(r);
  });
  return map;
}

function renderCustomers(grouped) {
  const ids = Object.keys(grouped);
  if (!ids.length) return empty();

  return ids.map(id => {
    const g = grouped[id];
    return `
      <div class="card">
        <h3>${g.name}</h3>
        ${g.items.map(i => `<div class="row">📅 ${i.trx_date} | ${i.description}<br>مدين: ${i.debit} | دائن: ${i.credit}</div>`).join("")}
        <hr>
        <p>إجمالي مدين: ${g.debit.toLocaleString("ar-EG")} ج</p>
        <p>إجمالي دائن: ${g.credit.toLocaleString("ar-EG")} ج</p>
        <h4>الرصيد: ${g.balance.toLocaleString("ar-EG")} ج</h4>
      </div>`;
  }).join("");
}

function empty() { return `<p style="text-align:center;color:#6b7280">لا توجد ترحيلات</p>`; }
