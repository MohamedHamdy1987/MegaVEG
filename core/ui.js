// ===============================
// 🔔 TOAST PRO
// ===============================
export function toast(msg, type="success") {
  const el = document.createElement("div");

  el.className = "toast";
  el.innerText = msg;

  el.style.background = type === "error" ? "#ef4444" : "#22c55e";

  document.getElementById("toast").appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, 2500);
}

// ===============================
// 📦 MODAL PRO
// ===============================
export function modal(content) {
  const m = document.getElementById("modal");

  m.innerHTML = `
    <div class="card fade-in">
      ${content}
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>
  `;

  m.classList.remove("hidden");
}

export function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

// ===============================
// ⏳ LOADING
// ===============================
export function loading(el) {
  el.innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;
}