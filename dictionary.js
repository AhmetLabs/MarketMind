let terms=[];
const grid=document.getElementById("dictionary-grid");
const search=document.getElementById("search-input");
const category=document.getElementById("category-filter");
const level=document.getElementById("level-filter");
const count=document.getElementById("dictionary-count");
const modal=document.getElementById("term-modal");

fetch("data/dictionary.json")
  .then(r=>r.json())
  .then(data=>{
    terms=data;
    [...new Set(terms.map(t=>t.category))].sort().forEach(c=>{
      const o=document.createElement("option");o.value=c;o.textContent=c;category.appendChild(o);
    });
    render();
  });

function render(){
  const q=search.value.trim().toLowerCase(), c=category.value, l=level.value;
  const filtered=terms.filter(t=>{
    const hay=`${t.term} ${t.abbr} ${t.category} ${t.definition}`.toLowerCase();
    return (!q||hay.includes(q))&&(!c||t.category===c)&&(!l||t.level===l);
  });
  grid.innerHTML="";
  filtered.forEach(t=>{
    const card=document.createElement("article");card.className="term-card";
    card.innerHTML=`<div class="term-meta"><div class="term-title"><h3>${t.term}</h3>${t.abbr?`<span class="tag">${t.abbr}</span>`:""}</div><span class="level-badge">${t.level}</span></div>
      <p>${t.definition}</p><small class="muted">${t.category}</small>`;
    card.addEventListener("click",()=>openModal(t));
    grid.appendChild(card);
  });
  count.textContent=`Showing ${filtered.length} of ${terms.length} starter terms`;
}
function openModal(t){
  document.getElementById("modal-category").textContent=`${t.category} · ${t.level}`;
  document.getElementById("modal-title").textContent=t.abbr?`${t.term} (${t.abbr})`:t.term;
  document.getElementById("modal-definition").textContent=t.definition;
  const f=document.getElementById("modal-formula");f.textContent=t.formula||"";f.classList.toggle("hidden",!t.formula);
  document.getElementById("modal-example").textContent=t.example?`Example: ${t.example}`:"";
  modal.classList.add("show");
}
document.getElementById("modal-close").onclick=()=>modal.classList.remove("show");
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("show")});
[search,category,level].forEach(el=>el.addEventListener(el===search?"input":"change",render));
