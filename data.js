import { createClient }
from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl=
'https://xetbfyhcazqudmoqkqub.supabase.co';

const supabaseKey=
'ANON_KEY';

export const supabase=
createClient(
supabaseUrl,
supabaseKey,
{
auth:{
storage:window.localStorage,
persistSession:true,
detectSessionInUrl:true,
autoRefreshToken:true
}
}
);

export async function getCurrentUser(){

const {data,error}=
await supabase.auth.getUser();

if(error){
return null;
}

if(!data?.user){
const {data:sessionData}=
await supabase.auth.getSession();

if(
sessionData?.session?.user
){
return sessionData
.session.user;
}

return null;
}

return data.user;

}

export async function ensureUser(){

const user=
await getCurrentUser();

if(!user){
throw new Error(
'SESSION_EXPIRED'
);
}

return user;

}

export async function dbInsert(
table,
data
){

const user=
await getCurrentUser();

if(!user){
return null;
}

const payload={
...data,
user_id:user.id
};

const {
data:inserted,
error
}=await supabase
.from(table)
.insert(payload)
.select()
.single();

if(error){
console.error(
error.message
);
return null;
}

return inserted;

}

export async function dbUpdate(
table,
id,
data
){

const user=
await getCurrentUser();

if(!user){
return false;
}

let query=
supabase
.from(table)
.update(data)
.eq('id',id);

/* إصلاح invoice_products – لا user_id على هذا الجدول */
if(
table!==
'invoice_products'
){
query=query.eq(
'user_id',
user.id
);
}

const {error}=await query;

if(error){
console.error(
error.message
);
return false;
}

return true;

}

export async function dbDelete(
table,
id
){

const user=
await getCurrentUser();

if(!user){
return false;
}

const {error}=await supabase
.from(table)
.delete()
.eq('id',id)
.eq('user_id',user.id);

if(error){
console.error(
error.message
);
return false;
}

return true;

}

/* ── confirm invoice ─────────────────────────────────────── */
export async function confirmInvoice(
invoiceId
){

const {
data,
error
}=await supabase.rpc(
'confirm_invoice_v2',
{
p_invoice_id:
invoiceId
}
);

if(error){
console.error(
error.message
);
return {
success:false,
error:error.message
};
}

/* إصلاح boolean – data===true */
return {
success:
data===true,
data
};

}

/* ── sell product atomic ─────────────────────────────────── */
export async function sellProductAtomic(
params
){

const {
data,
error
}=await supabase.rpc(
'sell_product_atomic',
params
);

if(error){
console.error(
error.message
);
return {
success:false,
error:error.message
};
}

/* إصلاح boolean – data===true */
return {
success:
data===true,
data
};

}

export async function getCustomerBalance(
customerId
){

const {
data,
error
}=await supabase
.from(
'customer_balances'
)
.select('balance')
.eq(
'customer_id',
customerId
)
.single();

if(error){
return 0;
}

return data?.balance||0;

}

export async function getCustomerLedger(
customerId
){

const {
data,
error
}=await supabase
.from(
'customer_ledger'
)
.select('*')
.eq(
'customer_id',
customerId
)
.order(
'trx_date',
{ascending:true}
);

if(error){
return [];
}

return data||[];

}

export async function addAuditLog(
action,
details={}
){

const user=
await getCurrentUser();

if(!user){
return;
}

const {error}=await supabase
.from('audit_logs')
.insert({
user_id:user.id,
action,
details,
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

/* ── v5.0 additions ──────────────────────────────────────── */

/**
 * getBusinessName
 * Returns business_name from user_metadata.
 * Falls back to empty string for older accounts (Req 23).
 */
export async function getBusinessName(){
const user=await getCurrentUser();
return user?.user_metadata?.business_name||'';
}

/**
 * getCustomerCrates
 * Returns crate totals (عدايات / برانيك) for a customer.
 */
export async function getCustomerCrates(customerId){
const user=await getCurrentUser();
if(!user) return {adaya:0,barnika:0};

const {data,error}=await supabase
.from('customer_crates')
.select('crate_type,quantity,returned')
.eq('customer_id',customerId)
.eq('user_id',user.id);

if(error||!data) return {adaya:0,barnika:0};

let adaya=0, barnika=0;
for(const row of data){
const net=(row.quantity||0)-(row.returned||0);
if(row.crate_type==='عداية') adaya+=net;
if(row.crate_type==='برنيكة') barnika+=net;
}
return {adaya,barnika};
}

/**
 * getAllCustomerCrateSummaries
 * Returns per-customer net crate balances for the crates page.
 */
export async function getAllCustomerCrateSummaries(){
const user=await getCurrentUser();
if(!user) return [];

const {data,error}=await supabase
.from('customer_crates')
.select(`
  id,
  customer_id,
  customer_name,
  crate_type,
  quantity,
  returned,
  note,
  created_at
`)
.eq('user_id',user.id)
.order('created_at',{ascending:false});

if(error||!data) return [];
return data;
}

/**
 * getSupplierCrates
 * Returns crate totals (outbound / returned) for a supplier.
 */
export async function getSupplierCrates(supplierId){
const user=await getCurrentUser();
if(!user) return {adaya_out:0,adaya_in:0,barnika_out:0,barnika_in:0};

const {data,error}=await supabase
.from('supplier_crates')
.select('crate_type,outbound,returned')
.eq('supplier_id',supplierId)
.eq('user_id',user.id);

if(error||!data) return {adaya_out:0,adaya_in:0,barnika_out:0,barnika_in:0};

let adaya_out=0,adaya_in=0,barnika_out=0,barnika_in=0;
for(const row of data){
if(row.crate_type==='عداية'){
  adaya_out+=(row.outbound||0);
  adaya_in+=(row.returned||0);
}
if(row.crate_type==='برنيكة'){
  barnika_out+=(row.outbound||0);
  barnika_in+=(row.returned||0);
}
}
return {adaya_out,adaya_in,barnika_out,barnika_in};
}

/**
 * getAllSupplierCrateSummaries
 * Returns all supplier crate rows for the crates page.
 */
export async function getAllSupplierCrateSummaries(){
const user=await getCurrentUser();
if(!user) return [];

const {data,error}=await supabase
.from('supplier_crates')
.select(`
  id,
  supplier_id,
  supplier_name,
  crate_type,
  outbound,
  returned,
  note,
  created_at
`)
.eq('user_id',user.id)
.order('created_at',{ascending:false});

if(error||!data) return [];
return data;
}
