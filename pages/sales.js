import { supabase, dbUpdate, addAuditLog, sellProductAtomic, ensureUser } from "../data.js";
import { toast, inputModal, formatCurrency, formatDate } from "../ui.js";

// مرتجع المورد (يرد كمية فقط قبل إغلاق الفاتورة)
async function returnProductAtomic(productId, qty) {
  const user = await ensureUser();

  const { error } = await supabase.rpc("return_product_atomic", {
    p_product_id: productId,
    p_qty: qty,
    p_user_id: user.id
  });

  if (error) return { success:false, error:error.message };

  return { success:true };
}

export async function renderSalesPage(app){
  const user = await ensureUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id",user.id)
    .eq("status","confirmed")
    .order("date",{ascending:false});

  app.innerHTML=`
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">🛒 المبيعات</div>
        <div class="page-subtitle">${(invoices||[]).length} فاتورة مفتوحة للبيع</div>
      </div>
    </div>

    ${
      !(invoices||[]).length
      ? `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">لا توجد فواتير مفتوحة</div>
      </div>`
      :
      (invoices||[]).map(inv=>`
      <div class="card" onclick="openSalesInvoice('${inv.id}')" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between">
          <div>
            <div style="font-weight:700">🚚 ${inv.supplier_name}</div>
            <div style="font-size:12px;color:var(--c-text-muted)">
              ${formatDate(inv.date)}
            </div>
          </div>
          <button class="btn btn-sm">بيع →</button>
        </div>
      </div>
      `).join('')
    }
  `;
}

window.openSalesInvoice = async function(invoiceId){

  const app=document.getElementById("app");

  const [
    {data:invoice},
    {data:products}
  ] = await Promise.all([
    supabase.from("invoices").select("*").eq("id",invoiceId).single(),
    supabase.from("invoice_products").select("*").eq("invoice_id",invoiceId).order("name")
  ]);

  const sold=(products||[]).reduce((s,p)=>s+Number(p.sold||0),0);
  const rem=(products||[]).reduce(
    (s,p)=>s+((p.qty||0)-(p.sold||0)-(p.returned||0)),0
  );

  app.innerHTML=`
   <button class="btn btn-ghost btn-sm"
      onclick="navigate('sales')">← رجوع</button>

   <div class="page-header">
     <div class="page-title">🛒 ${invoice.supplier_name}</div>
     <div class="page-subtitle">
       مباع ${sold} • متبقي ${rem}
     </div>
   </div>

   ${renderProducts(products,invoiceId)}
  `;
}

function renderProducts(products,invoiceId){

 if(!products?.length){
   return `<div class="card">لا توجد أصناف</div>`;
 }

 return products.map(p=>{

   const rem=(p.qty||0)-(p.sold||0)-(p.returned||0);

   return `
   <div class="card">
      <div style="display:flex;justify-content:space-between">
         <div>
            <div style="font-weight:700">📦 ${p.name}</div>
            <div style="font-size:12px;color:var(--c-text-muted)">
              الكمية ${p.qty}
              | مباع ${p.sold||0}
              | مرتجع ${p.returned||0}
            </div>
         </div>

         <div style="font-weight:800">
           متبقي ${rem}
         </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:14px">
       ${
         rem>0
         ? `<button class="btn"
             onclick="sellProduct('${p.id}','${invoiceId}')">
             💰 بيع
           </button>`
         :`<span class="badge badge-red">نفذ</span>`
       }

       ${
         rem>0
         ? `<button class="btn btn-warning btn-sm"
             onclick="returnProduct('${p.id}','${invoiceId}')">
             ↩️ رفع مورد
            </button>`
         :''
       }
      </div>
   </div>
   `;

 }).join('');
}


// ======================================
// البيع الكامل (Cash / Credit / Shop)
// ======================================
window.sellProduct = async function(productId,invoiceId){

 if(window._saleLock){
   toast("عملية جارية...","warning");
   return;
 }

 const [
   {data:customers},
   {data:shops}
 ]=await Promise.all([
   supabase.from("customers").select("id,full_name"),
   supabase.from("market_shops").select("id,name")
 ]);

 inputModal({
   title:"💰 تسجيل بيع",

   fields:[
    {
      id:"qty",
      label:"الكمية",
      type:"number",
      required:true
    },

    {
      id:"price",
      label:"السعر",
      type:"number",
      required:true
    },

    {
      id:"type",
      label:"نوع البيع",
      type:"select",
      required:true,
      options:[
       {value:"cash",label:"💵 كاش"},
       {value:"credit",label:"📋 آجل"},
       {value:"shop",label:"🏬 محل"}
      ]
    },

    {
      id:"customer_id",
      label:"العميل",
      type:"select",
      options:(customers||[]).map(c=>({
         value:c.id,
         label:c.full_name
      }))
    },

    {
      id:"shop_id",
      label:"المحل",
      type:"select",
      options:(shops||[]).map(s=>({
         value:s.id,
         label:s.name
      }))
    }
   ],

   submitLabel:"✅ تأكيد البيع",

   onSubmit: async(vals)=>{

      if(vals.type==="credit" && !vals.customer_id){
        throw new Error("اختر العميل");
      }

      if(vals.type==="shop" && !vals.shop_id){
        throw new Error("اختر المحل");
      }

      window._saleLock=true;

      try{

        const customerName=
          vals.customer_id
          ? (customers||[]).find(
             x=>x.id===vals.customer_id
            )?.full_name
          : null;

        const result=
          await sellProductAtomic({

            p_product_id:productId,
            p_invoice_id:invoiceId,

            p_qty:vals.qty,
            p_price:vals.price,
            p_total:vals.qty*vals.price,

            p_type:vals.type,

            p_customer_id:
              vals.customer_id||null,

            p_shop_id:
              vals.shop_id||null,

            p_customer_name:
              customerName,

            p_date:
             new Date()
             .toISOString()
             .split("T")[0]

          });

        if(!result.success){
          throw new Error(result.error);
        }

        await addAuditLog(
         "sell_product",
         {
           productId,
           qty:vals.qty,
           price:vals.price,
           type:vals.type
         }
        );

        await checkInvoiceClose(invoiceId);

        closeModal();

        toast(
         "تم البيع بنجاح",
         "success"
        );

        openSalesInvoice(invoiceId);

      }finally{
        window._saleLock=false;
      }
   }

 });

};



// ======================================
// رفع مورد (لا يدخل في المبيعات)
// ======================================
window.returnProduct = async function(productId,invoiceId){

 inputModal({
   title:"↩️ رفع بضاعة للمورد",

   fields:[
    {
      id:"qty",
      label:"الكمية المرفوعة",
      type:"number",
      required:true
    }
   ],

   submitLabel:"تأكيد",

   onSubmit: async(vals)=>{

      const r=
       await returnProductAtomic(
         productId,
         vals.qty
       );

      if(!r.success){
        throw new Error(r.error);
      }

      await addAuditLog(
       "return_product",
       {
         productId,
         qty:vals.qty
       }
      );

      await checkInvoiceClose(invoiceId);

      closeModal();

      toast(
       "تم رفع البضاعة",
       "success"
      );

      openSalesInvoice(invoiceId);
   }
 });

};


// ======================================
// إغلاق الفاتورة تلقائي
// gross من البيع الفعلي فقط
// returned لا يدخل
// ======================================
async function checkInvoiceClose(invoiceId){

 const {data:products}=await supabase
   .from("invoice_products")
   .select("*")
   .eq("invoice_id",invoiceId);

 const allDone=(products||[])
 .every(p=>
   ((p.qty||0)
   -(p.sold||0)
   -(p.returned||0))<=0
 );

 if(!allDone) return;

 const {data:invoice}=await supabase
   .from("invoices")
   .select("*")
   .eq("id",invoiceId)
   .single();

 if(!invoice || invoice.status!=="confirmed"){
   return;
 }

 // مهم:
 // sales_total = بيع فعلي فقط
 const gross=(products||[])
 .reduce(
   (s,p)=>s+Number(
      p.sales_total||0
   ),
   0
 );

 const rate=invoice.commission_rate||0.07;

 const commission=
   gross*rate;

 const expenses=
  Number(invoice.noulon||0)
 +Number(invoice.mashal||0);

 const net=
   gross
   -commission
   -expenses
   -Number(invoice.advance_payment||0);

 await dbUpdate(
   "invoices",
   invoiceId,
   {
    status:"closed",
    gross,
    commission,
    total_expenses:expenses,
    net
   }
 );

 await addAuditLog(
   "close_invoice",
   {
     invoiceId,
     gross,
     commission,
     net
   }
 );

 toast(
   "🔒 تم إغلاق الفاتورة",
   "info"
 );
}