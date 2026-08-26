
const concepts=[
{title:"Revenue",category:"Accounting",description:"Revenue is total income from normal business activities before expenses.",formula:"",example:"Example: €10M sales means €10M revenue before costs.",hints:["Think of the top line of the income statement.","It is recorded before subtracting operating costs."]},
{title:"Operating Margin",category:"Financial Analysis",description:"Shows what percentage of revenue remains as operating profit.",formula:"Operating Margin = Operating Income ÷ Revenue × 100",example:"€20M operating income on €100M revenue = 20%.",hints:["Use Operating Income in the numerator.","This margin focuses on operating profitability, not Net Income."]},
{title:"Free Cash Flow",category:"Cash Flow",description:"Cash remaining after CapEx is deducted from OCF.",formula:"FCF = OCF − CapEx",example:"€120M OCF − €50M CapEx = €70M FCF.",hints:["Start from Operating Cash Flow.","Long-term investment spending must still be deducted."]},
{title:"Net Debt",category:"Capital Structure",description:"Debt after subtracting cash.",formula:"Net Debt = Debt − Cash",example:"€500M debt − €200M cash = €300M net debt.",hints:["Cash can offset part of the debt burden.","Do not add cash to debt."]},
{title:"Earnings Quality",category:"Financial Analysis",description:"How sustainable and cash-supported reported profit appears to be.",formula:"",example:"Rising Net Income with collapsing OCF may weaken earnings quality.",hints:["Compare accounting profit with cash generation.","Ask whether the earnings are sustainable and recurring."]}
];

let current=0;
let mastered=0;
let reviewQueue=[];
let unfamiliar=new Set();
let phase="learn";
let hintIndex=0;

const el = id => document.getElementById(id);

function syncCoins(){
  const s=getState();
  el("lesson-coin-balance").textContent=`${s.coins} MindCoins`;
}

function render(){
  const c=concepts[current];
  hintIndex=0;
  el("concept-title").textContent=c.title;
  el("concept-category").textContent=c.category;
  el("concept-description").textContent=c.description;
  el("concept-example").textContent=c.example;
  const f=el("formula-box");
  f.textContent=c.formula;
  f.classList.toggle("hidden",!c.formula);
  el("lesson-help-box").classList.add("hidden");
  el("lesson-help-box").textContent="";
  el("lesson-phase").textContent=phase==="review" ? "Review" : "Learning";
  const done = phase==="review"
    ? concepts.length - reviewQueue.length
    : Math.min(mastered, concepts.length);
  el("lesson-progress-fill").style.width=`${(done/concepts.length)*100}%`;
  el("lesson-progress-text").textContent=phase==="review"
    ? `${reviewQueue.length + 1} review concept(s) remaining`
    : `${mastered} / ${concepts.length} known`;
  syncCoins();
}

function advanceLearn(){
  if(current<concepts.length-1){
    current++;
    render();
  }else{
    showReviewOrComplete();
  }
}

function showReviewOrComplete(){
  el("lesson-card").classList.add("hidden");
  if(unfamiliar.size){
    const list=el("review-list");
    list.innerHTML="";
    [...unfamiliar].forEach(idx=>{
      const c=concepts[idx];
      list.insertAdjacentHTML("beforeend",`
        <div class="review-item">
          <div><strong>${c.title}</strong><small>${c.category}</small></div>
          <span>Review</span>
        </div>`);
    });
    el("lesson-review").classList.remove("hidden");
  }else{
    finishLesson();
  }
}

function finishLesson(){
  el("lesson-card").classList.add("hidden");
  el("lesson-review").classList.add("hidden");
  el("lesson-complete").classList.remove("hidden");
  el("lesson-summary").textContent=`You knew ${mastered}/${concepts.length} concepts in the first round and reviewed ${unfamiliar.size} unfamiliar term(s).`;
}

el("know-btn").onclick=()=>{
  if(phase==="learn"){
    mastered++;
    advanceLearn();
  }else{
    unfamiliar.delete(current);
    if(reviewQueue.length){
      current=reviewQueue.shift();
      render();
    }else{
      finishLesson();
    }
  }
};

el("again-btn").onclick=()=>{
  if(phase==="learn"){
    unfamiliar.add(current);
    advanceLearn();
  }else{
    // Keep it in the queue one more time, but do not create an infinite duplicate loop.
    if(!reviewQueue.includes(current)) reviewQueue.push(current);
    if(reviewQueue.length){
      current=reviewQueue.shift();
      render();
    }
  }
};

el("start-review-btn").onclick=()=>{
  phase="review";
  reviewQueue=[...unfamiliar];
  el("lesson-review").classList.add("hidden");
  el("lesson-card").classList.remove("hidden");
  current=reviewQueue.shift();
  render();
};

el("lesson-hint-btn").onclick=()=>{
  const c=concepts[current];
  if(!spendMindCoins(3,"Lesson hint")) return;
  const hint=c.hints[Math.min(hintIndex,c.hints.length-1)];
  hintIndex++;
  const box=el("lesson-help-box");
  box.textContent=`Hint ${Math.min(hintIndex,c.hints.length)}: ${hint}`;
  box.classList.remove("hidden");
  syncCoins();
};

el("lesson-answer-btn").onclick=()=>{
  if(!spendMindCoins(10,"Full explanation")) return;
  const c=concepts[current];
  const box=el("lesson-help-box");
  box.innerHTML=`<strong>${c.title}</strong><br>${c.description}${c.formula?`<br><br><strong>Formula:</strong> ${c.formula}`:""}<br><br>${c.example}`;
  box.classList.remove("hidden");
  syncCoins();
};

el("sign-lesson-contract").onclick=async()=>{
  const knownFirstRound=mastered;
  const reviewedCount=unfamiliar.size; // Usually zero after completed review; summary state is still saved below.
  const xp=40 + knownFirstRound*12;
  const coins=10 + knownFirstRound*4;
  const signed=await signFinanceContract({
    title:"Daily Lesson Completion Contract",
    rewardXp:xp,
    rewardCoins:coins,
    activity:"Lesson contract"
  });
  if(!signed) return;

  const s=getState();
  s.masteredConcepts=Math.min(s.totalConcepts,(s.masteredConcepts||0)+knownFirstRound);
  s.lessonCompletions=(s.lessonCompletions||0)+1;
  s.lastLessonUnknownCount=[...unfamiliar].length;
  saveState(s);
  location.href="index.html";
};

render();
