let target=1;
document.querySelectorAll("[data-placement]").forEach(b=>b.addEventListener("click",()=>{
 target=Number(b.dataset.placement);
 document.getElementById("placement-test").classList.remove("hidden");
 document.getElementById("placement-prompt").textContent=target===1?"Beginner starts immediately.":"This prototype checkpoint represents the full written + formula placement test that will be built in the next phase.";
}));
document.getElementById("placement-submit").addEventListener("click",()=>{
 const score=Math.max(0,Math.min(100,Number(document.getElementById("placement-score").value)||0)), s=getState();
 let awarded=1;
 if(target===1) awarded=1;
 else if(score>=85) awarded=target;
 else if(score>=75) awarded=Math.max(1,target-2);
 else if(score>=60) awarded=Math.max(1,target-4);
 s.verifiedLevel=awarded; s.placementCompleted=true; s.placementChoice=target;
 s.xp=Math.max(s.xp, LEVELS[awarded-1].minXp);
 saveState(s);
 const r=document.getElementById("placement-result");r.classList.remove("hidden");r.textContent=`Placement complete: Level ${awarded} · ${LEVELS[awarded-1].name}.`;
 document.getElementById("placement-continue").classList.remove("hidden");
});