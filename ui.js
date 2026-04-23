<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Pro</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="bg"></div>
  <aside class="sidebar">
    <div class="logo">🍎 <span>Market Pro</span></div>
    <nav class="menu">
      <button data-nav="dashboard">📊 الرئيسية</button>
      <button data-nav="invoices">📄 الفواتير</button>
      <button data-nav="sales">🛒 المبيعات</button>
      <button data-nav="customers">👥 العملاء</button>
      <button data-nav="suppliers">🚚 الموردين</button>
      <button data-nav="tarhil">📋 الترحيلات</button>
      <button data-nav="khazna">💰 الخزنة</button>
      <button data-nav="financial">🏦 المركز المالي</button>
      <button data-nav="partners">🤝 الشركاء</button>
      <button data-nav="market_shops">🏬 محلات السوق</button>
      <button data-nav="employees">👷 الموظفين</button>
    </nav>
    <div class="sidebar-footer"><p>⚡ v3.0</p></div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div class="left"><h3 id="page-title">الرئيسية</h3></div>
      <div class="right"><input type="text" placeholder="بحث..." class="search"><div class="user">👤</div></div>
    </header>
    <section id="app" class="content fade-in"></section>
  </main>
  <div id="modal" class="modal hidden"></div>
  <div id="toast"></div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script type="module" src="app.js"></script>
</body>
</html>
