// ===============================
// SUPABASE
// ===============================
const supabaseUrl = "https://koczjlhjprdyeeuxigiu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvY3pqbGhqcHJkeWVldXhpZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mjg3NDAsImV4cCI6MjA5MjUwNDc0MH0.ywWLJVIfRKC4CxOeAoqaPU3Z6kVX3NJp-4jt2cKfa8I";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let saleLock = false;
const pageTitles = {
  dashboard: "📊 الرئيسية", invoices: "📄 الفواتير", sales: "🛒 المبيعات",
  customers: "👥 العملاء", suppliers: "🚚 الموردين", tarhil: "📋 الترحيلات",
  khazna: "💰 الخزنة", employees: "👷 الموظفين", market_shops: "🏬 محلات السوق",
  financial: "🏦 المركز المالي", partners: "🤝 الشركاء"
};

// ===============================
// UTILS
// ===============================
async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}
async function dbInsert(table, obj) {
  const uid = await getUserId();
  if (!uid) return false;
  const { error } = await supabase.from(table).insert({ ...obj, user_id: uid });
  return !error;
}
async function dbUpdate(table, id, obj) {
  const uid = await getUserId();
  if (!uid) return false;
  const { error } = await supabase.from(table).update(obj).eq("id", id).eq("user_id", uid);
  return !error;
}

// ===============================
// NAVIGATE
// ===============================
async function navigate(page) {
  const app = document.getElementById("app");
  const title = document.getElementById("page-title");
  if (title) title.innerText = pageTitles[page] || "Market Pro";

  // active button
  document.querySelectorAll(".sidebar button, .mobile-nav button").forEach(b => b.classList.remove("active"));
  const btns = document.querySelectorAll(`button[onclick="navigate('${page}')"]`);
  btns.forEach(b => b.classList.add("active"));

  app.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>`;

  const pages = {
    dashboard, invoices, sales, customers, suppliers, tarhil, khazna,
    market_shops, employees, financial, partners
  };

  if (pages[page]) {
    try { await pages[page](app); } catch (e) { app.innerHTML = `<div class="card"><h3>خطأ: ${e.message}</h3></div>`; }
  } else {
    app.innerHTML = `<div class="card"><h3>الصفحة غير موجودة</h3></div>`;
  }
}

// ===============================
// DASHBOARD
// ===============================
async function dashboard(app) {
  const { data: sales } = await supabase.from("sales").select("*");
  const { data: invoices } = await supabase.from("invoices").select("*");
  const daily = {}, profit = {};
  (sales || []).forEach(s => { const d = (s.created_at || "").split("T")[0]; if (d) { daily[d] = (daily[d] || 0) + Number(s.total || 0); } });
  (invoices || []).forEach(i => { if (i.status === "closed" && i.date) { profit[i.date] = (profit[i.date] || 0) + Number(i.net || 0); } });

  app.innerHTML = `<div class="grid"><div class="card"><h3>📊 المبيعات اليومية</h3><canvas id="salesChart"></canvas></div><div class="card"><h3>💰 الأرباح</h3><canvas id="profitChart"></canvas></div></div>`;

  setTimeout(() => {
    const s = document.getElementById("salesChart");
    const p = document.getElementById("profitChart");
    if (s && typeof Chart !== "undefined") new Chart(s, { type: "line", data: { labels: Object.keys(daily), datasets: [{ label: "المبيعات", data: Object.values(daily), borderColor: "#14b8a6", borderWidth: 3, tension: 0.3 }] }, options: { responsive: true } });
    if (p && typeof Chart !== "undefined") new Chart(p, { type: "bar", data: { labels: Object.keys(profit), datasets: [{ label: "الأرباح", data: Object.values(profit), backgroundColor: "#5eead4" }] }, options: { responsive: true } });
  }, 500);
}

// ===============================
// INVOICES
// ===============================
async function invoices(app) {
  const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>📄 الفواتير</h2><button class="btn" onclick="createInvoice()">➕ فاتورة جديدة</button></div>` +
    (data || []).map(i => `<div class="card"><h3>${i.supplier_name}</h3><p>📅 ${i.date} | ${i.status}</p><button class="btn btn-sm" onclick="openInvoice('${i.id}')">📂 فتح</button></div>`).join("") || '<p style="text-align:center">لا يوجد</p>';
}
async function createInvoice() {
  const name = prompt("اسم المورد"); if (!name) return;
  const { data: s } = await supabase.from("suppliers").select("*").eq("name", name).single();
  if (!s) { alert("المورد غير موجود"); return; }
  await dbInsert("invoices", { supplier_id: s.id, supplier_name: s.name, date: new Date().toISOString().split("T")[0], status: "draft", noulon: 0, mashal: 0, advance_payment: 0, commission_rate: 0.07 });
  alert("تم"); navigate("invoices");
}
async function openInvoice(id) {
  const app = document.getElementById("app");
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: prods } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);
  const locked = inv.status !== "draft";
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('invoices')">⬅️ رجوع</button><h2>${inv.supplier_name}</h2>
    ${!locked ? `<div class="grid grid-3"><div><label>نولون</label><input id="noulon" value="${inv.noulon||0}"></div><div><label>مشال</label><input id="mashal" value="${inv.mashal||0}"></div><div><label>دفعة</label><input id="advance" value="${inv.advance_payment||0}"></div></div><button class="btn btn-sm" onclick="saveExpenses('${id}')">💾 حفظ</button><hr><button class="btn" onclick="addProduct('${id}')">➕ صنف</button>` : ""}
    <table class="table"><thead><tr><th>الصنف</th><th>كمية</th><th>مباع</th><th>متبقي</th></tr></thead><tbody>${(prods||[]).map(p=>`<tr><td>${p.name}</td><td>${p.qty}</td><td>${p.sold}</td><td>${p.qty-p.sold-(p.returned||0)}</td></tr>`).join("")}</tbody></table>
    ${!locked ? `<button class="btn" onclick="confirmInv('${id}')">✅ اعتماد</button>` : '<h3 style="color:#5eead4">✔ معتمدة</h3>'}`;
}
async function saveExpenses(id) {
  await dbUpdate("invoices", id, { noulon: +document.getElementById("noulon").value, mashal: +document.getElementById("mashal").value, advance_payment: +document.getElementById("advance").value });
  alert("تم");
}
async function confirmInv(id) {
  if (!confirm("اعتماد؟")) return;
  const { error } = await supabase.rpc("confirm_invoice_v2", { p_invoice_id: id });
  alert(error ? "فشل" : "تم"); openInvoice(id);
}
async function addProduct(invId) {
  const name = prompt("الصنف"), qty = +prompt("العدد"), unit = prompt("الوحدة");
  if (!name || !qty) return;
  await supabase.from("invoice_products").insert({ invoice_id: invId, name, qty, unit, sold: 0, returned: 0 });
  alert("تم"); openInvoice(invId);
}

// ===============================
// SALES
// ===============================
async function sales(app) {
  const { data } = await supabase.from("invoices").select("*").neq("status", "closed").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>🛒 المبيعات</h2></div>` + ((data || []).map(i => `<div class="card"><h3>${i.supplier_name}</h3><p>📅 ${i.date}</p><button class="btn btn-sm" onclick="openSale('${i.id}')">بيع</button></div>`).join("") || '<p>لا يوجد</p>');
}
async function openSale(id) {
  const app = document.getElementById("app");
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: prods } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('sales')">⬅️ رجوع</button><h2>${inv.supplier_name}</h2><table class="table"><thead><tr><th>الصنف</th><th>متبقي</th><th>بيع</th></tr></thead><tbody>${(prods||[]).map(p=>{const r=p.qty-p.sold-(p.returned||0);return`<tr><td>${p.name}</td><td style="color:${r>0?'#5eead4':'#fca5a5'}">${r}</td><td>${r>0?`<button class="btn btn-sm" onclick="sell('${p.id}','${id}')">بيع</button>`:'نفذ'}</td></tr>`}).join("")}</tbody></table>`;
}
async function sell(pid, invId) {
  if (saleLock) return alert("انتظر");
  saleLock = true;
  try {
    const qty = +prompt("الكمية"), price = +prompt("السعر");
    if (!qty || !price) { saleLock = false; return; }
    const { data: p } = await supabase.from("invoice_products").select("*").eq("id", pid).single();
    if (qty > p.qty - p.sold - (p.returned || 0)) { alert("أكبر من المتاح"); saleLock = false; return; }
    const type = prompt("cash / credit / shop"); let cid = null, cname = null, sid = null;
    if (type === "credit") { cname = prompt("العميل"); const { data: c } = await supabase.from("customers").select("*").eq("full_name", cname).single(); if (!c) { alert("غير موجود"); saleLock = false; return; } cid = c.id; }
    if (type === "shop") { const sn = prompt("المحل"); const { data: s } = await supabase.from("market_shops").select("*").eq("name", sn).single(); if (!s) { alert("غير موجود"); saleLock = false; return; } sid = s.id; }
    const total = qty * price;
    await supabase.from("sales").insert({ product_id: pid, invoice_id: invId, qty, price, total, type, customer_id: cid, shop_id: sid });
    await dbUpdate("invoice_products", pid, { sold: p.sold + qty, sales_total: (p.sales_total || 0) + total });
    if (type === "credit") await supabase.from("daily_sales").insert({ customer_id: cid, customer_name: cname, product_name: p.name, qty, price, total, invoice_id: invId, date: new Date().toISOString().split("T")[0] });
    if (type === "shop") await supabase.from("shop_credits").insert({ shop_id: sid, amount: total, date: new Date().toISOString().split("T")[0], source: "sale" });
    await closeInv(invId);
    alert("تم"); openSale(invId);
  } finally { saleLock = false; }
}
async function closeInv(invId) {
  const { data: prods } = await supabase.from("invoice_products").select("*").eq("invoice_id", invId);
  if (!prods.every(p => p.qty - p.sold - (p.returned || 0) <= 0)) return;
  let gross = 0; prods.forEach(p => gross += (p.override_total ?? p.sales_total ?? 0));
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invId).single();
  const comm = gross * (inv.commission_rate || 0.07);
  const exp = (inv.noulon || 0) + (inv.mashal || 0);
  await dbUpdate("invoices", invId, { status: "closed", gross, commission: comm, total_expenses: exp, net: gross - exp - (inv.advance_payment || 0) });
}

// ===============================
// CUSTOMERS
// ===============================
async function customers(app) {
  const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>👥 العملاء</h2><button class="btn" onclick="addCust()">➕ إضافة</button></div>` + ((data || []).map(c => `<div class="card"><h3>${c.full_name||c.name}</h3><p>📞 ${c.phone||"-"}</p><button class="btn btn-sm" onclick="openCust('${c.id}','${c.full_name||c.name}')">📂 عرض</button></div>`).join("") || '<p>لا يوجد</p>');
}
async function addCust() {
  const n = prompt("الاسم"), p = prompt("الموبايل"), o = +prompt("رصيد مبدئي") || 0;
  if (!n) return; await dbInsert("customers", { full_name: n, phone: p, opening_balance: o }); alert("تم"); navigate("customers");
}
async function openCust(id, name) {
  const app = document.getElementById("app");
  const { data: ledger } = await supabase.from("customer_ledger").select("*").eq("customer_id", id).order("trx_date", { ascending: true });
  const { data: bal } = await supabase.from("customer_balances").select("balance").eq("customer_id", id).single();
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('customers')">⬅️ رجوع</button><h2>${name}</h2><div class="card"><h3>الرصيد: ${(bal?.balance||0).toLocaleString("ar-EG")} ج</h3></div>` +
    (ledger || []).map(x => `<div class="row">📅 ${x.trx_date} | ${x.description} | مدين: ${x.debit} | دائن: ${x.credit} | رصيد: ${x.running_balance}</div>`).join("") +
    `<hr><button class="btn btn-sm" onclick="collect('${id}','${name}')">💰 تحصيل</button>`;
}
async function collect(cid, cname) {
  const amt = +prompt("المبلغ"); if (!amt) return;
  const { data: bal } = await supabase.from("customer_balances").select("balance").eq("customer_id", cid).single();
  if (amt < (bal?.balance || 0)) {
    const diff = (bal.balance || 0) - amt;
    if (confirm(`الفرق ${diff} يسجل كمسموح؟`)) await supabase.from("customer_allowances").insert({ customer_id: cid, amount: diff, date: new Date().toISOString().split("T")[0], reason: "تسوية" });
  }
  await dbInsert("collections", { customer_id: cid, amount: amt, date: new Date().toISOString() });
  alert("تم"); openCust(cid, cname);
}

// ===============================
// SUPPLIERS
// ===============================
async function suppliers(app) {
  const { data } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>🚚 الموردين</h2><button class="btn" onclick="addSupp()">➕ إضافة</button></div>` + ((data || []).map(s => `<div class="card"><h3>${s.name}</h3><p>📞 ${s.phone||"-"}</p><button class="btn btn-sm" onclick="openSupp('${s.id}','${s.name}')">📂 عرض</button></div>`).join("") || '<p>لا يوجد</p>');
}
async function addSupp() { const n = prompt("الاسم"), p = prompt("الهاتف"); if (!n) return; await dbInsert("suppliers", { name: n, phone: p }); alert("تم"); navigate("suppliers"); }
async function openSupp(id, name) {
  const app = document.getElementById("app");
  const { data: invs } = await supabase.from("invoices").select("*").eq("supplier_id", id).order("created_at", { ascending: false });
  let bal = 0; (invs || []).forEach(i => { if (i.status === "closed") bal += Number(i.net || 0); });
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('suppliers')">⬅️ رجوع</button><h2>${name}</h2><div class="card"><h3>الرصيد: ${bal.toLocaleString("ar-EG")} ج</h3></div>` +
    ((invs || []).map(i => `<div class="row">📅 ${i.date} | ${i.status} | ${(i.net||0).toLocaleString("ar-EG")} ج</div>`).join("") || '<p>لا توجد فواتير</p>');
}

// ===============================
// TARHIL
// ===============================
async function tarhil(app) {
  const { data } = await supabase.from("customer_ledger").select("*").order("trx_date", { ascending: false });
  const map = {}; (data || []).forEach(r => {
    if (!map[r.customer_id]) map[r.customer_id] = { name: r.customer_name || "عميل", items: [], debit: 0, credit: 0, balance: 0 };
    map[r.customer_id].items.push(r); map[r.customer_id].debit += +r.debit || 0; map[r.customer_id].credit += +r.credit || 0; map[r.customer_id].balance = +r.running_balance || 0;
  });
  app.innerHTML = `<div class="header"><h2>📋 الترحيلات</h2></div>` + Object.values(map).map(g => `<div class="card"><h3>${g.name}</h3>${g.items.map(i=>`<div class="row">${i.trx_date} | ${i.description}</div>`).join("")}<hr><p>مدين: ${g.debit} | دائن: ${g.credit} | رصيد: ${g.balance}</p></div>`).join("") || '<p>لا يوجد</p>';
}

// ===============================
// KHAZNA
// ===============================
async function khazna(app) {
  const { data: col } = await supabase.from("collections").select("*");
  const { data: exp } = await supabase.from("expenses").select("*");
  let ci = 0, co = 0; (col || []).forEach(c => ci += +c.amount || 0); (exp || []).forEach(e => co += +e.amount || 0);
  app.innerHTML = `<div class="header"><h2>💰 الخزنة</h2><div><button class="btn" onclick="addCol()">➕ تحصيل</button> <button class="btn btn-danger" onclick="addExp()">➖ مصروف</button></div></div>
    <div class="grid grid-3"><div class="card"><h4>وارد</h4><h2>${ci.toLocaleString("ar-EG")}</h2></div><div class="card"><h4>مصروف</h4><h2>${co.toLocaleString("ar-EG")}</h2></div><div class="card"><h4>صافي</h4><h2>${(ci-co).toLocaleString("ar-EG")}</h2></div></div>
    <div class="card"><h3>تحصيلات</h3>${(col||[]).map(c=>`<div class="row">💰 ${c.amount} - ${(c.date||"").split("T")[0]}</div>`).join("")||'<p>لا يوجد</p>'}</div>
    <div class="card"><h3>مصروفات</h3>${(exp||[]).map(e=>`<div class="row">❌ ${e.description} - ${e.amount}</div>`).join("")||'<p>لا يوجد</p>'}</div>`;
}
async function addCol() {
  const n = prompt("العميل"), a = +prompt("المبلغ"); if (!n || !a) return;
  const { data: c } = await supabase.from("customers").select("*").eq("full_name", n).single();
  if (!c) { alert("غير موجود"); return; }
  await dbInsert("collections", { customer_id: c.id, amount: a, date: new Date().toISOString() }); alert("تم"); navigate("khazna");
}
async function addExp() {
  const d = prompt("الوصف"), a = +prompt("المبلغ"); if (!d || !a) return;
  await dbInsert("expenses", { description: d, amount: a, date: new Date().toISOString() }); navigate("khazna");
}

// ===============================
// MARKET SHOPS
// ===============================
async function market_shops(app) {
  const { data } = await supabase.from("market_shops").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>🏬 محلات السوق</h2><button class="btn" onclick="addShop()">➕ إضافة</button></div>` + ((data || []).map(s => `<div class="card"><h3>${s.name}</h3><button class="btn btn-sm" onclick="openShop('${s.id}','${s.name}')">📂 فتح</button></div>`).join("") || '<p>لا يوجد</p>');
}
async function addShop() { const n = prompt("الاسم"); if (!n) return; await dbInsert("market_shops", { name: n }); navigate("market_shops"); }
async function openShop(id, name) {
  const app = document.getElementById("app");
  const { data: cr } = await supabase.from("shop_credits").select("*").eq("shop_id", id);
  const { data: db } = await supabase.from("shop_debits").select("*").eq("shop_id", id);
  const tc = (cr || []).reduce((s, x) => s + +x.amount || 0, 0);
  const td = (db || []).reduce((s, x) => s + +x.total || 0, 0);
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('market_shops')">⬅️ رجوع</button><h2>${name}</h2>
    <div class="grid grid-2">
      <div class="card"><h3>🟢 لنا</h3>${(cr||[]).map(x=>`<div class="row">💰 ${x.amount}</div>`).join("")||'<p>لا يوجد</p>'}<h4>${tc.toLocaleString("ar-EG")} ج</h4></div>
      <div class="card"><h3>🔴 لهم</h3><button class="btn btn-sm" onclick="addDebit('${id}')">➕</button>${(db||[]).map(x=>`<div class="row">${x.product_name} - ${x.total}</div>`).join("")||'<p>لا يوجد</p>'}<h4>${td.toLocaleString("ar-EG")} ج</h4></div>
    </div><hr><h2>الفرق: ${(tc-td).toLocaleString("ar-EG")} ج</h2>`;
}
async function addDebit(sid) {
  const p = prompt("الصنف"), q = +prompt("العدد"), pr = +prompt("السعر"); if (!p || !q || !pr) return;
  const type = prompt("cash / credit"); let cid = null, cn = null;
  if (type === "credit") { cn = prompt("العميل"); const { data: c } = await supabase.from("customers").select("*").eq("full_name", cn).single(); if (!c) { alert("غير موجود"); return; } cid = c.id; }
  const total = q * pr, today = new Date().toISOString().split("T")[0];
  await dbInsert("shop_debits", { shop_id: sid, product_name: p, qty: q, price: pr, total, customer_id: cid, customer_name: cn, type });
  if (type === "credit") await supabase.from("daily_sales").insert({ customer_id: cid, customer_name: cn, product_name: p + " (محل)", qty: q, price: pr, total, date: today });
  openShop(sid);
}

// ===============================
// EMPLOYEES
// ===============================
async function employees(app) {
  const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>👷 الموظفين</h2><button class="btn" onclick="addEmp()">➕ إضافة</button></div>` + ((data || []).map(e => {
    const a = e.active !== false;
    return `<div class="card"><h3>${e.name} ${a?'✅':'🚫'}</h3><p>📞 ${e.phone||"-"} | ${e.role}</p><button class="btn btn-sm" onclick="toggleEmp('${e.id}',${a})">${a?'تعطيل':'تفعيل'}</button></div>`;
  }).join("") || '<p>لا يوجد</p>');
}
async function addEmp() { const n = prompt("الاسم"), p = prompt("الموبايل"), r = prompt("admin/cashier/worker","worker"); if (!n) return; await dbInsert("employees", { name: n, phone: p, role: r, active: true }); navigate("employees"); }
async function toggleEmp(id, cur) { await dbUpdate("employees", id, { active: !cur }); navigate("employees"); }

// ===============================
// FINANCIAL
// ===============================
async function financial(app) {
  const { data: col } = await supabase.from("collections").select("*");
  const { data: exp } = await supabase.from("expenses").select("*");
  let ci = 0, co = 0; (col || []).forEach(c => ci += +c.amount || 0); (exp || []).forEach(e => co += +e.amount || 0);
  const cash = ci - co;

  const { data: bal } = await supabase.from("customer_balances").select("*");
  let cr = 0; (bal || []).forEach(b => { if (+b.balance > 0) cr += +b.balance; });

  const { data: invs } = await supabase.from("invoices").select("*").neq("status", "draft");
  let sl = 0, tc = 0; (invs || []).forEach(i => {
    if (i.status === "closed") { sl += +i.net || 0; tc += +i.commission || 0; }
    else sl += +i.advance_payment || 0;
  });

  const eq = cash + cr - sl;

  const { data: al } = await supabase.from("customer_allowances").select("*");
  let ta = 0; (al || []).forEach(a => ta += +a.amount || 0);

  const { data: op } = await supabase.from("operating_expenses").select("*");
  let toe = 0; (op || []).forEach(o => toe += +o.amount || 0);

  const np = tc - ta - toe;

  app.innerHTML = `<div class="header"><h2>🏦 المركز المالي</h2></div>
    <div class="card"><h3>🏬 حقوق الملكية</h3><div class="grid grid-3">
      <div class="card"><h4>💵 النقدية</h4><h2>${cash.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>👥 ذمم العملاء</h4><h2>${cr.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>🚚 التزامات</h4><h2 style="color:#fca5a5">${sl.toLocaleString("ar-EG")}</h2></div>
    </div><hr><h3>💰 صافي الحقوق: <span style="color:#5eead4">${eq.toLocaleString("ar-EG")} ج</span></h3></div>
    <div class="card"><h3>📊 الأرباح</h3><div class="grid grid-3">
      <div class="card"><h4>📈 العمولات</h4><h2>${tc.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>📝 المسموحات</h4><h2 style="color:#fca5a5">${ta.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>💸 مصاريف</h4><h2 style="color:#fca5a5">${toe.toLocaleString("ar-EG")}</h2></div>
    </div><hr><h3>💎 صافي الربح: <span style="color:#5eead4">${np.toLocaleString("ar-EG")} ج</span></h3></div>`;
}

// ===============================
// PARTNERS
// ===============================
async function partners(app) {
  const { data } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>🤝 الشركاء</h2><button class="btn" onclick="addPartner()">➕ إضافة</button></div>` + ((data || []).map(p => `<div class="card"><h3>${p.name}</h3><p>حصة: ${p.profit_share||0}%</p><button class="btn btn-sm" onclick="openPartner('${p.id}','${p.name}')">📂 فتح</button></div>`).join("") || '<p>لا يوجد</p>');
}
async function addPartner() { const n = prompt("الاسم"), ph = prompt("الموبايل"), s = +prompt("نسبة الربح %"); if (!n) return; await dbInsert("partners", { name: n, phone: ph, profit_share: s }); navigate("partners"); }
async function openPartner(id, name) {
  const app = document.getElementById("app");
  const { data: p } = await supabase.from("partners").select("*").eq("id", id).single();
  const { data: ac } = await supabase.from("partner_current_accounts").select("*").eq("partner_id", id).order("created_at", { ascending: false });
  let tw = 0; (ac || []).forEach(a => tw += +a.withdrawal_amount || 0);

  // calc profit share
  const { data: invs } = await supabase.from("invoices").select("*").eq("status", "closed");
  let tc = 0; (invs || []).forEach(i => tc += +i.commission || 0);
  const { data: al } = await supabase.from("customer_allowances").select("*");
  let ta = 0; (al || []).forEach(a => ta += +a.amount || 0);
  const { data: op } = await supabase.from("operating_expenses").select("*");
  let toe = 0; (op || []).forEach(o => toe += +o.amount || 0);
  const np = tc - ta - toe;
  const ps = np * ((p?.profit_share || 0) / 100);
  const bal = ps - tw;

  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('partners')">⬅️ رجوع</button><h2>${name}</h2>
    <div class="grid grid-3">
      <div class="card"><h4>حصة الأرباح</h4><h2>${ps.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>المسحوبات</h4><h2 style="color:#fca5a5">${tw.toLocaleString("ar-EG")}</h2></div>
      <div class="card"><h4>المستحق</h4><h2 style="color:${bal>=0?'#5eead4':'#fca5a5'}">${bal.toLocaleString("ar-EG")}</h2></div>
    </div>
    <hr><button class="btn btn-sm" onclick="addPWith('${id}')">💸 تسجيل مسحوبات</button>
    <hr><table class="table"><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>${(ac||[]).map(a=>`<tr><td>${(a.created_at||"").split("T")[0]}</td><td>${a.type}</td><td>${(a.withdrawal_amount||0).toLocaleString("ar-EG")}</td></tr>`).join("")}</tbody></table>`;
}
async function addPWith(pid) { const a = +prompt("المبلغ"); if (!a) return; await dbInsert("partner_current_accounts", { partner_id: pid, type: "withdrawal", withdrawal_amount: a }); alert("تم"); const { data: p } = await supabase.from("partners").select("*").eq("id", pid).single(); openPartner(pid, p.name); }

// ===============================
// INIT
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  const user = await getUserId();
  if (!user) { window.location.href = "index.html"; return; }
  navigate("dashboard");
});
