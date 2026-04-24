// ============================================================
// Market Pro – App Router v4.0
// ============================================================

import { getCurrentUser } from "./data.js";
import { checkSubscription } from "./subscription.js";
import { toast } from "./ui.js";

import { renderDashboard }      from "./pages/dashboard.js";
import { renderInvoicesPage }   from "./pages/invoices.js";
import { renderSalesPage }      from "./pages/sales.js";
import { renderSuppliersPage }  from "./pages/suppliers.js";
import { renderCustomersPage }  from "./pages/customers.js";
import { renderTarhilPage }     from "./pages/tarhil.js";
import { renderKhaznaPage }     from "./pages/khazna.js";
import { renderEmployeesPage }  from "./pages/employees.js";
import { renderMarketShopsPage} from "./pages/market_shops.js";
import { renderFinancialPage }  from "./pages/financial.js";
import { renderPartnersPage }   from "./pages/partners.js";

// ── Routes ───────────────────────────────────────────────
const routes = {
  dashboard:    renderDashboard,
  invoices:     renderInvoicesPage,
  sales:        renderSalesPage,
  suppliers:    renderSuppliersPage,
  customers:    renderCustomersPage,
  tarhil:       renderTarhilPage,
  khazna:       renderKhaznaPage,
  employees:    renderEmployeesPage,
  market_shops: renderMarketShopsPage,
  financial:    renderFinancialPage,
  partners:     renderPartnersPage
};

const PAGE_TITLES = {
  dashboard:    "📊 الرئيسية",
  invoices:     "📄 الفواتير",
  sales:        "🛒 المبيعات",
  suppliers:    "🚚 الموردين",
  customers:    "👥 العملاء",
  tarhil:       "📋 الترحيلات",
  khazna:       "💰 الخزنة",
  employees:    "👷 الموظفين",
  market_shops: "🏬 محلات السوق",
  financial:    "🏦 المركز المالي",
  partners:     "🤝 الشركاء"
};

// ── Init ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  const app    = document.getElementById("app");
  const loader = document.getElementById("global-loader");

  try {
    if (loader) loader.classList.remove("hidden");

    const user = await getCurrentUser();
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    // Subscription check
    const isActive = await checkSubscription();
    if (loader) loader.classList.add("hidden");

    if (!isActive) {
      app.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;">
          <div class="card" style="max-width:420px;width:100%;text-align:center;padding:var(--sp-8);">
            <div style="font-size:64px;margin-bottom:var(--sp-4);">🔒</div>
            <h2 style="color:#f87171;font-size:22px;margin-bottom:var(--sp-3);">الاشتراك منتهي</h2>
            <p style="color:var(--c-text-secondary);margin-bottom:var(--sp-6);line-height:1.6;">
              انتهى اشتراكك في Market Pro.<br>يرجى التواصل مع الدعم لتجديد الاشتراك.
            </p>
            <button class="btn btn-ghost" onclick="signOut()">تسجيل الخروج</button>
          </div>
        </div>`;
      return;
    }

    setupNavigation();
    setupSearch();

    // Handle hash navigation (PWA shortcuts)
    const hash = window.location.hash.replace('#','');
    await navigate(routes[hash] ? hash : "dashboard");

  } catch (err) {
    console.error("INIT ERROR:", err);
    if (loader) loader.classList.add("hidden");
    app.innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.3);">
        <h3 style="color:#f87171;">⚠️ خطأ في تشغيل التطبيق</h3>
        <p style="color:var(--c-text-muted);margin-top:8px;">${err.message||''}</p>
        <button class="btn btn-ghost btn-sm" style="margin-top:16px;" onclick="location.reload()">🔄 إعادة المحاولة</button>
      </div>`;
  }
});

// ── Navigate ─────────────────────────────────────────────
window.navigate = async function(page) {
  const app    = document.getElementById("app");
  const loader = document.getElementById("global-loader");

  try {
    if (!routes[page]) {
      console.warn("Route not found:", page);
      app.innerHTML = `<div class="card"><h3>الصفحة غير موجودة: ${page}</h3></div>`;
      return;
    }

    // Show skeleton instantly
    app.innerHTML = `
      <div>
        <div class="skeleton skeleton-title"></div>
        ${[0,1,2,3].map(()=>`<div class="skeleton skeleton-card"></div>`).join('')}
      </div>`;
    app.classList.remove("fade-in");

    await routes[page](app);

    // Animate in
    app.classList.add("fade-in");
    setActive(page);
    updateTitle(page);

    // Update URL hash without reload
    window.history.replaceState(null, '', '#' + page);

    // Scroll to top
    app.scrollTo({ top:0, behavior:'smooth' });

  } catch (err) {
    console.error("NAV ERROR [" + page + "]:", err);
    app.innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.3);">
        <h3 style="color:#f87171;">⚠️ خطأ في تحميل الصفحة</h3>
        <p style="color:var(--c-text-muted);margin-top:8px;font-size:13px;">${err.message||''}</p>
        <button class="btn btn-sm btn-ghost" style="margin-top:16px;" onclick="navigate('dashboard')">🏠 الرئيسية</button>
      </div>`;
    toast("خطأ في تحميل الصفحة: " + page, "error");
  }
};

// ── Setup Navigation ─────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-nav");
      if (page) navigate(page);
    });
  });
}

// ── Active State ─────────────────────────────────────────
function setActive(page) {
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-nav") === page);
  });
}

// ── Title ────────────────────────────────────────────────
function updateTitle(page) {
  const el = document.getElementById("page-title");
  if (el) el.textContent = PAGE_TITLES[page] || "Market Pro";
  document.title = (PAGE_TITLES[page]||'Market Pro') + " – Market Pro";
}

// ── Global Search ────────────────────────────────────────
function setupSearch() {
  const searchEl = document.getElementById("global-search");
  if (!searchEl) return;

  let debounce;
  searchEl.addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = e.target.value.trim();
      if (q.length >= 2) handleGlobalSearch(q);
    }, 350);
  });

  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") { searchEl.value = ''; searchEl.blur(); }
  });
}

async function handleGlobalSearch(q) {
  // نوجه للعملاء عند البحث – أبسط سلوك مفيد
  await navigate("customers");
  if (window.filterCustomers) window.filterCustomers(q);
}

// ── Online/Offline Indicator ─────────────────────────────
window.addEventListener("online", () => {
  toast("✅ تم استعادة الاتصال بالإنترنت", "success");
});
window.addEventListener("offline", () => {
  toast("📡 لا يوجد اتصال – بعض الميزات قد لا تعمل", "warning", 6000);
});
