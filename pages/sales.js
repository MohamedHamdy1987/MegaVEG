import {
supabase,
dbUpdate,
addAuditLog,
sellProductAtomic,
ensureUser
} from "../data.js";

import {
toast,
inputModal,
formatDate
} from "../ui.js";


async function returnProductAtomic(productId,qty){

const user=await ensureUser();

const {error}=await supabase.rpc(
"return_product_atomic",
{
p_product_id:productId,
p_qty:qty,
p_user_id:user.id
}
);

if(error){
return {
success:false,
error:error.message
};
}

return {success:true};

}



export async function renderSalesPage(app){

const user=await ensureUser();

const {data:invoices}=await supabase
.from("invoices")
.select("*")
.eq("user_id",user.id)
.eq("status","confirmed")
.order("date",{ascending:false});

app.innerHTML=`

<div class="page-header">
<div class="page-title">
🛒 المبيعات
</div>
</div>

${
!(invoices||[]).length
?

`<div class="card">
لا توجد فواتير مفتوحة
</div>`

:

(invoices||[]).map(inv=>`

<div class="card"
onclick="openSalesInvoice('${inv.id}')">

<div style="display:flex;justify-content:space-between">

<div>
<div style="font-weight:700">
${inv.supplier_name}
</div>

<div>
${formatDate(inv.date)}
</div>

</div>

<button class="btn">
بيع
</button>

</div>

</div>

`).join('')
}

`;

}



window.openSalesInvoice=
async function(invoiceId){

const app=
document.getElementById(
"app"
);

const[
{data:invoice},
{data:products}
]=await Promise.all([

supabase
.from("invoices")
.select("*")
.eq("id",invoiceId)
.single(),

supabase
.from("invoice_products")
.select("*")
.eq("invoice_id",invoiceId)

]);

app.innerHTML=`

<button
class="btn"
onclick="
navigate('sales')
">
رجوع
</button>

<h3>
${invoice.supplier_name}
</h3>

${renderProducts(
products,
invoiceId
)}

`;

};



function renderProducts(
products,
invoiceId
){

if(!products?.length){

return `
<div class='card'>
لا توجد أصناف
</div>
`;

}

return products.map(p=>{

const rem=
Number(p.qty||0)
-
Number(p.sold||0)
-
Number(p.returned||0);

return `

<div class="card">

<div style="
display:flex;
justify-content:space-between;
">

<div>
<b>${p.name}</b>
<div>
كمية:
${p.qty}

|
مباع:
${p.sold||0}
</div>
</div>

<div>
متبقي
${rem}
</div>

</div>


<div style="
margin-top:15px;
display:flex;
gap:10px;
">

${
rem>0
?

`
<button
class='btn'
onclick="
sellProduct(
'${p.id}',
'${invoiceId}'
)">
💰 بيع
</button>
`

:
"نفذ"
}

</div>

</div>

`;

}).join('');

}



/* ==========================
بيع جديد
========================== */

window.sellProduct=
async function(
productId,
invoiceId
){

if(window._saleLock){
return;
}

const[
{data:customers},
{data:shops}
]=await Promise.all([

supabase
.from("customers")
.select("id,full_name"),

supabase
.from("market_shops")
.select("id,name")

]);

inputModal({

title:"تسجيل بيع",

fields:[

{
id:"count",
label:"العدد",
type:"number",
required:true
},

{
id:"weight",
label:"الوزن (اختياري)",
type:"number"
},

{
id:"price",
label:"السعر",
type:"number",
required:true
},

{
id:"sale_type",
label:"نوع البيع",
type:"select",
options:[

{
value:"cash",
label:"كاش"
},

{
value:"credit",
label:"آجل"
}

]

},

{
id:"customer_id",
label:"اختيار عميل",
type:"select",
options:[
{
value:"",
label:"-- اختر --"
},
...(customers||[]).map(c=>({
value:c.id,
label:c.full_name
}))
]
},

{
id:"shop_id",
label:"اختيار محل",
type:"select",
options:[
{
value:"",
label:"-- اختر --"
},
...(shops||[]).map(s=>({
value:s.id,
label:s.name
}))
]
}

],

submitLabel:"تأكيد البيع",


onSubmit:
async(vals)=>{

const count=
Number(
vals.count||0
);

const weight=
Number(
vals.weight||0
);

const price=
Number(
vals.price||0
);

/* المنطق التلقائي */
const total=
weight>0
?
weight*price
:
count*price;


/* لو آجل لازم جهة واحدة فقط */
if(
vals.sale_type==="credit"
){

if(
!vals.customer_id &&
!vals.shop_id
){
throw new Error(
"اختر عميل أو محل"
);
}

if(
vals.customer_id &&
vals.shop_id
){
throw new Error(
"اختر جهة واحدة فقط"
);
}

}


/* لو كاش تجاهل العميل والمحل */
let customerId=null;
let shopId=null;
let customerName=null;

if(
vals.sale_type==="credit"
){

customerId=
vals.customer_id||null;

shopId=
vals.shop_id||null;

if(customerId){

customerName=
(customers||[])
.find(
x=>x.id===customerId
)?.full_name;

}

}


window._saleLock=true;

try{

const r=
await sellProductAtomic({

p_product_id:
productId,

p_invoice_id:
invoiceId,

p_qty:count,

p_count:count,

p_weight:
weight||null,

p_price:price,

p_total:total,

p_type:
vals.sale_type,

p_customer_id:
customerId,

p_shop_id:
shopId,

p_customer_name:
customerName,

p_date:
new Date()
.toISOString()
.split("T")[0]

});

if(!r.success){

throw new Error(
r.error
);

}

await addAuditLog(
"sell_product",
{
productId,
count,
weight,
price,
total
}
);

await checkInvoiceClose(
invoiceId
);

closeModal();

toast(
"تم البيع",
"success"
);

openSalesInvoice(
invoiceId
);

}
finally{

window._saleLock=false;

}

}

});

};



/* ======================
رفع مورد
====================== */

window.returnProduct=
async function(
productId,
invoiceId
){

inputModal({

title:"رفع بضاعة",

fields:[

{
id:"qty",
label:"الكمية",
type:"number"
}

],

onSubmit:
async(vals)=>{

const r=
await returnProductAtomic(
productId,
vals.qty
);

if(!r.success){

throw new Error(
r.error
);

}

await checkInvoiceClose(
invoiceId
);

closeModal();

openSalesInvoice(
invoiceId
);

}

});

};



async function checkInvoiceClose(
invoiceId
){

const {data:products}=await supabase
.from("invoice_products")
.select("*")
.eq(
"invoice_id",
invoiceId
);

const done=
(products||[])
.every(p=>

(
Number(p.qty)
-
Number(p.sold)
-
Number(p.returned)
)<=0

);

if(!done){
return;
}

const {data:invoice}=await supabase
.from("invoices")
.select("*")
.eq("id",invoiceId)
.single();

const gross=
(products||[])
.reduce(
(s,p)=>
s+
Number(
p.sales_total||0
),
0
);

const rate=
invoice.commission_rate||0.07;

const commission=
gross*rate;

const net=
gross
-commission
-Number(
invoice.noulon||0
)
-Number(
invoice.mashal||0
)
-Number(
invoice.advance_payment||0
);

await dbUpdate(
"invoices",
invoiceId,
{
status:"closed",
gross,
commission,
net
}
);

}
