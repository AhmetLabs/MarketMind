
const ASSETS = [
  {symbol:"AUR",name:"Aurora Tech",type:"Stock",seed:14,start:72,drift:0.00065,vol:0.018},
  {symbol:"GLB",name:"Global 100 ETF",type:"ETF",seed:25,start:64,drift:0.00032,vol:0.009},
  {symbol:"WDX",name:"World Index",type:"Index",seed:36,start:188,drift:0.00028,vol:0.007},
  {symbol:"GRN",name:"Green Future ETF",type:"ETF",seed:47,start:39,drift:0.00048,vol:0.016},
  {symbol:"BNK",name:"Banking Leaders",type:"Index Fund",seed:58,start:56,drift:0.00022,vol:0.012}
];

const DAYS = 730;
const START_DATE = new Date("2024-08-21T00:00:00");
let selectedSymbol = "AUR";
let currentDay = DAYS - 1;
let visibleRange = 365;

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function generateSeries(asset) {
  const out = [];
  let price = asset.start;
  for (let i=0;i<DAYS;i++) {
    const cycle = Math.sin((i + asset.seed) / 34) * 0.0035 + Math.sin((i + asset.seed) / 91) * 0.002;
    const noise = (seededRandom(asset.seed*1000+i*17)-0.5) * asset.vol * 2;
    const shock = (i===240 && asset.symbol==="AUR") ? -0.12 :
                  (i===430 && asset.symbol==="GRN") ? 0.10 :
                  (i===560 && asset.symbol==="BNK") ? -0.08 : 0;
    price = Math.max(5, price * (1 + asset.drift + cycle + noise + shock));
    out.push(Number(price.toFixed(2)));
  }
  return out;
}
const SERIES = Object.fromEntries(ASSETS.map(a=>[a.symbol,generateSeries(a)]));

function euro(v){return `€${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function dateForDay(day){const d=new Date(START_DATE);d.setDate(d.getDate()+day);return d}
function fmtDate(d){return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}

function state(){
  const s=getState();
  if(!s.simulatorCash && s.simulatorCash!==0)s.simulatorCash=10000;
  if(!s.holdings)s.holdings={};
  if(!s.transactions)s.transactions=[];
  return s;
}
function assetBySymbol(sym){return ASSETS.find(a=>a.symbol===sym)}
function priceAt(sym,day=currentDay){return SERIES[sym][day]}

function renderMarket(){
  const market=document.getElementById("market-list");
  const select=document.getElementById("trade-asset");
  market.innerHTML=""; select.innerHTML="";
  ASSETS.forEach(a=>{
    const p=priceAt(a.symbol);
    const prev=priceAt(a.symbol,Math.max(0,currentDay-30));
    const ch=((p-prev)/prev)*100;
    market.insertAdjacentHTML("beforeend",`<div class="asset-row ${a.symbol===selectedSymbol?"asset-selected":""}">
      <button class="asset-select-btn" data-symbol="${a.symbol}">
        <span class="asset-name"><strong>${a.symbol}</strong><small>${a.name} · ${a.type}</small></span>
      </button>
      <strong>${euro(p)}</strong>
      <span class="${ch>=0?"positive":"negative"}">${ch>=0?"+":""}${ch.toFixed(1)}%</span>
      <button class="btn ghost quick-trade" data-symbol="${a.symbol}">Trade</button>
    </div>`);
    select.insertAdjacentHTML("beforeend",`<option value="${a.symbol}" ${a.symbol===selectedSymbol?"selected":""}>${a.symbol} — ${a.name}</option>`);
  });
  document.querySelectorAll(".asset-select-btn,.quick-trade").forEach(b=>b.addEventListener("click",()=>{
    selectedSymbol=b.dataset.symbol;
    document.getElementById("trade-asset").value=selectedSymbol;
    renderAll();
  }));
}

function drawChart(){
  const svg=document.getElementById("price-chart");
  const full=SERIES[selectedSymbol];
  const start=visibleRange===0?0:Math.max(0,currentDay-visibleRange+1);
  const data=full.slice(start,currentDay+1);
  const W=900,H=320,pad=24;
  const min=Math.min(...data),max=Math.max(...data),span=Math.max(1,max-min);

  const points=data.map((v,i)=>{
    const x=pad+(i/(Math.max(1,data.length-1)))*(W-pad*2);
    const y=H-pad-((v-min)/span)*(H-pad*2);
    return [x,y];
  });

  const path=points.map((p,i)=>`${i===0?"M":"L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const fillPath=`${path} L ${points.at(-1)[0]} ${H-pad} L ${points[0][0]} ${H-pad} Z`;

  svg.innerHTML=`
    <defs>
      <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#35e08f" stop-opacity=".25"/>
        <stop offset="100%" stop-color="#35e08f" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H-pad}" stroke="#203652"/>
    <line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#203652"/>
    <path d="${fillPath}" fill="url(#areaFill)"/>
    <path d="${path}" fill="none" stroke="#35e08f" stroke-width="3" vector-effect="non-scaling-stroke"/>
    <circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="5" fill="#35e08f"/>
    <text x="${pad+8}" y="${pad+12}" fill="#91a2b8" font-size="13">${euro(max)}</text>
    <text x="${pad+8}" y="${H-pad-8}" fill="#91a2b8" font-size="13">${euro(min)}</text>
  `;
  document.getElementById("chart-range-label").textContent=`${fmtDate(dateForDay(start))} → ${fmtDate(dateForDay(currentDay))}`;
}

function renderAssetHeader(){
  const a=assetBySymbol(selectedSymbol),p=priceAt(selectedSymbol),prev=priceAt(selectedSymbol,Math.max(0,currentDay-30));
  const ch=((p-prev)/prev)*100;
  document.getElementById("asset-title").textContent=a.name;
  document.getElementById("asset-subtitle").textContent=`${a.symbol} · ${a.type}`;
  document.getElementById("asset-price").textContent=euro(p);
  const el=document.getElementById("asset-change");
  el.textContent=`${ch>=0?"+":""}${ch.toFixed(1)}% (30D)`;
  el.className=ch>=0?"positive":"negative";
  document.getElementById("simulation-date").textContent=fmtDate(dateForDay(currentDay));
}

function renderPortfolio(){
  const s=state();let invested=0;
  const rows=Object.entries(s.holdings).filter(([,q])=>q>0);
  const holdings=document.getElementById("holdings");
  holdings.innerHTML=rows.length?"":"<p class='muted'>No positions yet.</p>";
  rows.forEach(([sym,qty])=>{
    const val=qty*priceAt(sym);
    invested+=val;
    holdings.insertAdjacentHTML("beforeend",`<div class="holding-row"><span><strong>${sym}</strong><br><small class="muted">${qty} units</small></span><strong>${euro(val)}</strong></div>`);
  });
  const total=s.simulatorCash+invested;
  document.getElementById("cash-value").textContent=euro(s.simulatorCash);
  document.getElementById("invested-value").textContent=euro(invested);
  document.getElementById("portfolio-value").textContent=euro(total);
  document.getElementById("return-value").textContent=`${(((total-10000)/10000)*100).toFixed(1)}%`;
  document.getElementById("holding-count").textContent=`${rows.length} asset${rows.length===1?"":"s"}`;

  const qty=s.holdings[selectedSymbol]||0;
  const pos=document.getElementById("selected-position");
  if(!qty){pos.innerHTML="<p class='muted'>No position in this asset yet.</p>";return}

  const tx=s.transactions.filter(t=>t.symbol===selectedSymbol && t.side==="BUY");
  const totalUnits=tx.reduce((a,t)=>a+t.qty,0);
  const avg=totalUnits?tx.reduce((a,t)=>a+t.qty*t.price,0)/totalUnits:priceAt(selectedSymbol);
  const current=priceAt(selectedSymbol),pnl=(current-avg)*qty,pnlPct=((current-avg)/avg)*100;
  pos.innerHTML=`<div class="position-metrics">
    <span><small>Units</small><strong>${qty}</strong></span>
    <span><small>Avg. price</small><strong>${euro(avg)}</strong></span>
    <span><small>Current</small><strong>${euro(current)}</strong></span>
    <span><small>P/L</small><strong class="${pnl>=0?"positive":"negative"}">${euro(pnl)} (${pnlPct.toFixed(1)}%)</strong></span>
  </div>
  <div class="decision-row">
    <button class="btn secondary" onclick="document.getElementById('trade-qty').focus()">Add position</button>
    <button class="btn ghost" onclick="sellAllSelected()">Close position</button>
  </div>`;
}

function buy(){
  const s=state(),qty=Number(document.getElementById("trade-qty").value),p=priceAt(selectedSymbol),cost=p*qty;
  const msg=document.getElementById("trade-message");
  if(!Number.isFinite(qty)||qty<=0){msg.textContent="Enter a valid quantity.";return}
  if(cost>s.simulatorCash){msg.textContent="Not enough virtual cash.";return}
  s.simulatorCash-=cost;s.holdings[selectedSymbol]=(s.holdings[selectedSymbol]||0)+qty;
  s.transactions.push({side:"BUY",symbol:selectedSymbol,qty,price:p,day:currentDay,thesis:document.getElementById("trade-thesis").value.trim()});
  saveState(s);msg.textContent=`Bought ${qty} ${selectedSymbol} at ${euro(p)} on ${fmtDate(dateForDay(currentDay))}.`;renderAll();
}
function sellQty(qty){
  const s=state(),owned=s.holdings[selectedSymbol]||0,p=priceAt(selectedSymbol),msg=document.getElementById("trade-message");
  if(qty<=0||qty>owned){msg.textContent=`You own ${owned} ${selectedSymbol}.`;return}
  s.holdings[selectedSymbol]-=qty;if(s.holdings[selectedSymbol]===0)delete s.holdings[selectedSymbol];
  s.simulatorCash+=p*qty;s.transactions.push({side:"SELL",symbol:selectedSymbol,qty,price:p,day:currentDay});
  saveState(s);msg.textContent=`Sold ${qty} ${selectedSymbol} at ${euro(p)}.`;renderAll();
}
function sell(){sellQty(Number(document.getElementById("trade-qty").value))}
function sellAllSelected(){const s=state();sellQty(s.holdings[selectedSymbol]||0)}
window.sellAllSelected=sellAllSelected;

function renderAll(){renderAssetHeader();renderMarket();drawChart();renderPortfolio()}

document.getElementById("trade-asset").addEventListener("change",e=>{selectedSymbol=e.target.value;renderAll()});
document.getElementById("buy-btn").addEventListener("click",buy);
document.getElementById("sell-btn").addEventListener("click",sell);

const slider=document.getElementById("time-slider");
slider.max=DAYS-1;slider.min=30;slider.value=currentDay;
slider.addEventListener("input",()=>{currentDay=Number(slider.value);renderAll()});
document.getElementById("rewind-30").onclick=()=>{currentDay=Math.max(30,currentDay-30);slider.value=currentDay;renderAll()};
document.getElementById("forward-30").onclick=()=>{currentDay=Math.min(DAYS-1,currentDay+30);slider.value=currentDay;renderAll()};
document.getElementById("jump-latest").onclick=()=>{currentDay=DAYS-1;slider.value=currentDay;renderAll()};

document.querySelectorAll("#timeframe-buttons button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#timeframe-buttons button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");visibleRange=Number(b.dataset.range);drawChart();
}));

const analyzeBtn=document.getElementById("analyze-btn");
analyzeBtn.addEventListener("click",()=>{
  const box=document.getElementById("analysis-box");box.classList.toggle("hidden");
  analyzeBtn.textContent=box.classList.contains("hidden")?"Analyze before buying":"Hide analysis";
});
document.querySelectorAll(".analysis-check").forEach(c=>c.addEventListener("change",()=>{
  const n=[...document.querySelectorAll(".analysis-check")].filter(x=>x.checked).length;
  document.getElementById("analysis-score").textContent=`${n} / 5`;
}));

renderAll();
