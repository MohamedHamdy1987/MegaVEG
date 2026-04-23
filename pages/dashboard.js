import { supabase } from "../core/data.js"

// ===============================
// 🎯 RENDER DASHBOARD
// ===============================

export async function renderDashboard(app) {

  app.innerHTML = `
    <div class="grid">

      <div class="card">
        <h3>📊 المبيعات اليومية</h3>
        <canvas id="salesChart"></canvas>
      </div>

      <div class="card">
        <h3>💰 الأرباح</h3>
        <canvas id="profitChart"></canvas>
      </div>

    </div>
  `;

  loadCharts();
}

// ===============================
// 📊 LOAD CHARTS
// ===============================

async function loadCharts() {

  const { data: sales } = await supabase.from("sales").select("*");
  const { data: invoices } = await supabase.from("invoices").select("*");

  const daily = groupByDate(sales);
  const profit = groupProfit(invoices);

  drawSalesChart(daily);
  drawProfitChart(profit);
}

// ===============================
// 📈 GROUP DATA
// ===============================

function groupByDate(data) {
  const map = {};

  data.forEach(s => {
    const d = s.created_at?.split("T")[0];
    if (!map[d]) map[d] = 0;
    map[d] += Number(s.total || 0);
  });

  return map;
}

function groupProfit(data) {
  const map = {};

  data.forEach(i => {
    if (i.status !== "closed") return;

    const d = i.date;
    if (!map[d]) map[d] = 0;
    map[d] += Number(i.net || 0);
  });

  return map;
}

// ===============================
// 📊 DRAW CHARTS
// ===============================

function drawSalesChart(data) {

  new Chart(document.getElementById("salesChart"), {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "المبيعات",
        data: Object.values(data),
        borderWidth: 3,
        tension: 0.3
      }]
    }
  });
}

function drawProfitChart(data) {

  new Chart(document.getElementById("profitChart"), {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "الأرباح",
        data: Object.values(data),
        borderWidth: 1
      }]
    }
  });
}