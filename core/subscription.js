import { supabase } from "./data.js";

// ===============================
// 🎯 CHECK SUBSCRIPTION
// ===============================

export async function checkSubscription() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return false;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();

  if (!data) return false;

  const today = new Date();
  const end = new Date(data.end_date);

  if (end < today) {
    await expireSubscription(user.id);
    return false;
  }

  return true;
}

// ===============================
// ⛔ EXPIRE
// ===============================

async function expireSubscription(userId) {
  await supabase
    .from("subscriptions")
    .update({ active: false })
    .eq("user_id", userId);

  await supabase
    .from("profiles")
    .update({ subscription_status: "expired" })
    .eq("id", userId);
}

// ===============================
// 🆕 CREATE TRIAL
// ===============================

export async function createTrial(userId) {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);

  await supabase.from("subscriptions").insert({
    user_id: userId,
    plan: "trial",
    start_date: today,
    end_date: end,
    active: true
  });
}