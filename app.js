// ===============================
// 📦 IMPORTS
// ===============================

import { getCurrentUser } from "./data.js";
import { checkSubscription } from "./subscription.js";

// الصفحات
import { renderDashboard } from "./pages/dashboard.js";
import { renderInvoicesPage } from "./pages/invoices.js";
import { renderSalesPage } from "./pages/sales.js";
import { renderSuppliersPage } from "./pages/suppliers.js";
import { renderCustomersPage } from "./pages/customers.js";
import { renderTarhilPage } from "./pages/tarhil.js";
import { renderKhaznaPage } from "./pages/khazna.js";
import { renderEmployeesPage } from "./pages/employees.js";

/* ✅ FIXED */
import { renderMarketShopsPage } from "./pages/market_shops.js";

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

  /* ✅ FIXED كان shops */
  market_shops: renderMarketShopsPage
};

// ===============================
// 🚀 INIT APP
// ===============================

window.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("app");

  try {

    // 1️⃣ تحقق تسجيل الدخول
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    // 2️⃣ تحقق الاشتراك
    const isActive = await checkSubscription();

    if (!isActive) {
      app.innerHTML = `
        <div class="center">
          <h2>🚫 الاشتراك منتهي</h2>
          <p>يرجى تجديد الاشتراك للاستمرار</p>
        </div>
      `;
      return;
    }

    // 3️⃣ تشغيل التطبيق
    setupNavigation();

    navigate("dashboard");

  } catch (err) {
    console.error("INIT ERROR:", err);

    app.innerHTML = `
      <div class="card">
        <h3>حدث خطأ أثناء تشغيل التطبيق</h3>
      </div>
    `;
  }

});

// ===============================
// 🔁 NAVIGATION
// ===============================

window.navigate = async function(page) {

  const app = document.getElementById("app");

  try {

    app.innerHTML =
      `<div class="loading">جاري التحميل...</div>`;

    // ✅ حماية لو route غير موجود
    if (!routes[page]) {

      console.warn("Route Missing:", page);

      app.innerHTML = `
        <div class="card">
          <h3>الصفحة غير موجودة</h3>
        </div>
      `;

      return;
    }

    await routes[page](app);

    setActive(page);

  }

  catch(err){

    console.error("NAV ERROR:", err);

    app.innerHTML = `
      <div class="card">
        <h3>حدث خطأ داخل الصفحة</h3>
      </div>
    `;

  }

};

// ===============================
// 📌 MENU
// ===============================

function setupNavigation() {

  document.querySelectorAll("[data-nav]").forEach(btn => {

    btn.addEventListener("click", () => {

      const page =
        btn.getAttribute("data-nav");

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

    if (
      btn.getAttribute("data-nav") === page
    ){
      btn.classList.add("active");
    }

  });

}