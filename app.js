const DEFAULT_STATE={
  masteredConcepts:36,totalConcepts:50,streak:7,coins:145,lastRewardDate:null,
  simulatorCash:10000,holdings:{},transactions:[]
};
function getState(){const s=localStorage.getItem("marketmind-state");return s?{...DEFAULT_STATE,...JSON.parse(s)}:{...DEFAULT_STATE}}
function saveState(s){localStorage.setItem("marketmind-state",JSON.stringify(s))}
function updateDashboard(){
  const s=getState(); const p=Math.min(100,Math.round((s.masteredConcepts/s.totalConcepts)*100));
  const map={ "progress-text":`${s.masteredConcepts} / ${s.totalConcepts} concepts mastered`,
              "progress-percent":`${p}%`,"streak-count":s.streak,"coin-count":s.coins };
  for(const [id,val] of Object.entries(map)){const e=document.getElementById(id);if(e)e.textContent=val}
  const f=document.getElementById("progress-fill");if(f)f.style.width=`${p}%`;
}
function setupReward(){
  const b=document.getElementById("claim-reward"); if(!b)return;
  const s=getState(),today=new Date().toISOString().slice(0,10);
  if(s.lastRewardDate===today){b.textContent="Claimed ✓";b.disabled=true;return}
  b.addEventListener("click",()=>{const x=getState();x.coins+=15;x.lastRewardDate=today;saveState(x);b.textContent="+15 claimed ✓";b.disabled=true;updateDashboard()})
}
document.addEventListener("DOMContentLoaded",()=>{updateDashboard();setupReward()});

function setupSidebar(){const b=document.getElementById("menu-btn"),s=document.getElementById("sidebar"),c=document.getElementById("sidebar-close"),o=document.getElementById("sidebar-overlay");if(!b||!s)return;const open=()=>{s.classList.add("open");o.classList.add("show")};const close=()=>{s.classList.remove("open");o.classList.remove("show")};b.addEventListener("click",open);c.addEventListener("click",close);o.addEventListener("click",close)}document.addEventListener("DOMContentLoaded",setupSidebar);


function setupBackNavigation() {
  const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (current === "index.html" || current === "") return;

  const shell = document.querySelector("main.shell");
  if (!shell || shell.querySelector(".page-back-row")) return;

  const row = document.createElement("div");
  row.className = "page-back-row";
  row.innerHTML = `
    <button class="back-button" type="button" aria-label="Go back">
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  `;

  row.querySelector(".back-button").addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "index.html";
    }
  });

  shell.prepend(row);
}

document.addEventListener("DOMContentLoaded", setupBackNavigation);


function setupMarketMindMenu() {
  const menu = document.getElementById("menu-btn");
  const side = document.getElementById("sidebar");
  const close = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  if (!menu || !side) return;

  const openMenu = () => {
    side.classList.add("open");
    if (overlay) overlay.classList.add("show");
    document.body.classList.add("menu-open");
  };
  const closeMenu = () => {
    side.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
    document.body.classList.remove("menu-open");
  };

  menu.onclick = openMenu;
  if (close) close.onclick = closeMenu;
  if (overlay) overlay.onclick = closeMenu;
  side.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
}
document.addEventListener("DOMContentLoaded", setupMarketMindMenu);
