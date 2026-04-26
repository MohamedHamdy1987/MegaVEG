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

// جرب الجلسة أولاً (أثبت مع GitHub Pages)
const { data: sessionData } =
await supabase.auth.getSession();

if (
sessionData?.session?.user
){
return sessionData.session.user;
}

// fallback
const { data, error } =
await supabase.auth.getUser();

if(error || !data?.user){
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

/* إصلاح invoice_products */
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

/* confirm invoice */
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

/* إصلاح boolean */
return {
success:
data===true,
data
};

}

/* sell product */
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

/* إصلاح boolean */
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
/* jsonb */
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
