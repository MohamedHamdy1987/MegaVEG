import { supabase, dbInsert, dbUpdate } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency } from "../ui.js";

export async function renderEmployeesPage(app) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  const active   = (employees||[]).filter(e => e.active !== false);
  const inactive = (employees||[]).filter(e => e.active === false);

  app.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">👷 الموظفين</div>
        <div class="page-subtitle">
          <span class="badge badge-green">${active.length} نشط</span>&nbsp;
          ${inactive.length ? `<span class="badge badge-red">${inactive.length} معطل</span>` : ''}
        </div>
      </div>
      <div class="page-actions">
        <button class="btn" onclick="openAddEmployee()">➕ إضافة موظف</button>
      </div>
    </div>

    <div id="employees-list">
      ${renderEmployeeCards(employees||[])}
    </div>
  `;
}

function renderEmployeeCards(list) {
  if (!list.length) return `
    <div class="empty-state">
      <div class="empty-icon">👷</div>
      <div class="empty-title">لا يوجد موظفين</div>
      <div class="empty-sub">أضف موظفين لإدارة الفريق</div>
      <button class="btn" onclick="openAddEmployee()">➕ إضافة موظف</button>
    </div>`;

  return list.map(e => {
    const active = e.active !== false;
    const roleInfo = {
      admin:   { label:'مدير',   badge:'badge-teal',   icon:'👑' },
      cashier: { label:'كاشير',  badge:'badge-blue',   icon:'💼' },
      worker:  { label:'عامل',   badge:'badge-yellow', icon:'👷' }
    }[e.role] || { label:e.role||'عامل', badge:'badge-yellow', icon:'👷' };

    return `
      <div class="card" style="${!active ? 'opacity:0.65;' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--sp-3);">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:6px;">
              <span style="font-size:20px;">${roleInfo.icon}</span>
              <span style="font-weight:700;font-size:16px;">${e.name}</span>
              <span class="badge ${active ? 'badge-green' : 'badge-red'}">${active ? 'نشط' : 'معطل'}</span>
              <span class="badge ${roleInfo.badge}">${roleInfo.label}</span>
            </div>
            ${e.phone ? `<div style="font-size:13px;color:var(--c-text-muted);">📞 ${e.phone}</div>` : ''}
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-shrink:0;">
            <button class="btn btn-sm ${active ? 'btn-danger' : 'btn-ghost'}"
              onclick="toggleEmployee('${e.id}',${active},'${(e.name||'').replace(/'/g,"&#39;")}')">
              ${active ? '🚫 تعطيل' : '✅ تفعيل'}
            </button>
            <button class="btn btn-sm btn-warning"
              onclick="openChangeRole('${e.id}','${(e.name||'').replace(/'/g,"&#39;")}')">
              ✏️ صلاحية
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.openAddEmployee = async function() {
  inputModal({
    title: '👷 إضافة موظف جديد',
    fields: [
      { id:'name',  label:'اسم الموظف',  type:'text', required:true },
      { id:'phone', label:'رقم الهاتف',   type:'tel',  placeholder:'05xxxxxxxx' },
      { id:'role',  label:'الصلاحية',     type:'select', required:true, options:[
          {value:'worker',  label:'👷 عامل'},
          {value:'cashier', label:'💼 كاشير'},
          {value:'admin',   label:'👑 مدير'}
        ]
      }
    ],
    submitLabel: '✅ إضافة الموظف',
    onSubmit: async (vals) => {
      const inserted = await dbInsert("employees", {
        name:   vals.name,
        phone:  vals.phone || null,
        role:   vals.role  || 'worker',
        active: true
      });
      if (!inserted) throw new Error("فشل إضافة الموظف");
      closeModal();
      toast(`تم إضافة الموظف: ${vals.name}`, "success");
      navigate("employees");
    }
  });
};

window.toggleEmployee = async function(id, currentActive, name) {
  const action = currentActive ? 'تعطيل' : 'تفعيل';

  confirmModal(
    `هل أنت متأكد من ${action} الموظف "${name}"؟`,
    async () => {
      const updated = await dbUpdate("employees", id, { active: !currentActive });
      if (!updated) { toast(`فشل ${action} الموظف`, "error"); return; }
      toast(`تم ${action} الموظف: ${name}`, "success");
      navigate("employees");
    }
  );
};

window.openChangeRole = async function(id, name) {
  inputModal({
    title: `✏️ تعديل صلاحية – ${name}`,
    fields: [
      { id:'role', label:'الصلاحية الجديدة', type:'select', required:true, options:[
          {value:'worker',  label:'👷 عامل'},
          {value:'cashier', label:'💼 كاشير'},
          {value:'admin',   label:'👑 مدير'}
        ]
      }
    ],
    submitLabel: '✅ تحديث الصلاحية',
    onSubmit: async (vals) => {
      const roleMap = { admin:'admin', cashier:'cashier', worker:'worker' };
      const role = roleMap[vals.role] || 'worker';
      const updated = await dbUpdate("employees", id, { role });
      if (!updated) throw new Error("فشل تعديل الصلاحية");
      closeModal();
      toast(`تم تعديل صلاحية ${name} إلى: ${vals.role}`, "success");
      navigate("employees");
    }
  });
};
