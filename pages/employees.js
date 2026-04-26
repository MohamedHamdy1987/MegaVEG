import { supabase, dbInsert, dbUpdate, ensureUser } from "../data.js";
import { toast, inputModal, confirmModal, formatCurrency } from "../ui.js";

export async function renderEmployeesPage(app){

const user=await ensureUser();

const {data:employees}=await supabase
.from('employees')
.select('*')
.eq('user_id',user.id)
.order('name');

const active=(employees||[]).filter(x=>x.active!==false);
const inactive=(employees||[]).filter(x=>x.active===false);

app.innerHTML=`
<div class='page-header'>
<div class='page-title'>👷 الموظفين</div>
<div class='page-subtitle'>
${active.length} نشط
${inactive.length?(' | '+inactive.length+' معطل'):''}
</div>
<div class='page-actions'>
<button class='btn' onclick='openAddEmployee()'>➕ إضافة موظف</button>
</div>
</div>

<div id='employees-list'>
${renderEmployeeCards(employees||[])}
</div>`;
}

function permissionsLabel(role){
return {
admin:'كل الصلاحيات',
cashier:'مبيعات+خزنة+عملاء',
worker:'عرض فقط'
}[role]||'مخصص';
}

function renderEmployeeCards(list){

if(!list.length){
return `
<div class='empty-state'>
<div class='empty-title'>لا يوجد موظفين</div>
</div>`;
}

return list.map(e=>{

const active=e.active!==false;

return `
<div class='card' ${!active?"style='opacity:.6'":''}>

<div style='display:flex;justify-content:space-between;'>
<div>
<div style='font-weight:700'>👤 ${e.name}</div>
<div>
<span class='badge ${active?'badge-green':'badge-red'}'>
${active?'نشط':'معطل'}
</span>

<span class='badge badge-teal'>
${e.role}
</span>
</div>

<div style='font-size:12px;color:gray'>
صلاحيات: ${permissionsLabel(e.role)}
</div>

${e.salary?
`<div>راتب: ${formatCurrency(e.salary)}</div>`
:''}

</div>

<div>
<button class='btn btn-sm'
onclick="toggleEmployee('${e.id}',${active},'${(e.name||'').replace(/'/g,'&#39;')}','${e.role}')">
${active?'تعطيل':'تفعيل'}
</button>

<button class='btn btn-sm btn-warning'
onclick="openChangeRole('${e.id}','${(e.name||'').replace(/'/g,'&#39;')}','${e.role}')">
صلاحية
</button>
</div>

</div>
</div>`;

}).join('');
}

window.openAddEmployee=async function(){

const user=await ensureUser();

inputModal({
title:'إضافة موظف',
fields:[
{id:'name',label:'اسم',type:'text',required:true},
{id:'role',label:'صلاحية',type:'select',required:true,
options:[
{value:'worker',label:'عامل'},
{value:'cashier',label:'كاشير'},
{value:'admin',label:'مدير'}
]},
{id:'salary',label:'راتب',type:'number',value:0}
],

onSubmit:async(vals)=>{

if(vals.role==='admin'){
const {data:admins}=await supabase
.from('employees')
.select('id')
.eq('user_id',user.id)
.eq('role','admin')
.eq('active',true);

if(admins?.length)
throw new Error('مسموح Admin واحد فقط');
}

await dbInsert('employees',{
name:vals.name,
role:vals.role,
salary:vals.salary||0,
active:true
});

closeModal();
navigate('employees');
}
});
};

window.toggleEmployee=async function(id,currentActive,name,role){

const user=await ensureUser();

confirmModal(
`تأكيد العملية على ${name}`,
async()=>{

if(currentActive){

if(role==='admin'){
const {data:admins}=await supabase
.from('employees')
.select('id')
.eq('user_id',user.id)
.eq('role','admin')
.eq('active',true);

if((admins||[]).length<=1){
toast('لا يمكن تعطيل آخر Admin','error');
return;
}
}

// حماية من تعطيل نفسك (لو ربطت employee_user_id مستقبلاً)
if(id===user.id){
toast('لا يمكنك تعطيل نفسك','error');
return;
}

}

await dbUpdate('employees',id,{
active:!currentActive
});

navigate('employees');
}
);
};

window.openChangeRole=async function(id,name,currentRole){

const user=await ensureUser();

inputModal({
title:'تعديل صلاحية',
fields:[
{id:'role',label:'الدور',type:'select',
options:[
{value:'worker',label:'عامل'},
{value:'cashier',label:'كاشير'},
{value:'admin',label:'مدير'}
]}
],

onSubmit:async(vals)=>{

if(currentRole==='admin' && vals.role!=='admin'){

const {data:admins}=await supabase
.from('employees')
.select('id')
.eq('user_id',user.id)
.eq('role','admin')
.eq('active',true);

if((admins||[]).length<=1)
throw new Error('لا يمكن تغيير آخر Admin');

}

if(vals.role==='admin' && currentRole!=='admin'){

const {data:admins}=await supabase
.from('employees')
.select('id')
.eq('user_id',user.id)
.eq('role','admin')
.eq('active',true);

if(admins?.length)
throw new Error('يوجد Admin بالفعل');
}

await dbUpdate('employees',id,{
role:vals.role
});

closeModal();
navigate('employees');

}
});
};