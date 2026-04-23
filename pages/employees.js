import { supabase, dbInsert, dbUpdate } from "../data.js";

export async function renderEmployeesPage(app) {
  const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false });

  app.innerHTML = `
    <div class="header"><h2>👷 الموظفين</h2><button class="btn" onclick="openAddEmployee()">➕ إضافة موظف</button></div>
    ${!data?.length ? empty() : data.map(renderCard).join("")}
  `;
}

function renderCard(e) {
  const active = e.active !== false;
  return `
    <div class="card">
      <h3>${e.name} ${active ? '<span class="badge badge-green">نشط</span>' : '<span class="badge badge-red">معطل</span>'}</h3>
      <p>📞 ${e.phone || "-"} | 👤 ${roleLabel(e.role)}</p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-sm" onclick="toggleEmployee('${e.id}',${active})">${active ? "🚫 تعطيل" : "✅ تفعيل"}</button>
        <button class="btn btn-sm btn-warning" onclick="changeRole('${e.id}')">✏️ تعديل الصلاحية</button>
      </div>
    </div>`;
}

window.openAddEmployee = async function() {
  const name = prompt("اسم الموظف");
  const phone = prompt("الموبايل");
  let role = prompt("admin / cashier / worker", "worker");
  if (!name) return;
  role = normalizeRole(role);
  await dbInsert("employees", { name, phone, role, active: true });
  navigate("employees");
};

window.toggleEmployee = async function(id, current) {
  await dbUpdate("employees", id, { active: !current });
  navigate("employees");
};

window.changeRole = async function(id) {
  let role = prompt("admin / cashier / worker");
  if (!role) return;
  role = normalizeRole(role);
  await dbUpdate("employees", id, { role });
  navigate("employees");
};

function normalizeRole(r) {
  if (!r) return "worker";
  r = String(r).trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "cashier") return "cashier";
  return "worker";
}

function roleLabel(r) {
  if (r === "admin") return "مدير";
  if (r === "cashier") return "كاشير";
  return "عامل";
}

function empty() { return `<p style="text-align:center;color:#6b7280">لا يوجد موظفين</p>`; }
