// ===============================
// 📦 IMPORTS
// ===============================
import { getCurrentUser } from "./data.js";
import { checkSubscription } from "./subscription.js";

import { renderDashboard } from "./pages/dashboard.js";
import { renderInvoicesPage } from "./pages/invoices.js";
import { renderSalesPage } from "./pages/sales.js";
import { renderSuppliersPage } from "./pages/suppliers.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderTarhilPage } from "./pages/tarhil.js";
import { renderKhaznaPage } from "./pages/khazna.js";
import { renderEmployeesPage } from "./pages/employees.js";
import { renderMarketShopsPage } from "./pages/market_shops.js";
import { renderFinancialPage } from "./pages/financial.js";
import { renderPartnersPage } from "./pages/partners.js";

// ===============================
// 🧭 ROUTES
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

// ===============================
// 🚀 INIT APP
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("app");
  try {
    const user = await getCurrentUser();
    if (!user) { window.location.href = "index.html"; return; }

    const isActive = await checkSubscription();
    if (!isActive) {
      app.innerHTML = `<div class="center"><h2>🚫 الاشتراك منتهي</h2><p>يرجى تجديد الاشتراك للاستمرار</p></div>`;
      return;
    }

    setupNavigation();
    navigate("dashboard");
  } catch (err) {
    console.error("INIT ERROR:", err);
    app.innerHTML = `<div class="card"><h3>حدث خطأ أثناء تشغيل التطبيق</h3></div>`;
  }
});

// ===============================
// 🔁 NAVIGATION
// ===============================
window.navigate = async function(page) {
  const app = document.getElementById("app");
  try {
    app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    if (!routes[page]) {
      console.warn("Route Missing:", page);
      app.innerHTML = `<div class="card"><h3>الصفحة غير موجودة</h3></div>`;
      return;
    }
    await routes[page](app);
    setActive(page);
    document.getElementById("page-title").innerText = getPageTitle(page);
  } catch (err) {
    console.error("NAV ERROR:", err);
    app.innerHTML = `<div class="card"><h3>حدث خطأ داخل الصفحة</h3></div>`;
  }
};

// ===============================
// 📌 MENU
// ===============================
function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");
      navigate(page);
    });
  });
}

// ===============================
// 🎯 ACTIVE MENU
// ===============================
function setActive(page) {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-nav") === page) btn.classList.add("active");
  });
}

// ===============================
// 📄 PAGE TITLES
// ===============================
function getPageTitle(page) {
  const titles = {
    dashboard: "📊 الرئيسية",
    invoices: "📄 الفواتير",
    sales: "🛒 المبيعات",
    suppliers: "🚚 الموردين",
    customers: "👥 العملاء",
    tarhil: "📋 الترحيلات",
    khazna: "💰 الخزنة",
    employees: "👷 الموظفين",
    market_shops: "🏬 محلات السوق",
    financial: "🏦 المركز المالي",
    partners: "🤝 الشركاء"
  };
  return titles[page] || "Market Pro";
}
