// Presentation-only control: existing Employee PWA API performs the actual punch.
(function(){
  const select=document.getElementById("event-type");
  const buttons=Array.from(document.querySelectorAll("[data-punch]"));
  if(!select||buttons.length!==2)return;
  function sync() {
    for(const button of buttons){
      const selected=button.dataset.punch===select.value;
      button.classList.toggle("active",selected);
      button.setAttribute("aria-pressed",String(selected));
    }
  }
  for(const button of buttons)button.addEventListener("click",()=>{select.value=button.dataset.punch;sync();});
  select.addEventListener("change",sync);
  sync();
})();
