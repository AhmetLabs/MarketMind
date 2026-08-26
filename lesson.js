const concepts=[
{title:"Revenue",category:"Accounting",description:"Revenue is total income from normal business activities before expenses.",formula:"",example:"Example: €10M sales means €10M revenue before costs."},
{title:"Operating Margin",category:"Financial Analysis",description:"Shows what percentage of revenue remains as operating profit.",formula:"Operating Margin = Operating Income ÷ Revenue × 100",example:"€20M operating income on €100M revenue = 20%."},
{title:"Free Cash Flow",category:"Cash Flow",description:"Cash remaining after CapEx is deducted from OCF.",formula:"FCF = OCF − CapEx",example:"€120M OCF − €50M CapEx = €70M FCF."},
{title:"Net Debt",category:"Capital Structure",description:"Debt after subtracting cash.",formula:"Net Debt = Debt − Cash",example:"€500M debt − €200M cash = €300M net debt."},
{title:"Earnings Quality",category:"Financial Analysis",description:"How sustainable and cash-supported reported profit appears to be.",formula:"",example:"Rising net income with collapsing OCF may weaken earnings quality."}
];
let current=0,mastered=0,review=[];
function render(){const c=concepts[current];document.getElementById("concept-title").textContent=c.title;document.getElementById("concept-category").textContent=c.category;document.getElementById("concept-description").textContent=c.description;document.getElementById("concept-example").textContent=c.example;const f=document.getElementById("formula-box");f.textContent=c.formula;f.classList.toggle("hidden",!c.formula);document.getElementById("lesson-progress-fill").style.width=`${mastered/concepts.length*100}%`;document.getElementById("lesson-progress-text").textContent=`${mastered} / ${concepts.length} mastered`}
function complete(){
  const s=getState();
  s.masteredConcepts=Math.min(s.totalConcepts,(s.masteredConcepts||0)+mastered);
  s.lessonCompletions=(s.lessonCompletions||0)+1;
  saveState(s);
  const coins=mastered*5;
  const xp=40+mastered*12;
  awardProgress({xp,coins,activity:"Lesson complete"});
  alert(`Lesson complete! +${xp} XP · +${coins} MindCoins`);
  location.href="index.html";
}
document.getElementById("know-btn").onclick=()=>{mastered++;if(current<concepts.length-1){current++;render()}else if(review.length){current=review.shift();render()}else complete()};
document.getElementById("again-btn").onclick=()=>{if(!review.includes(current))review.push(current);if(current<concepts.length-1){current++;render()}else if(review.length){current=review.shift();render()}};
render();
