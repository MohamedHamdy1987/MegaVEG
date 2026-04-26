// ============================================================
// Market Pro – Subscription v4.0 (محسّن للبيئات الخالية من الجداول)
// ============================================================
import { supabase } from "./data.js";

export async function checkSubscription() {
  try {
    // المحاولة الأساسية: فحص عبر RPC (أكثر أماناً)
    const { data, error } = await supabase.rpc("check_my_subscription");
    if (!error && data) {
      return data.active === true;
    }
  } catch (_) {
    // لا توجد دالة RPC – ننتقل للفحص المباشر
  }

  // فحص مباشر من جدول الاشتراكات
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("end_date,active")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // إذا لم يُعثر على أي صف (الجدول فارغ أو لا يوجد اشتراك للمستخدم) نسمح بالدخول
    if (!sub) return true;

    // إذا وُجد صف وغير منتهي الصلاحية
    if (sub.active && new Date(sub.end_date) >= new Date()) return true;

    return false;
  } catch (e) {
    console.warn("فشل فحص الاشتراك، السماح بالدخول:", e);
    // في حالة أي خطأ غير متوقع نسمح بالدخول مؤقتاً
    return true;
  }
}