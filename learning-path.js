document.addEventListener("DOMContentLoaded",()=>{
 const s=getState(), current=getLevelInfo(s.xp), m=masteryStats(s);
 document.getElementById("path-current-level").textContent=`Level ${current.level} · ${current.name}`;
 document.getElementById("path-mastery").textContent=`${m.pct}% mastery · ${m.mastered} mastered`;
 document.querySelectorAll("[data-path-level]").forEach(card=>{
   const level=Number(card.dataset.pathLevel), lock=card.querySelector("[data-path-lock]"), reqBox=card.querySelector("[data-path-requirements]");
   const req=levelRequirements(level,s);
   if(level<current.level){card.classList.add("path-complete");lock.textContent="✓ Complete"}
   else if(level===current.level){card.classList.add("path-current");lock.textContent="Current"}
   else if(level===current.level+1){card.classList.add("path-next");lock.textContent=req.passed?"Ready to unlock":"Checkpoint locked"}
   else {card.classList.add("path-locked");lock.textContent=`🔒 Level ${level}`}
   if(level===current.level+1 && req.targets){
     reqBox.innerHTML=`<small>Next level requirements</small>
       <span class="${req.xp?"ok":""}">XP ${req.xp?"✓":"○"}</span>
       <span class="${req.mastery?"ok":""}">Mastery ${m.pct}% / ${req.targets.masteryTarget}%</span>
       <span class="${req.formula?"ok":""}">Formula ${s.formulaScore||0}% / ${req.targets.formulaTarget}%</span>
       <span class="${req.written?"ok":""}">Written ${s.writtenVocabularyScore||0}% / ${req.targets.writtenTarget}%</span>
       <span class="${req.checkpoint?"ok":""}">Checkpoint ${(s.checkpointResults||{})[level-1]||0}% / 75%</span>`;
   }
 });
});