import { supabase } from "../data.js";

export async function renderDashboard(app) {
  app.innerHTML = `
    <div class="grid">
      <div class="card"><h3>📊 المبيعات اليومية</h3><canvas id="salesChart"></canvas></div>
      <div class="card"><h3>💰 الأرباح</h3><canvas id="profitChart"></canvas></div>
    </div>
  `;
  loadCharts();
}

async function loadCharts() {
  const { data: sales } = await supabase.from("sales").select("*");
  const { data: invoices } = await supabase.from("invoices").select("*");

  const daily = groupByDate(sales);
  const profit = groupProfit(invoices);

  drawSalesChart(daily);
  drawProfitChart(profit);
}

function groupByDate(data) {
  const map = {};
  (data || []).forEach(s => {
    const d = s.created_at?.split("T")[0];
    if (!map[d]) map[d] = 0;
    map[d] += Number(s.total || 0);
  });
  return map;
}

function groupProfit(data) {
  const map = {};
  (data || []).forEach(i => {
    if (i.status !== "closed") return;
    const d = i.date;
    if (!map[d]) map[d] = 0;
    map[d] += Number(i.net || 0);
  });
  return map;
}

function drawSalesChart(data) {
  const ctx = document.getElementById("salesChart");
  if (!ctx) return;
  new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(data),
      datasets: [{ label: "المبيعات", data: Object.values(data), borderColor: "#14b8a6", backgroundColor: "rgba(20,184,166,0.1)", borderWidth: 3, tension: 0.3, fill: true }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: "#f0fdf4" } } }, scales: { x: { ticks: { color: "#a7f3d0" } }, y: { ticks: { color: "#a7f3d0" } } } }
  });
}

function drawProfitChart(data) {
  const ctx = document.getElementById("profitChart");
  if (!ctx) return;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{ label: "الأرباح", data: Object.values(data), backgroundColor: "#5eead4", borderRadius: 8 }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: "#f0fdf4" } } }, scales: { x: { ticks: { color: "#a7f3d0" } }, y: { ticks: { color: "#a7f3d0" } } } }
  });
}
