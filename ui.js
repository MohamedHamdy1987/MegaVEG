// ============================================================
// Market Pro – UI Engine v4.0
// Premium modal, toast, forms – NO prompt() / alert()
// ============================================================

// ── Toast ────────────────────────────────────────────────
export function toast(msg, type = "success", duration = 3000) {
  const container = document.getElementById("toast");
  if (!container) return;

  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="font-size:18px">${icons[type]||'📢'}</span><span>${msg}</span>`;
  container.appendChild(el);

  const timer = setTimeout(() => remove(), duration);
  function remove() {
    el.style.opacity = "0";
    el.style.transform = "translateX(-20px)";
    el.style.transition = "all 300ms ease";
    setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
  }
  el.onclick = () => { clearTimeout(timer); remove(); };
}

// ── Modal ────────────────────────────────────────────────
export function modal(content, options = {}) {
  const m    = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  if (!m || !body) return;

  body.innerHTML = content;
  m.classList.remove("hidden");

  m.onclick = (e) => {
    if (e.target === m && !options.preventClose) closeModal();
  };
}

export function closeModal() {
  const m = document.getElementById("modal");
  if (!m) return;
  m.style.opacity = "0";
  setTimeout(() => { m.classList.add("hidden"); m.style.opacity = ""; }, 200);
}
window.closeModal = closeModal;

// ── Confirm Modal ────────────────────────────────────────
export function confirmModal(msg, onConfirm) {
  modal(`
    <h3 class="modal-title">⚠️ تأكيد</h3>
    <p style="color:var(--c-text-secondary);font-size:15px;margin-bottom:var(--sp-4);line-height:1.6;">${msg}</p>
    <div class="modal-footer">
      <button class="btn btn-danger" id="confirm-yes">تأكيد</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
  document.getElementById("confirm-yes").onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
}

// ── Input Modal (بديل prompt() الكامل) ──────────────────
export function inputModal(config) {
  /**
   * config: {
   *   title: string,
   *   fields: [{id, label, type, placeholder, required, options:[{value,label}], min, step, value, hint}],
   *   onSubmit: async (values) => void  -- throw Error to show error msg
   *   submitLabel?: string,
   *   cancelLabel?: string
   * }
   */
  const fieldsHtml = config.fields.map(f => {
    if (f.type === "select") {
      return `
        <div class="form-group">
          <label>${f.label}${f.required ? ' <span style="color:var(--c-danger)">*</span>' : ''}</label>
          <select id="ifield-${f.id}">
            <option value="">-- اختر --</option>
            ${(f.options||[]).map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
          ${f.hint ? `<small style="color:var(--c-text-muted);font-size:12px;">${f.hint}</small>` : ''}
        </div>`;
    }
    if (f.type === "textarea") {
      return `
        <div class="form-group">
          <label>${f.label}${f.required ? ' <span style="color:var(--c-danger)">*</span>' : ''}</label>
          <textarea id="ifield-${f.id}" placeholder="${f.placeholder||''}">${f.value||''}</textarea>
        </div>`;
    }
    return `
      <div class="form-group">
        <label>${f.label}${f.required ? ' <span style="color:var(--c-danger)">*</span>' : ''}</label>
        <input
          type="${f.type||'text'}"
          id="ifield-${f.id}"
          placeholder="${f.placeholder||''}"
          ${f.min !== undefined ? `min="${f.min}"` : ''}
          ${f.max !== undefined ? `max="${f.max}"` : ''}
          ${f.step ? `step="${f.step}"` : ''}
          ${f.value !== undefined ? `value="${f.value}"` : ''}
          ${f.required ? 'required' : ''}
        >
        ${f.hint ? `<small style="color:var(--c-text-muted);font-size:12px;margin-top:4px;display:block;">${f.hint}</small>` : ''}
      </div>`;
  }).join('');

  modal(`
    <h3 class="modal-title">${config.title}</h3>
    ${fieldsHtml}
    <div id="input-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:var(--r-md);padding:10px 14px;color:#f87171;font-size:13px;margin-bottom:var(--sp-4);"></div>
    <div class="modal-footer">
      <button class="btn" id="input-submit">${config.submitLabel||'حفظ'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${config.cancelLabel||'إلغاء'}</button>
    </div>
  `, { preventClose: true });

  const submitBtn = document.getElementById("input-submit");
  const errorDiv  = document.getElementById("input-error");

  function showError(msg) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = `⚠️ ${msg}`;
  }

  submitBtn.onclick = async () => {
    const values = {};
    let valid = true;
    errorDiv.style.display = 'none';

    for (const f of config.fields) {
      const el = document.getElementById(`ifield-${f.id}`);
      if (!el) continue;
      const raw = el.value.trim();

      if (f.required && !raw) {
        showError(`الحقل "${f.label}" مطلوب`);
        el.focus();
        valid = false;
        break;
      }

      if (f.type === 'number' && raw) {
        const num = parseFloat(raw);
        if (isNaN(num)) { showError(`"${f.label}" يجب أن يكون رقماً`); valid = false; break; }
        if (f.min !== undefined && num < f.min) { showError(`"${f.label}" يجب أن يكون ≥ ${f.min}`); valid = false; break; }
        values[f.id] = num;
      } else {
        values[f.id] = raw;
      }
    }

    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:auto;"></span>';

    try {
      await config.onSubmit(values);
    } catch (err) {
      showError(err?.message || String(err));
      submitBtn.disabled = false;
      submitBtn.textContent = config.submitLabel || 'حفظ';
    }
  };

  // Focus first field
  setTimeout(() => {
    const first = document.getElementById(`ifield-${config.fields[0]?.id}`);
    if (first) first.focus();
  }, 120);
}

// ── Loading Skeleton ──────────────────────────────────────
export function loading(el, rows = 4) {
  if (!el) return;
  el.innerHTML = Array(rows).fill(0).map((_, i) => `
    <div class="skeleton skeleton-card" style="height:${i%3===0?100:70}px;opacity:${1-i*0.12}"></div>
  `).join('');
}

// ── Empty State ───────────────────────────────────────────
export function emptyState(icon, title, sub, actionHtml = '') {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">${sub}</div>
      ${actionHtml}
    </div>`;
}

// ── Format Currency ───────────────────────────────────────
export function formatCurrency(num) {
  const n = Number(num || 0);
  return n.toLocaleString("ar-EG", { minimumFractionDigits:0, maximumFractionDigits:2 }) + " ج";
}

// ── Format Date ───────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return "–";
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG", { year:'numeric', month:'short', day:'numeric' });
  } catch { return dateStr; }
}

// ── Mobile Card Table ────────────────────────────────────
export function mobileCardTable(items, columns, getActions) {
  if (!items?.length) return emptyState('📋','لا يوجد بيانات','ستظهر البيانات هنا عند إضافتها');

  const fmt = (col, item) => col.format ? col.format(item[col.key], item) : (item[col.key] ?? '–');

  return `
    <!-- Desktop Table -->
    <div class="table-wrapper table-desktop">
      <table class="table">
        <thead>
          <tr>
            ${columns.map(c=>`<th>${c.label}</th>`).join('')}
            ${getActions ? '<th>إجراءات</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${items.map(item=>`
            <tr>
              ${columns.map(c=>`<td>${fmt(c,item)}</td>`).join('')}
              ${getActions ? `<td><div style="display:flex;gap:6px;">${getActions(item)}</div></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="mobile-card-list">
      ${items.map(item=>`
        <div class="card" style="padding:var(--sp-4);margin-bottom:var(--sp-3);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3);">
            <div style="font-weight:700;font-size:15px;">${fmt(columns[0],item)}</div>
            ${getActions ? `<div style="display:flex;gap:6px;flex-shrink:0;">${getActions(item)}</div>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2);">
            ${columns.slice(1,4).map(c=>`
              <div>
                <div style="font-size:11px;color:var(--c-text-muted);">${c.label}</div>
                <div style="font-size:13px;font-weight:600;">${fmt(c,item)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ── Backward compat ───────────────────────────────────────
export function confirmDialog(msg) { return window.confirm(msg); }
