/**
 * Market Pro – app.js  v5.0
 * SPA Router + Module Loader
 * Inferred from full codebase scan.
 * Only addition vs v4: 'crates' route registration.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── Supabase (mirrored from data.js for auth guard) ─────────────────────────
const supabaseUrl = 'https://xetbfyhcazqudmoqkqub.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGJmeWhjYXpxdWRtb3FrcXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDg3OTQsImV4cCI6MjA5MjUyNDc5NH0.3P16_0mdi9doQhR5SXtR0HIo6N752sxPJCpK1YShilw';

const _sb = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: window.localStorage, persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
});

// ─── Auth Guard ───────────────────────────────────────────────────────────────
(async () => {
  const { data: { user } } = await _sb.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  // Inject business name into sidebar
  const biz = user.user_metadata?.business_name;
  const bizEl = document.getElementById('business-name');
  if (bizEl && biz) {
    bizEl.textContent = biz;
    bizEl.style.display = 'block';
  }
  // Boot app
  initApp();
})();

// ─── Page registry ────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:    'الرئيسية',
  invoices:     'الفواتير',
  sales:        'المبيعات',
  tarhil:       'الترحيلات',
  customers:    'العملاء',
  suppliers:    'الموردين',
  market_shops: 'محلات السوق',
  khazna:       'الخزنة',
  financial:    'المركز المالي',
  partners:     'الشركاء',
  employees:    'الموظفين',
  crates:       'العدايات والبرانيك',
};

async function loadPage(route) {
  const app = document.getElementById('app');
  const titleEl = document.getElementById('page-title');
  if (!app) return;

  // Skeleton while loading
  app.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>`;
  app.className = 'content';

  if (titleEl) titleEl.textContent = PAGE_TITLES[route] || route;

  try {
    switch (route) {
      case 'dashboard': {
        const { renderDashboard } = await import('./pages/dashboard.js');
        await renderDashboard(app);
        break;
      }
      case 'invoices': {
        const { renderInvoicesPage } = await import('./pages/invoices.js');
        await renderInvoicesPage(app);
        break;
      }
      case 'sales': {
        const { renderSalesPage } = await import('./pages/sales.js');
        await renderSalesPage(app);
        break;
      }
      case 'tarhil': {
        const { renderTarhilPage } = await import('./pages/tarhil.js');
        await renderTarhilPage(app);
        break;
      }
      case 'customers': {
        const { renderCustomersPage } = await import('./pages/customers.js');
        await renderCustomersPage(app);
        break;
      }
      case 'suppliers': {
        const { renderSuppliersPage } = await import('./pages/suppliers.js');
        await renderSuppliersPage(app);
        break;
      }
      case 'market_shops': {
        const { renderShopsPage } = await import('./pages/shops.js');
        await renderShopsPage(app);
        break;
      }
      case 'khazna': {
        const { renderKhaznaPage } = await import('./pages/khazna.js');
        await renderKhaznaPage(app);
        break;
      }
      case 'financial': {
        const { renderFinancialPage } = await import('./pages/financial.js');
        await renderFinancialPage(app);
        break;
      }
      case 'partners': {
        const { renderPartnersPage } = await import('./pages/partners.js');
        await renderPartnersPage(app);
        break;
      }
      case 'employees': {
        const { renderEmployeesPage } = await import('./pages/employees.js');
        await renderEmployeesPage(app);
        break;
      }
      // ── NEW in v5.0 ──────────────────────────────────────────────────────
      case 'crates': {
        const { renderCratesPage } = await import('./pages/crates.js');
        await renderCratesPage(app);
        break;
      }
      default: {
        app.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">الصفحة غير موجودة</div></div>`;
      }
    }
  } catch (err) {
    console.error('Page load error:', err);
    app.innerHTML = `<div class="card" style="color:var(--c-danger);">⚠️ خطأ في تحميل الصفحة: ${err.message}</div>`;
  }

  // Re-trigger fade-in
  app.classList.add('fade-in');

  // Update active nav button
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === route);
  });

  // Store current route
  window._currentRoute = route;
}

// ─── Navigate (global) ────────────────────────────────────────────────────────
window.navigate = function(route) {
  history.pushState({ route }, '', '#' + route);
  loadPage(route);
};

// ─── Back/Forward ─────────────────────────────────────────────────────────────
window.addEventListener('popstate', (e) => {
  const route = e.state?.route || 'dashboard';
  loadPage(route);
});

// ─── Nav button delegation ────────────────────────────────────────────────────
function initApp() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.nav;
      window.navigate(route);
      // Close mobile sidebar if open
      document.getElementById('sidebar')?.classList.remove('open');
    });
  });

  // Global search – placeholder (searches current page if supported)
  const gs = document.getElementById('global-search');
  if (gs) {
    gs.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      // Delegate to page-level filter if available
      if (typeof window.filterCustomers === 'function' && window._currentRoute === 'customers') {
        window.filterCustomers(q);
      }
    });
  }

  // Mobile sidebar toggle (hamburger – if added later)
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });
  }

  // Initial route from hash or default
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const validRoutes = Object.keys(PAGE_TITLES);
  const startRoute = validRoutes.includes(hash) ? hash : 'dashboard';
  history.replaceState({ route: startRoute }, '', '#' + startRoute);
  loadPage(startRoute);

  // Network status
  function updateNetStatus() {
    const indicator = document.getElementById('net-status');
    if (!indicator) return;
    indicator.textContent = navigator.onLine ? '🟢' : '🔴';
    indicator.title = navigator.onLine ? 'متصل' : 'بدون إنترنت';
  }
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  updateNetStatus();
}
