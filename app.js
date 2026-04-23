import {
renderCustomersPage
}
from "./pages/customers.js";

window.navigate=
async function(page){

const app=
document.getElementById("app");

if(page==="customers"){

try{

await renderCustomersPage(app);

}

catch(e){

app.innerHTML=
"customers crashed";

console.error(e);

}

return;

}

app.innerHTML=
"زر يعمل";

};

window.onload=function(){

navigate(
"customers"
);

};
