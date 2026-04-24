// ============================================================
// Market Pro – Subscription v4.0
// Uses server-side RPC check (Patch B7) + client fallback
// ============================================================
import { supabase } from "./data.js";

export async function checkSubscription() {
  try {
    // ✅ Primary: server-side check (tamper-proof)
    const { data, error } = await supabase.rpc("check_my_subscription");
    if (!error && data) {
      return data.active === true;
    }
  } catch (_) {
    // fall through to client-side check
  }

  // Fallback: client-side check
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("subscriptions")
      .select("end_date,active")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return false;
    return new Date(data.end_date) >= new Date();
  } catch {
    return false;
  }
}
