import { supabase, dbUpdate, addAuditLog } from "../data.js";

let saleLock = false;

export async function renderSalesPage(app) {
  const { data: invoices } = await supabase.from("invoices").select("*").neq("status", "closed").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header"><h2>🛒 المبيعات</h2></div>
    ${!invoices?.length ? empty("لا توجد فواتير مفتوحة") : invoices.map(renderCard).join("")}
  `;
}

function renderCard(inv) {
  return `
    <div class="card">
      <h3>${inv.supplier_name}</h3>
      <p>📅 ${inv.date}</p>
      <button class="btn btn-sm" onclick="openSalesInvoice('${inv.id}')">بيع</button>
    </div>
  `;
}

window.openSalesInvoice = async function(id) {
  const app = document.getElementById("app");
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  const { data: products } = await supabase.from("invoice_products").select("*").eq("invoice_id", id);

  app.innerHTML = `
    <button class="btn btn-sm" onclick="navigate('sales')">⬅️ رجوع</button>
    <h2>بيع من: ${invoice.supplier_name}</h2>
    <div class="table-wrapper">${renderProducts(products, id)}</div>
  `;
};

function renderProducts(products, invoiceId) {
  if (!products?.length) return empty("لا توجد أصناف");
  return `
    <table class="table">
      <thead><tr><th>الصنف</th><th>المتبقي</th><th>بيع</th><th>مرتجع</th></tr></thead>
      <tbody>
        ${products.map(p => {
          const remain = p.qty - p.sold - (p.returned || 0);
          return `
            <tr>
              <td>${p.name}</td>
              <td style="color:${remain > 0 ? '#5eead4' : '#fca5a5'}">${remain}</td>
              <td>${remain > 0 ? `<button class="btn btn-sm" onclick="sellProduct('${p.id}','${invoiceId}')">بيع</button>` : '<span class="badge badge-red">نفذ</span>'}</td>
              <td>${remain > 0 ? `<button class="btn btn-sm btn-warning" onclick="returnProduct('${p.id}','${invoiceId}')">مرتجع</button>` : '-'}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

window.sellProduct = async function(productId, invoiceId) {
  if (saleLock) { alert("جار تنفيذ العملية"); return; }
  saleLock = true;
  try {
    const qty = Number(prompt("الكمية"));
    const price = Number(prompt("السعر"));
    if (!qty || qty <= 0 || !price) { saleLock = false; return; }

    const { data: product } = await supabase.from("invoice_products").select("*").eq("id", productId).single();
    const available = product.qty - product.sold - (product.returned || 0);
    if (qty > available) { alert("أكبر من المتاح"); saleLock = false; return; }

    const type = prompt("نوع البيع: cash / credit / shop");
    let customerId = null, customerName = null, shopId = null;

    if (type === "credit") {
      customerName = prompt("اسم العميل");
      const { data: customer } = await supabase.from("customers").select("*").eq("full_name", customerName).single();
      if (!customer) { alert("عميل غير موجود"); saleLock = false; return; }
      customerId = customer.id;
    }

    if (type === "shop") {
      const shopName = prompt("اسم المحل");
      const { data: shop } = await supabase.from("market_shops").select("*").eq("name", shopName).single();
      if (!shop) { alert("محل غير موجود"); saleLock = false; return; }
      shopId = shop.id;
    }

    const total = qty * price;
    await supabase.from("sales").insert({ product_id: product.id, invoice_id: invoiceId, qty, price, total, type, customer_id: customerId, shop_id: shopId });
    await dbUpdate("invoice_products", product.id, { sold: product.sold + qty, sales_total: (product.sales_total || 0) + total });

    const today = new Date().toISOString().split("T")[0];
    if (type === "credit") {
      await supabase.from("daily_sales").insert({ customer_id: customerId, customer_name: customerName, product_name: product.name, qty, price, total, invoice_id: invoiceId, date: today });
    }
    if (type === "shop") {
      await supabase.from("shop_credits").insert({ shop_id: shopId, amount: total, date: today, source: "sale" });
    }

    await addAuditLog("sell_product", { productId, invoiceId, qty, price, type, customerId, shopId });
    await checkInvoiceClose(invoiceId);
    alert("تم البيع");
    openSalesInvoice(invoiceId);
  } finally {
    saleLock = false;
  }
};

window.returnProduct = async function(productId, invoiceId) {
  const qty = Number(prompt("كمية المرتجع"));
  if (!qty || qty <= 0) return;
  const { data: product } = await supabase.from("invoice_products").select("*").eq("id", productId).single();
  const available = product.qty - product.sold - (product.returned || 0);
  if (qty > available) { alert("أكبر من المتاح"); return; }
  await dbUpdate("invoice_products", product.id, { returned: (product.returned || 0) + qty });
  await addAuditLog("return_product", { productId, invoiceId, qty });
  alert("تم تسجيل المرتجع");
  openSalesInvoice(invoiceId);
};

async function checkInvoiceClose(invoiceId) {
  const { data: products } = await supabase.from("invoice_products").select("*").eq("invoice_id", invoiceId);
  const allDone = products.every(p => {
    const rem = p.qty - p.sold - (p.returned || 0);
    return rem <= 0;
  });
  if (!allDone) return;

  let gross = 0;
  products.forEach(p => { gross += (p.override_total ?? p.sales_total ?? 0); });

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  const commissionRate = invoice.commission_rate || 0.07;
  const commission = gross * commissionRate;
  const expenses = (invoice.noulon || 0) + (invoice.mashal || 0);
  const advancePayment = invoice.advance_payment || 0;
  const net = gross - expenses - advancePayment;

  await dbUpdate("invoices", invoiceId, {
    status: "closed",
    gross,
    commission: commission,
    total_expenses: expenses,
    advance_payment: advancePayment,
    net
  });

  await addAuditLog("close_invoice", { invoiceId, gross, commission, expenses, net });
}

function empty(msg) { return `<p style="text-align:center;color:#6b7280">${msg}</p>`; }
