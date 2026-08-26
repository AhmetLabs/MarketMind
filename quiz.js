
const quiz=[
{q:"What does FCF measure?",a:["Revenue after COGS","Cash remaining after OCF minus CapEx","Net income before taxes","Debt minus cash"],c:1,e:"FCF = OCF − CapEx.",hints:["Think about cash, not accounting profit.","CapEx is deducted after Operating Cash Flow."]},
{q:"Which formula is Net Debt?",a:["Debt + Cash","Debt − Cash","Cash − Debt","Debt ÷ Revenue"],c:1,e:"Net Debt adjusts debt for available cash.",hints:["Cash offsets part of the debt burden.","Start with Debt, then adjust for Cash."]},
{q:"Revenue rises 25% but AR rises 70%. What should you investigate?",a:["Customer payment speed","Dividend yield first","CapEx automatically lowering OCF","Market cap only"],c:0,e:"AR growing faster than revenue may indicate slower collections.",hints:["AR means customers still owe the company money.","Think about Revenue recorded before cash is collected."]}
];

let i=0,score=0,answered=false,hintIndex=0;
let missed=[];

const q=document.getElementById("quiz-question"),
grid=document.getElementById("answer-grid"),
fb=document.getElementById("quiz-feedback"),
next=document.getElementById("next-question"),
sc=document.getElementById("score-number");

function syncCoins(){document.getElementById("quiz-coin-balance").textContent=`${getState().coins} MindCoins`}

function render(){
  answered=false;
  hintIndex=0;
  q.textContent=quiz[i].q;
  grid.innerHTML="";
  fb.classList.add("hidden");
  next.classList.add("hidden");
  document.getElementById("quiz-help-box").classList.add("hidden");
  document.getElementById("quiz-help-box").textContent="";
  document.getElementById("quiz-progress-pill").textContent=`Question ${i+1} / ${quiz.length}`;
  quiz[i].a.forEach((x,idx)=>{
    const b=document.createElement("button");
    b.className="term-card";
    b.textContent=x;
    b.onclick=()=>pick(idx,b);
    grid.appendChild(b);
  });
  syncCoins();
}

function pick(idx,b){
  if(answered)return;
  answered=true;
  [...grid.children].forEach(x=>x.disabled=true);
  if(idx===quiz[i].c){
    score++;
    sc.textContent=score;
    fb.textContent="Correct. "+quiz[i].e;
    b.classList.add("answer-correct");
  }else{
    missed.push(i);
    fb.textContent="Not quite. "+quiz[i].e;
    b.classList.add("answer-wrong");
    grid.children[quiz[i].c]?.classList.add("answer-correct");
  }
  fb.classList.remove("hidden");
  next.classList.remove("hidden");
}

document.getElementById("quiz-hint-btn").onclick=()=>{
  if(answered) return showToast("This question has already been answered.","locked");
  const item=quiz[i];
  if(hintIndex>=item.hints.length) return showToast("No more hints for this question.","locked");
  if(!spendMindCoins(4,"Quiz hint")) return;
  const box=document.getElementById("quiz-help-box");
  box.textContent=`Hint ${hintIndex+1}: ${item.hints[hintIndex]}`;
  hintIndex++;
  box.classList.remove("hidden");
  syncCoins();
};

document.getElementById("quiz-answer-btn").onclick=()=>{
  if(answered) return showToast("This question has already been answered.","locked");
  if(!spendMindCoins(14,"Full answer")) return;
  const item=quiz[i];
  const box=document.getElementById("quiz-help-box");
  box.innerHTML=`<strong>Full answer:</strong> ${item.a[item.c]}<br><span class="muted">${item.e}</span>`;
  box.classList.remove("hidden");
  syncCoins();
};

next.onclick=()=>{
  if(i<quiz.length-1){
    i++;
    render();
  }else{
    showComplete();
  }
};

function showComplete(){
  document.getElementById("quiz-card").classList.add("hidden");
  document.getElementById("quiz-complete").classList.remove("hidden");
  document.getElementById("quiz-final-score").textContent=`Final score: ${score}/${quiz.length}. Review any missed concepts before signing.`;
  const list=document.getElementById("quiz-missed-list");
  list.innerHTML="";
  if(!missed.length){
    list.innerHTML='<div class="review-item"><div><strong>Perfect score</strong><small>No missed concepts</small></div><span>✓</span></div>';
  }else{
    [...new Set(missed)].forEach(idx=>{
      const item=quiz[idx];
      list.insertAdjacentHTML("beforeend",`
        <div class="review-item">
          <div><strong>${item.q}</strong><small>${item.e}</small></div>
          <span>Review</span>
        </div>`);
    });
  }
}

document.getElementById("sign-quiz-contract").onclick=async()=>{
  const rewardXp=25+score*18;
  const rewardCoins=6+score*5;
  const signed=await signFinanceContract({
    title:"Quiz Completion Contract",
    rewardXp,
    rewardCoins,
    activity:"Quiz contract"
  });
  if(!signed) return;
  const s=getState();
  s.quizCompletions=(s.quizCompletions||0)+1;
  s.lastQuizScore=score;
  s.lastQuizMissed=[...new Set(missed)].length;
  saveState(s);
  location.href="index.html";
};

render();
