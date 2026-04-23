// ===============================
// 📦 IMPORTS
// ===============================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js'

// ===============================
// 🔐 INIT SUPABASE
// ===============================
const supabaseUrl = "https://xetbfyhcazqudmoqkqub.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGJmeWhjYXpxdWRtb3FrcXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDg3OTQsImV4cCI6MjA5MjUyNDc5NH0.3P16_0mdi9doQhR5SXtR0HIo6N752sxPJCpK1YShilw";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
// 👤 GET CURRENT USER
// ===============================
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) { console.error(error.message); return null; }
  return data?.user || null;
}

// ===============================
// 📥 INSERT
// ===============================
export async function dbInsert(table, data) {
  const user = await getCurrentUser();
  if (!user) { console.error("No user"); return false; }
  const payload = { ...data, user_id: user.id };
  const { error } = await supabase.from(table).insert(payload);
  if (error) { console.error("INSERT ERROR:", error.message); return false; }
  return true;
}

// ===============================
// ✏️ UPDATE
// ===============================
export async function dbUpdate(table, id, data) {
  const user = await getCurrentUser();
  if (!user) return false;
  const { error } = await supabase.from(table).update(data).eq("id", id).eq("user_id", user.id);
  if (error) { console.error("UPDATE ERROR:", error.message); return false; }
  return true;
}

// ===============================
// ❌ DELETE
// ===============================
export async function dbDelete(table, id) {
  const user = await getCurrentUser();
  if (!user) return false;
  const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
  if (error) { console.error("DELETE ERROR:", error.message); return false; }
  return true;
}

// ===============================
// 📤 SELECT
// ===============================
export async function dbSelect(table) {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase.from(table).select("*").eq("user_id", user.id);
  if (error) { console.error("SELECT ERROR:", error.message); return []; }
  return data || [];
}

// ===============================
// 🧾 RPC: confirm_invoice_v2
// ===============================
export async function confirmInvoice(invoiceId) {
  const { error } = await supabase.rpc("confirm_invoice_v2", { p_invoice_id: invoiceId });
  if (error) { console.error("CONFIRM ERROR:", error.message); return false; }
  return true;
}

// ===============================
// 👥 CUSTOMER BALANCE
// ===============================
export async function getCustomerBalance(customerId) {
  const { data, error } = await supabase.from("customer_balances").select("balance").eq("customer_id", customerId).single();
  if (error) { console.error("BALANCE ERROR:", error.message); return 0; }
  return data?.balance || 0;
}

// ===============================
// 📒 CUSTOMER LEDGER
// ===============================
export async function getCustomerLedger(customerId) {
  const { data, error } = await supabase.from("customer_ledger").select("*").eq("customer_id", customerId).order("trx_date", { ascending: true });
  if (error) { console.error("LEDGER ERROR:", error.message); return []; }
  return data || [];
}

// ===============================
// 🆕 AUDIT LOG
// ===============================
export async function addAuditLog(action, details = {}) {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action,
    details: JSON.stringify(details),
    created_at: new Date().toISOString()
  });
}
