// ===============================
// 📦 IMPORTS
// ===============================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js'

const supabaseUrl = "https://xetbfyhcazqudmoqkqub.supabase.co";
const supabaseKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGJmeWhjYXpxdWRtb3FrcXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDg3OTQsImV4cCI6MjA5MjUyNDc5NH0.3P16_0mdi9doQhR5SXtR0HIo6N752sxPJCpK1YShilw";
const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
// 🛠️ UTILS
// ===============================
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) { console.error(error.message); return null; }
  return data?.user || null;
}

async function dbInsert(table, data) {
  const user = await getCurrentUser();
  if (!user) return false;
  const payload = { ...data, user_id: user.id };
  const { error } = await supabase.from(table).insert(payload);
  if (error) { console.error("INSERT ERROR:", error.message); return false; }
  return true;
}

async function dbUpdate(table, id, data) {
  const user = await getCurrentUser();
  if (!user) return false;
  const { error } = await supabase.from(table).update(data).eq("id", id).eq("user_id", user.id);
  if (error) { console.error("UPDATE ERROR:", error.message); return false; }
  return true;
}

async function getCustomerBalance(customerId) {
  const { data, error } = await supabase.from("customer_balances").select("balance").eq("customer_id", customerId).single();
  if (error) return 0;
  return data?.balance || 0;
}

async function getCustomerLedger(customerId) {
  const { data, error } = await supabase.from("customer_ledger").select("*").eq("customer_id", customerId).order("trx_date", { ascending: true });
  if (error) return [];
  return data || [];
}

async function addAuditLog(action, details = {}) {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({ user_id: user.id, action, details: JSON.stringify(details), created_at: new Date().toISOString() });
}

// ===============================
// 🔔 TOAST
// ===============================
function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerText = msg;
  el.style.background = type === "error" ? "#dc2626" : type === "warning" ? "#f59e0b" : "#22c55e";
  const tc = document.getElementById("toast");
  if (tc) tc.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 500); }, 2500);
}

// ===============================
// 🚀 INIT APP
// ===============================
const routes = {
  dashboard: renderDashboard,
  invoices: renderInvoicesPage,
  sales: renderSalesPage,
  suppliers: renderSuppliersPage,
  customers: renderCustomersPage,
  tarhil: renderTarhilPage,
  khazna: renderKhaznaPage,
  employees: renderEmployeesPage,
  market_shops: renderMarketShopsPage,
  financial: renderFinancialPage,
  partners: renderPartnersPage
};

window.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("app");
  try {
    const user = await getCurrentUser();
    if (!user) { window.location.href = "index.html"; return; }
    setupNavigation();
    navigate("dashboard");
  } catch (err) {
    console.error("INIT ERROR:", err);
    if (app) app.innerHTML = `<div class="card"><h3>حدث خطأ أثناء تشغيل التطبيق</h3></div>`;
  }
});

window.navigate = async function(page) {
  const app = document.getElementById("app");
  if (!app) return;
  try {
    app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    if (!routes[page]) { app.innerHTML = `<div class="card"><h3>الصفحة غير موجودة</h3></div>`; return; }
    await routes[page](app);
    setActive(page);
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.innerText = getPageTitle(page);
  } catch (err) {
    console.error("NAV ERROR:", err);
    app.innerHTML = `<div class="card"><h3>حدث خطأ داخل الصفحة</h3></div>`;
  }
};

function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");
      if (page) navigate(page);
    });
  });
}

function setActive(page) {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-nav") === page) btn.classList.add("active");
  });
}

function getPageTitle(page) {
  const titles = {
    dashboard: "📊 الرئيسية", invoices: "📄 الفواتير", sales: "🛒 المبيعات",
    suppliers: "🚚 الموردين", customers: "👥 العملاء", tarhil: "📋 الترحيلات",
    khazna: "💰 الخزنة", employees: "👷 الموظفين", market_shops: "🏬 محلات السوق",
    financial: "🏦 المركز المالي", partners: "🤝 الشركاء"
  };
  return titles[page] || "Market Pro";
}

// ===============================
// 📊 DASHBOARD
// ===============================
async function renderDashboard(app) {
  app.innerHTML = `
    <div class="grid">
      <div class="card"><h3>📊 المبيعات اليومية</h3><canvas id="salesChart"></canvas></div>
      <div class="card"><h3>💰 الأرباح</h3><canvas id="profitChart"></canvas></div>
    </div>`;
  try {
    const { data: sales } = await supabase.from("sales").select("*");
    const { data: invoices } = await supabase.from("invoices").select("*");
    const daily = {}, profit = {};
    (sales || []).forEach(s => { const d = s.created_at?.split("T")[0]; if (d) { if (!daily[d]) daily[d] = 0; daily[d] += Number(s.total || 0); } });
    (invoices || []).forEach(i => { if (i.status === "closed") { const d = i.date; if (d) { if (!profit[d]) profit[d] = 0; profit[d] += Number(i.net || 0); } } });
    setTimeout(() => {
      const ctx1 = document.getElementById("salesChart");
      const ctx2 = document.getElementById("profitChart");
      if (ctx1 && typeof Chart !== "undefined") new Chart(ctx1, { type: "line", data: { labels: Object.keys(daily), datasets: [{ label: "المبيعات", data: Object.values(daily), borderColor: "#14b8a6", borderWidth: 3, tension: 0.3 }] }, options: { responsive: true } });
      if (ctx2 && typeof Chart !== "undefined") new Chart(ctx2, { type: "bar", data: { labels: Object.keys(profit), datasets: [{ label: "الأرباح", data: Object.values(profit), backgroundColor: "#5eead4" }] }, options: { responsive: true } });
    }, 300);
  } catch (e) { console.error(e); }
}

// ===============================
// 📄 INVOICES
// ===============================
async function renderInvoicesPage(app) {
  const { data: invoices } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>📄 الفواتير</h2><button class="btn" onclick="openCreateInvoice()">➕ فاتورة جديدة</button></div>${!invoices?.length ? '<p style="text-align:center">لا يوجد بيانات</p>' : invoices.map(inv => `<div class="card"><h3>${inv.supplier_name}</h3><p>📅 ${inv.date} | الحالة: ${inv.status}</p><button class="btn btn-sm" onclick="openInvoice('${inv.id}')">📂 فتح</button></div>`).join("")}`;
}

window.openCreateInvoice = async function() {
  const name = prompt("اسم المورد"); if (!name) return;
  const { data: supplier } = await supabase.from("suppliers").select("*").eq("name", name).single();
  if (!supplier) { alert("المورد غير موجود"); return; }
  await dbInsert("invoices", { supplier_id: supplier.id, supplier_name: supplier.name, date: new Date().toISOString().split("T")[0], status: "draft", noulon: 0, mashal: 0, advance_payment: 0, commission_rate: 0.07 });
  alert("تم إنشاء الفاتورة"); navigate("invoices");
};

window.openInvoice = async function(id) {
  const app = document.getElementById("app");
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: products } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);
  const isLocked = invoice.status === "confirmed" || invoice.status === "closed";
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('invoices')">⬅️ رجوع</button><h2>فاتورة: ${invoice.supplier_name}</h2>
    <div class="grid grid-3">
      <div><label>نولون</label><input id="noulon" value="${invoice.noulon}" ${isLocked?"disabled":""}></div>
      <div><label>مشال</label><input id="mashal" value="${invoice.mashal}" ${isLocked?"disabled":""}></div>
      <div><label>دفعة مقدمة</label><input id="advance" value="${invoice.advance_payment}" ${isLocked?"disabled":""}></div>
    </div>
    ${!isLocked?`<button class="btn btn-sm" onclick="saveExpenses('${id}')">💾 حفظ المصاريف</button>`:""}
    <hr>${!isLocked?`<button class="btn" onclick="openAddProduct('${id}')">➕ إضافة صنف</button>`:""}
    <div class="table-wrapper">${products?.length?`<table class="table"><thead><tr><th>الصنف</th><th>كمية</th><th>مباع</th><th>متبقي</th></tr></thead><tbody>${products.map(p=>`<tr><td>${p.name}</td><td>${p.qty}</td><td>${p.sold}</td><td>${p.qty-p.sold-(p.returned||0)}</td></tr>`).join("")}</tbody></table>`:'<p>لا توجد أصناف</p>'}</div>
    ${invoice.status==="draft"?`<button class="btn" onclick="confirmInvoiceUI('${id}')">✅ اعتماد الفاتورة</button>`:`<h3 style="color:#5eead4">✔ تم الاعتماد</h3>`}`;
};

window.saveExpenses = async function(id) {
  const noulon = Number(document.getElementById("noulon").value);
  const mashal = Number(document.getElementById("mashal").value);
  const advance = Number(document.getElementById("advance").value);
  await dbUpdate("invoices", id, { noulon, mashal, advance_payment: advance });
  alert("تم الحفظ");
};

window.confirmInvoiceUI = async function(id) {
  if (!confirm("تأكيد اعتماد الفاتورة؟")) return;
  const { error } = await supabase.rpc("confirm_invoice_v2", { p_invoice_id: id });
  if (error) { alert("فشل الاعتماد"); return; }
  alert("تم الترحيل والاعتماد"); openInvoice(id);
};

window.openAddProduct = function(invoiceId) {
  const name = prompt("اسم الصنف"); const qty = Number(prompt("العدد")); const unit = prompt("الوحدة");
  if (!name || !qty) return;
  supabase.from("invoice_products").insert({ invoice_id: invoiceId, name, qty, unit, sold: 0, returned: 0 }).then(() => { alert("تم"); openInvoice(invoiceId); });
};

// ===============================
// 🛒 SALES
// ===============================
let saleLock = false;

async function renderSalesPage(app) {
  const { data: invoices } = await supabase.from("invoices").select("*").neq("status", "closed").order("created_at", { ascending: false });
  app.innerHTML = `<div class="header"><h2>🛒 المبيعات</h2></div>${!invoices?.length?'<p style="text-align:center">لا توجد فواتير مفتوحة</p>':invoices.map(inv=>`<div class="card"><h3>${inv.supplier_name}</h3><p>📅 ${inv.date}</p><button class="btn btn-sm" onclick="openSalesInvoice('${inv.id}')">بيع</button></div>`).join("")}`;
}

window.openSalesInvoice = async function(id) {
  const app = document.getElementById("app");
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: products } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);
  app.innerHTML = `<button class="btn btn-sm" onclick="navigate('sales')">⬅️ رجوع</button><h2>بيع من: ${invoice.supplier_name}</h2>
    <div class="table-wrapper"><table class="table"><thead><tr><th>الصنف</th><th>المتبقي</th><th>بيع</th></tr></thead><tbody>
    ${products?.map(p=>{const remain=p.qty-p.sold-(p.returned||0);return`<tr><td>${p.name}</td><td style="color:${remain>0?'#5eead4':'#fca5a5'}">${remain}</td><td>${remain>0?`<button class="btn btn-sm" onclick="sellProduct('${p.id}','${id}')">بيع</button>`:'<span class="badge badge-red">نفذ</span>'}</td></tr>`;}).join("")||''}</tbody></table></div>`;
};

window.sellProduct = async function(productId, invoiceId) {
  if(saleLock){alert("جار تنفيذ العملية");return;} saleLock=true;
  try{
    const qty=Number(prompt("الكمية"));const price=Number(prompt("السعر"));
    if(!qty||qty<=0||!price){saleLock=false;return;}
    const {data:product}=await supabase.from("invoice_products").select("*").eq("id",productId).single();
    const available=product.qty-product.sold-(product.returned||0);
    if(qty>available){alert("أكبر من المتاح");saleLock=false;return;}
    const type=prompt("نوع البيع: cash / credit / shop");let customerId=null,customerName=null,shopId=null;
    if(type==="credit"){customerName=prompt("اسم العميل");const{data:c}=await supabase.from("customers").select("*").eq("full_name",customerName).single();if(!c){alert("عميل غير موجود");saleLock=false;return;}customerId=c.id;}
    if(type==="shop"){const sn=prompt("اسم المحل");const{data:s}=await supabase.from("market_shops").select("*").eq("name",sn).single();if(!s){alert("محل غير موجود");saleLock=false;return;}shopId=s.id;}
    const total=qty*price;
    await supabase.from("sales").insert({product_id:product.id,invoice_id:invoiceId,qty,price,total,type,customer_id:customerId,shop_id:shopId});
    await dbUpdate("invoice_products",product.id,{sold:product.sold+qty,sales_total:(product.sales_total||0)+total});
    const today=new Date().toISOString().split("T")[0];
    if(type==="credit"){await supabase.from("daily_sales").insert({customer_id:customerId,customer_name:customerName,product_name:product.name,qty,price,total,invoice_id:invoiceId,date:today});}
    if(type==="shop"){await supabase.from("shop_credits").insert({shop_id:shopId,amount:total,date:today,source:"sale"});}
    await checkInvoiceClose(invoiceId);alert("تم البيع");openSalesInvoice(invoiceId);
  }finally{saleLock=false;}
};

async function checkInvoiceClose(invoiceId){
  const{data:products}=await supabase.from("invoice_products").select("*").eq("invoice_id",invoiceId);
  const allDone=products.every(p=>(p.qty-p.sold-(p.returned||0))<=0);
  if(!allDone)return;
  let gross=0;products.forEach(p=>{gross+=(p.override_total??p.sales_total??0);});
  const{data:invoice}=await supabase.from("invoices").select("*").eq("id",invoiceId).single();
  const commissionRate=invoice.commission_rate||0.07;const commission=gross*commissionRate;
  const expenses=(invoice.noulon||0)+(invoice.mashal||0);const advancePayment=invoice.advance_payment||0;
  const net=gross-expenses-advancePayment;
  await dbUpdate("invoices",invoiceId,{status:"closed",gross,commission,total_expenses:expenses,advance_payment:advancePayment,net});
}

// ===============================
// 👥 CUSTOMERS
// ===============================
async function renderCustomersPage(app){
  const{data:customers}=await supabase.from("customers").select("*").order("created_at",{ascending:false});
  app.innerHTML=`<div class="header"><h2>👥 العملاء</h2><button class="btn" onclick="openAddCustomer()">➕ إضافة عميل</button></div>${!customers?.length?'<p style="text-align:center">لا يوجد عملاء</p>':customers.map(c=>`<div class="card"><h3>${c.full_name||c.name}</h3><p>📞 ${c.phone||"-"}</p><button class="btn btn-sm" onclick="openCustomer('${c.id}','${c.full_name||c.name}')">📂 عرض الحساب</button></div>`).join("")}`;
}
window.openAddCustomer=async function(){const name=prompt("اسم العميل");const phone=prompt("الموبايل");const opening=Number(prompt("رصيد مبدئي")||0);if(!name)return;await dbInsert("customers",{full_name:name,phone,opening_balance:opening});navigate("customers");};
window.openCustomer=async function(id,name){const app=document.getElementById("app");const ledger=await getCustomerLedger(id);const balance=await getCustomerBalance(id);app.innerHTML=`<button class="btn btn-sm" onclick="navigate('customers')">⬅️ رجوع</button><h2>${name}</h2><div class="card"><h3>🔵 الرصيد الحالي: ${(balance||0).toLocaleString("ar-EG")} ج</h3></div>${ledger?.length?`<div class="table-wrapper"><table class="table"><thead><tr><th>التاريخ</th><th>الوصف</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${ledger.map(x=>`<tr><td>${x.trx_date}</td><td>${x.description}</td><td>${x.debit}</td><td>${x.credit}</td><td>${x.running_balance}</td></tr>`).join("")}</tbody></table></div>`:'<p>لا توجد حركات</p>'}<hr><button class="btn btn-sm" onclick="recordCollection('${id}','${name}')">💰 تسجيل تحصيل</button>`;};
window.recordCollection=async function(customerId,customerName){const amount=Number(prompt("المبلغ المحصل"));if(!amount||amount<=0)return;const balance=await getCustomerBalance(customerId);if(amount<balance){const allowance=balance-amount;if(!confirm(`الفرق (${allowance}) سيتم تسجيله كمسموح. متابعة؟`))return;await supabase.from("customer_allowances").insert({customer_id:customerId,amount:allowance,date:new Date().toISOString().split("T")[0],reason:"تسوية تحصيل"});}await dbInsert("collections",{customer_id:customerId,amount,date:new Date().toISOString()});alert("تم التسجيل");openCustomer(customerId,customerName);};

// ===============================
// 🚚 SUPPLIERS
// ===============================
async function renderSuppliersPage(app){const{data:suppliers}=await supabase.from("suppliers").select("*").order("created_at",{ascending:false});app.innerHTML=`<div class="header"><h2>🚚 الموردين</h2><button class="btn" onclick="openAddSupplier()">➕ إضافة مورد</button></div>${!suppliers?.length?'<p style="text-align:center">لا يوجد موردين</p>':suppliers.map(s=>`<div class="card"><h3>${s.name}</h3><p>📞 ${s.phone||"-"}</p><button class="btn btn-sm" onclick="openSupplier('${s.id}','${s.name}')">📂 عرض الحساب</button></div>`).join("")}`;}
window.openAddSupplier=function(){const name=prompt("اسم المورد");const phone=prompt("رقم الهاتف");if(!name)return;dbInsert("suppliers",{name,phone}).then(()=>{alert("تم");navigate("suppliers");});};
window.openSupplier=async function(supplierId,supplierName){const app=document.getElementById("app");const{data:invoices}=await supabase.from("invoices").select("*").eq("supplier_id",supplierId).order("created_at",{ascending:false});let balance=0;(invoices||[]).forEach(inv=>{if(inv.status==="closed")balance+=Number(inv.net||0);});app.innerHTML=`<button class="btn btn-sm" onclick="navigate('suppliers')">⬅️ رجوع</button><h2>📊 حساب المورد: ${supplierName}</h2><div class="card"><h3>الرصيد: ${balance.toLocaleString("ar-EG")} ج</h3></div>${invoices?.length?`<div class="table-wrapper"><table class="table"><thead><tr><th>التاريخ</th><th>الحالة</th><th>الصافي</th></tr></thead><tbody>${invoices.map(inv=>`<tr><td>${inv.date}</td><td>${inv.status}</td><td>${(inv.net||0).toLocaleString("ar-EG")} ج</td></tr>`).join("")}</tbody></table></div>`:'<p>لا توجد فواتير</p>'}`;};

// ===============================
// 📋 TARHIL
// ===============================
async function renderTarhilPage(app){const{data,error}=await supabase.from("customer_ledger").select("*").order("trx_date",{ascending:false});if(error){app.innerHTML='<p>حدث خطأ</p>';return;}const map={};(data||[]).forEach(r=>{if(!map[r.customer_id])map[r.customer_id]={name:r.customer_name||"عميل",debit:0,credit:0,balance:0,items:[]};map[r.customer_id].debit+=Number(r.debit||0);map[r.customer_id].credit+=Number(r.credit||0);map[r.customer_id].balance=Number(r.running_balance||0);map[r.customer_id].items.push(r);});const ids=Object.keys(map);app.innerHTML=`<div class="header"><h2>📋 دفتر ترحيلات العملاء</h2></div>${!ids.length?'<p style="text-align:center">لا توجد ترحيلات</p>':ids.map(id=>{const g=map[id];return`<div class="card"><h3>${g.name}</h3>${g.items.map(i=>`<div class="row">📅 ${i.trx_date} | ${i.description}<br>مدين: ${i.debit} | دائن: ${i.credit}</div>`).join("")}<hr><p>إجمالي مدين: ${g.debit.toLocaleString("ar-EG")} ج</p><p>إجمالي دائن: ${g.credit.toLocaleString("ar-EG")} ج</p><h4>الرصيد: ${g.balance.toLocaleString("ar-EG")} ج</h4></div>`;}).join("")}`;}

// ===============================
// 💰 KHAZNA
// ===============================
async function renderKhaznaPage(app){const{data:c}=await supabase.from("collections").select("*");const{data:e}=await supabase.from("expenses").select("*");let cash=0,exp=0;(c||[]).forEach(x=>cash+=Number(x.amount||0));(e||[]).forEach(x=>exp+=Number(x.amount||0));const net=cash-exp;app.innerHTML=`<div class="header"><h2>💰 الخزنة</h2><div style="display:flex;gap:10px"><button class="btn" onclick="openAddCollection()">➕ تحصيل</button><button class="btn btn-danger" onclick="openAddExpense()">➖ مصروف</button></div></div><div class="grid grid-3"><div class="card"><h4>💵 كاش وارد</h4><h2>${cash.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>📤 مصروفات</h4><h2>${exp.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>💰 الصافي</h4><h2>${net.toLocaleString("ar-EG")} ج</h2></div></div><div class="card"><h3>📥 التحصيلات</h3>${c?.length?c.map(x=>`<div class="row">💰 ${(x.amount||0).toLocaleString("ar-EG")} ج - ${x.date?.split("T")[0]}</div>`).join(""):'<p>لا يوجد</p>'}</div><div class="card"><h3>📤 المصروفات</h3>${e?.length?e.map(x=>`<div class="row">❌ ${x.description} - ${(x.amount||0).toLocaleString("ar-EG")} ج</div>`).join(""):'<p>لا يوجد</p>'}</div>`;}
window.openAddCollection=async function(){const name=prompt("اسم العميل");const amount=Number(prompt("المبلغ"));if(!name||!amount||amount<=0)return;const{data:c}=await supabase.from("customers").select("*").eq("full_name",name).single();if(!c){alert("العميل غير موجود");return;}await dbInsert("collections",{customer_id:c.id,amount,date:new Date().toISOString()});alert("تم");navigate("khazna");};
window.openAddExpense=async function(){const desc=prompt("الوصف");const amount=Number(prompt("المبلغ"));if(!desc||!amount||amount<=0)return;await dbInsert("expenses",{description:desc,amount,date:new Date().toISOString()});navigate("khazna");};

// ===============================
// 🏬 MARKET SHOPS
// ===============================
async function renderMarketShopsPage(app){const{data}=await supabase.from("market_shops").select("*").order("created_at",{ascending:false});app.innerHTML=`<div class="header"><h2>🏬 محلات السوق</h2><button class="btn" onclick="addShop()">➕ إضافة محل</button></div>${!data?.length?'<p style="text-align:center">لا يوجد محلات</p>':data.map(s=>`<div class="card"><h3>${s.name}</h3><button class="btn btn-sm" onclick="openShop('${s.id}','${s.name}')">📂 فتح الحساب</button></div>`).join("")}`;}
window.addShop=async function(){const name=prompt("اسم المحل");if(!name)return;await dbInsert("market_shops",{name});navigate("market_shops");};
window.openShop=async function(id,name){const app=document.getElementById("app");const{data:credits}=await supabase.from("shop_credits").select("*").eq("shop_id",id);const{data:debits}=await supabase.from("shop_debits").select("*").eq("shop_id",id);const tc=(credits||[]).reduce((s,x)=>s+Number(x.amount||0),0);const td=(debits||[]).reduce((s,x)=>s+Number(x.total||0),0);const bal=tc-td;app.innerHTML=`<button class="btn btn-sm" onclick="navigate('market_shops')">⬅️ رجوع</button><h2>${name}</h2><div class="grid grid-2"><div class="card"><h3>🟢 لنا</h3>${credits?.length?credits.map(x=>`<div class="row">💰 ${(x.amount||0).toLocaleString("ar-EG")} ج</div>`).join(""):'<p>لا يوجد</p>'}<h4>الإجمالي: ${tc.toLocaleString("ar-EG")} ج</h4></div><div class="card"><h3>🔴 لهم</h3><button class="btn btn-sm" onclick="addDebit('${id}')">➕ إضافة</button>${debits?.length?debits.map(x=>`<div class="row">${x.product_name} - ${(x.total||0).toLocaleString("ar-EG")} ج</div>`).join(""):'<p>لا يوجد</p>'}<h4>الإجمالي: ${td.toLocaleString("ar-EG")} ج</h4></div></div><hr><h2>💰 الفرق: ${bal.toLocaleString("ar-EG")} ج</h2>`;};
window.addDebit=async function(shopId){const product=prompt("الصنف");const qty=Number(prompt("العدد"));const price=Number(prompt("السعر"));if(!product||!qty||!price)return;const type=prompt("cash / credit");let customerId=null,customerName=null;if(type==="credit"){customerName=prompt("اسم العميل");const{data:c}=await supabase.from("customers").select("*").eq("full_name",customerName).single();if(!c){alert("عميل غير موجود");return;}customerId=c.id;}const total=qty*price;const today=new Date().toISOString().split("T")[0];await dbInsert("shop_debits",{shop_id:shopId,product_name:product,qty,price,total,customer_id:customerId,customer_name:customerName,type});if(type==="credit"){await supabase.from("daily_sales").insert({customer_id:customerId,customer_name:customerName,product_name:product+" (من محل)",qty,price,total,date:today});}openShop(shopId);};

// ===============================
// 👷 EMPLOYEES
// ===============================
async function renderEmployeesPage(app){const{data}=await supabase.from("employees").select("*").order("created_at",{ascending:false});app.innerHTML=`<div class="header"><h2>👷 الموظفين</h2><button class="btn" onclick="openAddEmployee()">➕ إضافة موظف</button></div>${!data?.length?'<p style="text-align:center">لا يوجد موظفين</p>':data.map(e=>{const active=e.active!==false;return`<div class="card"><h3>${e.name} ${active?'<span class="badge badge-green">نشط</span>':'<span class="badge badge-red">معطل</span>'}</h3><p>📞 ${e.phone||"-"} | 👤 ${e.role==="admin"?"مدير":e.role==="cashier"?"كاشير":"عامل"}</p><div style="display:flex;gap:10px"><button class="btn btn-sm" onclick="toggleEmployee('${e.id}',${active})">${active?"🚫 تعطيل":"✅ تفعيل"}</button><button class="btn btn-sm btn-warning" onclick="changeRole('${e.id}')">✏️ تعديل الصلاحية</button></div></div>`;}).join("")}`;}
window.openAddEmployee=async function(){const name=prompt("اسم الموظف");const phone=prompt("الموبايل");let role=prompt("admin / cashier / worker","worker");if(!name)return;role=String(role).trim().toLowerCase();if(role!=="admin"&&role!=="cashier")role="worker";await dbInsert("employees",{name,phone,role,active:true});navigate("employees");};
window.toggleEmployee=async function(id,current){await dbUpdate("employees",id,{active:!current});navigate("employees");};
window.changeRole=async function(id){let role=prompt("admin / cashier / worker");if(!role)return;role=String(role).trim().toLowerCase();if(role!=="admin"&&role!=="cashier")role="worker";await dbUpdate("employees",id,{role});navigate("employees");};

// ===============================
// 🏦 FINANCIAL
// ===============================
async function renderFinancialPage(app){app.innerHTML=`<div class="loading"><div class="spinner"></div></div>`;try{const{data:col}=await supabase.from("collections").select("*");const{data:exp}=await supabase.from("expenses").select("*");let cashIn=0,cashOut=0;(col||[]).forEach(c=>cashIn+=Number(c.amount||0));(exp||[]).forEach(e=>cashOut+=Number(e.amount||0));const cashOnHand=cashIn-cashOut;const{data:balances}=await supabase.from("customer_balances").select("*");let cr=0;(balances||[]).forEach(b=>{if(Number(b.balance||0)>0)cr+=Number(b.balance);});const{data:invoices}=await supabase.from("invoices").select("*").neq("status","draft");let sl=0,tc=0;(invoices||[]).forEach(inv=>{if(inv.status==="closed"){sl+=Number(inv.net||0);tc+=Number(inv.commission||0);}else{sl+=Number(inv.advance_payment||0);}});const nse=cashOnHand+cr-sl;const{data:allowances}=await supabase.from("customer_allowances").select("*");let ta=0;(allowances||[]).forEach(a=>ta+=Number(a.amount||0));const{data:op}=await supabase.from("operating_expenses").select("*");let toe=0;(op||[]).forEach(o=>toe+=Number(o.amount||0));const np=tc-ta-toe;app.innerHTML=`<div class="header"><h2>🏦 المركز المالي</h2></div><div class="card"><h3>🏬 حقوق الملكية</h3><div class="grid grid-3"><div class="card"><h4>💵 النقدية</h4><h2>${cashOnHand.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>👥 ذمم العملاء</h4><h2>${cr.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>🚚 التزامات الموردين</h4><h2 style="color:#fca5a5">${sl.toLocaleString("ar-EG")} ج</h2></div></div><hr><h3>💰 صافي حقوق المحل: <span style="color:#5eead4">${nse.toLocaleString("ar-EG")} ج</span></h3></div><div class="card"><h3>📊 الأرباح التشغيلية</h3><div class="grid grid-3"><div class="card"><h4>📈 إجمالي العمولات</h4><h2>${tc.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>📝 مسموحات العملاء</h4><h2 style="color:#fca5a5">${ta.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>💸 مصاريف تشغيلية</h4><h2 style="color:#fca5a5">${toe.toLocaleString("ar-EG")} ج</h2></div></div><hr><h3>💎 صافي الربح: <span style="color:#5eead4">${np.toLocaleString("ar-EG")} ج</span></h3></div>`;}catch(err){app.innerHTML='<div class="card"><h3>حدث خطأ</h3></div>';}}

// ===============================
// 🤝 PARTNERS
// ===============================
async function renderPartnersPage(app){const{data:partners}=await supabase.from("partners").select("*").order("created_at",{ascending:false});app.innerHTML=`<div class="header"><h2>🤝 الشركاء</h2><button class="btn" onclick="openAddPartner()">➕ إضافة شريك</button></div>${!partners?.length?'<p style="text-align:center">لا يوجد شركاء</p>':partners.map(p=>`<div class="card"><h3>${p.name}</h3><p>📞 ${p.phone||"-"} | حصة: ${(p.profit_share||0)}%</p><button class="btn btn-sm" onclick="openPartner('${p.id}','${p.name}')">📂 فتح الحساب</button></div>`).join("")}`;}
window.openAddPartner=async function(){const name=prompt("اسم الشريك");const phone=prompt("الموبايل");const share=Number(prompt("نسبة الربح %"));if(!name)return;await dbInsert("partners",{name,phone,profit_share:share});navigate("partners");};
window.openPartner=async function(id,name){const app=document.getElementById("app");const{data:partner}=await supabase.from("partners").select("*").eq("id",id).single();const{data:accounts}=await supabase.from("partner_current_accounts").select("*").eq("partner_id",id).order("created_at",{ascending:false});let tw=0;(accounts||[]).forEach(a=>tw+=Number(a.withdrawal_amount||0));const{data:invoices}=await supabase.from("invoices").select("*").eq("status","closed");let tc=0;(invoices||[]).forEach(inv=>tc+=Number(inv.commission||0));const{data:al}=await supabase.from("customer_allowances").select("*");let ta=0;(al||[]).forEach(a=>ta+=Number(a.amount||0));const{data:op}=await supabase.from("operating_expenses").select("*");let toe=0;(op||[]).forEach(o=>toe+=Number(o.amount||0));const np=tc-ta-toe;const ps=np*(partner?.profit_share||0)/100;const bal=ps-tw;app.innerHTML=`<button class="btn btn-sm" onclick="navigate('partners')">⬅️ رجوع</button><h2>حساب الشريك: ${name}</h2><div class="grid grid-3"><div class="card"><h4>حصة الأرباح</h4><h2>${ps.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>المسحوبات</h4><h2 style="color:#fca5a5">${tw.toLocaleString("ar-EG")} ج</h2></div><div class="card"><h4>الرصيد المستحق</h4><h2 style="color:${bal>=0?'#5eead4':'#fca5a5'}">${bal.toLocaleString("ar-EG")} ج</h2></div></div><hr><button class="btn btn-sm" onclick="addPartnerWithdrawal('${id}')">💸 تسجيل مسحوبات</button><hr><div class="table-wrapper"><table class="table"><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>${(accounts||[]).map(a=>`<tr><td>${a.created_at?.split("T")[0]}</td><td>${a.type}</td><td>${(a.withdrawal_amount||0).toLocaleString("ar-EG")} ج</td></tr>`).join("")}</tbody></table></div>`;};
window.addPartnerWithdrawal=async function(partnerId){const amount=Number(prompt("المبلغ"));if(!amount||amount<=0)return;await dbInsert("partner_current_accounts",{partner_id:partnerId,type:"withdrawal",withdrawal_amount:amount});alert("تم");const{data:p}=await supabase.from("partners").select("*").eq("id",partnerId).single();openPartner(partnerId,p.name);};
