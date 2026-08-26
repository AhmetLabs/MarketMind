const quiz=[
{q:"What does FCF measure?",a:["Revenue after COGS","Cash remaining after OCF minus CapEx","Net income before taxes","Debt minus cash"],c:1,e:"FCF = OCF − CapEx."},
{q:"Which formula is Net Debt?",a:["Debt + Cash","Debt − Cash","Cash − Debt","Debt ÷ Revenue"],c:1,e:"Net Debt adjusts debt for available cash."},
{q:"Revenue rises 25% but AR rises 70%. What should you investigate?",a:["Customer payment speed","Dividend yield first","CapEx automatically lowering OCF","Market cap only"],c:0,e:"AR growing faster than revenue may indicate slower collections."}
];
let i=0,score=0,answered=false;
const q=document.getElementById("quiz-question"),grid=document.getElementById("answer-grid"),fb=document.getElementById("quiz-feedback"),next=document.getElementById("next-question"),sc=document.getElementById("score-number");
function render(){answered=false;q.textContent=quiz[i].q;grid.innerHTML="";fb.classList.add("hidden");next.classList.add("hidden");quiz[i].a.forEach((x,idx)=>{const b=document.createElement("button");b.className="term-card";b.textContent=x;b.onclick=()=>pick(idx,b);grid.appendChild(b)})}
function pick(idx,b){if(answered)return;answered=true;if(idx===quiz[i].c){score++;sc.textContent=score;fb.textContent="Correct. "+quiz[i].e}else fb.textContent="Not quite. "+quiz[i].e;fb.classList.remove("hidden");next.classList.remove("hidden")}
next.onclick=()=>{if(i<quiz.length-1){i++;render()}else{q.textContent=`Quiz complete: ${score}/${quiz.length}`;grid.innerHTML="";next.classList.add("hidden");const s=getState();s.quizCompletions=(s.quizCompletions||0)+1;saveState(s);awardProgress({xp:30+score*15,coins:score*4,activity:"Quiz complete"})}};
render();
