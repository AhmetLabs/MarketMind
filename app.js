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
