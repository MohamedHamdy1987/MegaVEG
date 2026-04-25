import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ===============================
// SUPABASE
// ===============================
const supabaseUrl = "https://xetbfyhcazqudmoqkqub.supabase.co";

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGJmeWhjYXpxdWRtb3FrcXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDg3OTQsImV4cCI6MjA5MjUyNDc5NH0.3P16_0mdi9doQhR5SXtR0HIo6N752sxPJCpK1YShilw";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// ===============================
// AUTH
// ===============================
export async function getCurrentUser(){

 const { data: sessionData } =
 await supabase.auth.getSession();

 console.log("SESSION:",sessionData);

 if(sessionData?.session?.user){
   return sessionData.session.user;
 }

 const { data } =
 await supabase.auth.getUser();

 return data?.user || null;
}
// ===============================
// INSERT
// ===============================
export async function dbInsert(
  table,
  data
){
  const user =
    await getCurrentUser();

  if (!user) return null;

  const payload = {
    ...data,
    user_id: user.id
  };

  const {
    data: inserted,
    error
  } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

  if (error){
    console.error(error.message);
    return null;
  }

  return inserted;
}

// ===============================
// UPDATE
// ===============================
export async function dbUpdate(
 table,
 id,
 data
){
 const user =
   await getCurrentUser();

 if(!user) return false;

 const {error}=await supabase
   .from(table)
   .update(data)
   .eq("id",id)
   .eq("user_id",user.id);

 if(error){
   console.error(error.message);
   return false;
 }

 return true;
}

// ===============================
// DELETE
// ===============================
export async function dbDelete(
 table,
 id
){
 const user=
   await getCurrentUser();

 if(!user) return false;

 const {error}=await supabase
   .from(table)
   .delete()
   .eq("id",id)
   .eq("user_id",user.id);

 if(error){
   console.error(error.message);
   return false;
 }

 return true;
}

// ===============================
// RPC: CONFIRM INVOICE
// ===============================
export async function confirmInvoice(
 invoiceId
){
 const {data,error}=
   await supabase.rpc(
     "confirm_invoice_v2",
     {
      p_invoice_id:invoiceId
     }
   );

 if(error){
   console.error(error.message);

   return {
    success:false,
    error:error.message
   };
 }

 return {
  success:true,
  data
 };
}

// ===============================
// RPC: SELL PRODUCT
// ===============================
export async function sellProductAtomic(
 params
){
 const {data,error}=
   await supabase.rpc(
     "sell_product_atomic",
     params
   );

 if(error){
   console.error(error.message);

   return {
    success:false,
    error:error.message
   };
 }

 return {
  success:true,
  data
 };
}

// ===============================
// CUSTOMER BALANCE
// ===============================
export async function getCustomerBalance(
 customerId
){
 const {data,error}=await supabase
   .from("customer_balances")
   .select("balance")
   .eq(
     "customer_id",
     customerId
   )
   .single();

 if(error) return 0;

 return data?.balance || 0;
}

// ===============================
// CUSTOMER LEDGER
// ===============================
export async function getCustomerLedger(
 customerId
){
 const {data,error}=await supabase
  .from("customer_ledger")
  .select("*")
  .eq(
    "customer_id",
    customerId
  )
  .order(
    "trx_date",
    {ascending:true}
  );

 if(error) return [];

 return data || [];
}

// ===============================
// AUDIT LOG
// ===============================
export async function addAuditLog(
 action,
 details={}
){
 const user=
   await getCurrentUser();

 if(!user) return;

 const {error}=await supabase
  .from("audit_logs")
  .insert({
    user_id:user.id,
    action,
    details:
      JSON.stringify(details),
    created_at:
      new Date()
      .toISOString()
  });

 if(error){
  console.error(
    error.message
  );
 }
}
