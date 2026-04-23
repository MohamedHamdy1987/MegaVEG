import { renderDashboard }
from "./pages/dashboard.js";

window.navigate=
async function(page){

const app=
document.getElementById("app");

if(page==="dashboard"){

try{

await renderDashboard(app);

}

catch(e){

app.innerHTML=
"dashboard crashed";

console.error(e);

}

return;

}

app.innerHTML=
"زر "+page+" يعمل";

};

window.onload=function(){

navigate(
"dashboard"
);

};
