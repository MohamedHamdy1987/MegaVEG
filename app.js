// TEST MODE

window.navigate = function(page){

document.getElementById("app").innerHTML =
"<h2>الزر اشتغل: " + page + "</h2>";

};

window.onload = function(){

document.getElementById("app").innerHTML =
"<h2>TEST MODE READY</h2>";

};
