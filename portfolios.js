
const PF_KEY = "mm-pfs";
const PF_ACTIVE_KEY = "mm-active-pf-v14";

function pfLoad(){
  let items=[];
  try{ items=JSON.parse(localStorage.getItem(PF_KEY)||"[]"); }catch{}
  let changed=false;
  items=items.map((p,i)=>{
    if(!p.id){ p.id=`pf-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`; changed=true; }
    if(p.start==null){ p.start=Number(p.capital)||10000; changed=true; }
    if(p.capital==null){ p.capital=p.start; changed=true; }
    p.style ||= "Balanced";
    p.accountType ||= "CASH";
    return p;
  });
  if(!items.length){
    items=[{id:"pf-main",name:"Main Portfolio",capital:10000,start:10000,style:"Balanced",accountType:"CASH"}];
    changed=true;
  }
  if(changed) pfSave(items);
  if(!localStorage.getItem(PF_ACTIVE_KEY)) localStorage.setItem(PF_ACTIVE_KEY,items[0].id);
  return items;
}
function pfSave(items){localStorage.setItem(PF_KEY,JSON.stringify(items))}
function pfActive(){return localStorage.getItem(PF_ACTIVE_KEY)}
function pfSetActive(id){localStorage.setItem(PF_ACTIVE_KEY,id);render()}
function brokerKey(id){return `marketmind-broker-v14:${id}`}

function showPortfolioMessage(message){
  const box=document.getElementById("pf-global-msg"); if(!box)return;
  box.textContent=message; box.classList.remove("hidden");
  clearTimeout(window.__pfToastTimer);
  window.__pfToastTimer=setTimeout(()=>box.classList.add("hidden"),2800);
}

function render(){
  const box=document.getElementById("pf-list"),items=pfLoad(),active=pfActive();
  box.innerHTML="";
  items.forEach((p,i)=>{
    const isActive=p.id===active;
    box.insertAdjacentHTML("beforeend",`
      <div class="portfolio-row ${isActive?"active":""}">
        <div>
          <strong>${p.name}</strong>
          <small>Start €${Number(p.start).toLocaleString()} · ${p.style} · ${p.accountType==="MARGIN"?"Margin":"Cash"} account</small>
        </div>
        <div class="portfolio-row-actions">
          <button class="btn ${isActive?"secondary":"ghost"}" onclick="pfSetActive('${p.id}')">${isActive?"Active":"Select"}</button>
          <button class="btn ghost" onclick="resetPF(${i})">Reset</button>
          <button class="btn ghost danger-outline" onclick="deletePF(${i})">Delete</button>
        </div>
      </div>`);
  });
}

function resetPF(i){
  const items=pfLoad(),p=items[i]; if(!p)return;
  if(!confirm(`Reset "${p.name}"? This restores starting capital and clears all simulator positions, orders and replay data.`))return;
  p.capital=p.start;
  pfSave(items);
  localStorage.removeItem(brokerKey(p.id));
  render();
  showPortfolioMessage(`"${p.name}" reset to €${Number(p.start).toLocaleString()}.`);
}

function deletePF(i){
  const items=pfLoad(),p=items[i]; if(!p)return;
  if(items.length===1){showPortfolioMessage("Keep at least one portfolio.");return}
  if(!confirm(`Delete "${p.name}"?`))return;
  localStorage.removeItem(brokerKey(p.id));
  items.splice(i,1);
  if(p.id===pfActive()) localStorage.setItem(PF_ACTIVE_KEY,items[0].id);
  pfSave(items);render();showPortfolioMessage("Portfolio deleted.");
}

document.getElementById("pf-create").onclick=()=>{
  const c=Number(document.getElementById("pf-capital").value);
  if(c<1000||c>1e9){document.getElementById("pf-msg").textContent="Choose €1,000 to €1B";return}
  const items=pfLoad();
  const name=document.getElementById("pf-name").value.trim()||"New Portfolio";
  const p={id:`pf-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,capital:c,start:c,style:document.getElementById("pf-style").value,accountType:"CASH"};
  items.push(p);pfSave(items);localStorage.setItem(PF_ACTIVE_KEY,p.id);
  document.getElementById("pf-msg").textContent="Portfolio created and selected ✓";
  render();
};
render();
