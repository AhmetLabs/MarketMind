
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
 const s=loadState(),list=document.getElementById("market-list"),sel=document.getElementById("trade-asset");list.innerHTML="";sel.innerHTML="";
 ASSETS.forEach(a=>{const p=currentPrice(s,a.symbol),pr=previousPrice(s,a.symbol),ch=(p-pr)/pr*100;
 list.insertAdjacentHTML("beforeend",`<div class="asset-row ${a.symbol===selectedSymbol?"asset-selected":""}"><button class="asset-select-btn" data-symbol="${a.symbol}"><span class="asset-name"><strong>${a.symbol}</strong><small>${a.name} · ${a.type}${a.tradable?"":" · Benchmark only"}</small></span></button><strong>${eur(p)}</strong><span class="${ch>=0?"positive":"negative"}">${pct(ch)}</span><button class="btn ghost quick-trade" data-symbol="${a.symbol}">${a.tradable?"Trade":"View"}</button></div>`);
 sel.insertAdjacentHTML("beforeend",`<option value="${a.symbol}">${a.symbol} — ${a.name}${a.tradable?"":" (benchmark)"}</option>`)
 });sel.value=selectedSymbol;document.querySelectorAll(".asset-select-btn,.quick-trade").forEach(b=>b.onclick=()=>{selectedSymbol=b.dataset.symbol;renderAll()})
}
function renderHeader(){
 const s=loadState(),a=asset(selectedSymbol),p=currentPrice(s),pr=previousPrice(s),ch=(p-pr)/pr*100;
 document.getElementById("asset-title").textContent=a.name;document.getElementById("asset-subtitle").textContent=`${a.symbol} · ${a.type}${a.tradable?"":" · Benchmark only"}`;document.getElementById("asset-price").textContent=eur(p);const c=document.getElementById("asset-change");c.textContent=`${pct(ch)} today`;c.className=ch>=0?"positive":"negative";document.getElementById("position-title").textContent=a.name;updateEstimate()
}
function chartData(){
 const s=loadState(),arr=s.market[selectedSymbol],end=inReplay(s)?s.replay.index:arr.length-1,n=chartRange===0?end+1:Math.min(chartRange,end+1),start=Math.max(0,end-n+1);return {s,data:arr.slice(start,end+1),start,end}
}
function drawChart(){
 const svg=document.getElementById("price-chart"),{data}=chartData(),W=1000,H=360,L=46,R=24,T=24,B=34,min=Math.min(...data),max=Math.max(...data),span=Math.max(.01,max-min);
 const pts=data.map((v,i)=>({x:L+(i/Math.max(1,data.length-1))*(W-L-R),y:T+(1-(v-min)/span)*(H-T-B),price:v,index:i}));
 const path=pts.map((p,i)=>`${i?"L":"M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "),fill=`${path} L ${pts.at(-1).x} ${H-B} L ${pts[0].x} ${H-B} Z`;
 svg.innerHTML=`<defs><linearGradient id="mmArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#35e08f" stop-opacity=".22"/><stop offset="100%" stop-color="#35e08f" stop-opacity="0"/></linearGradient></defs><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" class="chart-grid-line"/><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" class="chart-grid-line"/><path d="${fill}" fill="url(#mmArea)"/><path d="${path}" class="chart-price-line"/><circle cx="${pts.at(-1).x}" cy="${pts.at(-1).y}" r="5" class="chart-end-dot"/><text x="8" y="${T+10}" class="chart-svg-label">${eur(max)}</text><text x="8" y="${H-B}" class="chart-svg-label">${eur(min)}</text>`;
 svg.dataset.points=JSON.stringify(pts.map(p=>[p.x,p.y,p.price,p.index]))
}
function inspectChart(e){
 const {s,start}=chartData(),svg=document.getElementById("price-chart"),r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,pts=JSON.parse(svg.dataset.points||"[]");if(!pts.length)return;
 const p=pts.reduce((a,b)=>Math.abs(b[0]-x)<Math.abs(a[0]-x)?b:a,pts[0]),global=start+p[3],end=s.market[selectedSymbol].length-1,days=end-global,d=new Date(s.simDateISO);d.setUTCDate(d.getUTCDate()-days);
 document.getElementById("chart-point-price").textContent=eur(p[2]);document.getElementById("chart-point-date").textContent=fmtDate(d);
 const cr=document.getElementById("chart-crosshair");cr.style.left=`${p[0]/1000*r.width}px`;cr.classList.remove("hidden");const tip=document.getElementById("chart-tooltip");tip.innerHTML=`<strong>${eur(p[2])}</strong><small>${fmtDate(d)}</small>`;tip.style.left=`${Math.min(r.width-120,Math.max(8,p[0]/1000*r.width+10))}px`;tip.style.top=`${Math.max(8,p[1]/360*r.height-52)}px`;tip.classList.remove("hidden")
}
function renderPositions(){
 const s=loadState(),a=acct(s),entries=Object.entries(a.positions||{}).filter(([,p])=>p.qty>0),h=document.getElementById("holdings");document.getElementById("holding-count").textContent=`${entries.length} position${entries.length===1?"":"s"}`;
 if(!entries.length)h.innerHTML='<p class="muted">No positions yet.</p>';else h.innerHTML=`<div class="broker-holdings-list">${entries.map(([sym,p])=>{const px=currentPrice(s,sym),mv=px*p.qty,pl=(px-p.avgCost)*p.qty,pp=(px-p.avgCost)/p.avgCost*100;return `<button class="holding-broker-row" data-symbol="${sym}"><span><strong>${sym}</strong><small>${p.qty.toFixed(3)} units · avg ${eur(p.avgCost)}</small></span><span><strong>${eur(mv)}</strong><small class="${pl>=0?"positive":"negative"}">${eur(pl)} · ${pct(pp)}</small></span></button>`}).join("")}</div>`;
 document.querySelectorAll(".holding-broker-row").forEach(b=>b.onclick=()=>{selectedSymbol=b.dataset.symbol;renderAll()});
 const p=a.positions[selectedSymbol],box=document.getElementById("selected-position");if(!p)box.innerHTML='<p class="muted">No position in this asset.</p>';else{const px=currentPrice(s),pl=(px-p.avgCost)*p.qty;box.innerHTML=`<div class="position-metrics"><span><small>Quantity</small><strong>${p.qty.toFixed(3)}</strong></span><span><small>Average cost</small><strong>${eur(p.avgCost)}</strong></span><span><small>Market value</small><strong>${eur(px*p.qty)}</strong></span><span><small>Unrealized P/L</small><strong class="${pl>=0?"positive":"negative"}">${eur(pl)} · ${pct((px-p.avgCost)/p.avgCost*100)}</strong></span></div><button id="sell-all-position" class="btn ghost" style="margin-top:12px">Sell entire position</button>`;document.getElementById("sell-all-position").onclick=()=>{selectedSide="SELL";sideUI();document.getElementById("trade-qty").value=p.qty.toFixed(3);updateEstimate()}}
}
function renderOpen(){
 const s=loadState(),a=acct(s),orders=a.openOrders||[],b=document.getElementById("open-orders");document.getElementById("open-orders-count").textContent=orders.length;if(!orders.length){b.innerHTML='<p class="muted">No open limit orders.</p>';return}
 b.innerHTML=`<table class="broker-table"><thead><tr><th>Side</th><th>Asset</th><th>Qty</th><th>Limit</th><th>Date</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td class="${o.side==="BUY"?"positive":"negative"}">${o.side}</td><td>${o.symbol}</td><td>${o.qty.toFixed(3)}</td><td>${eur(o.limitPrice)}</td><td>${fmtDate(o.simDateISO)}</td><td><button class="btn ghost cancel-order-open" data-id="${o.id}">Cancel</button></td></tr>`).join("")}</tbody></table>`;
 document.querySelectorAll(".cancel-order-open").forEach(btn=>btn.onclick=()=>{const s2=loadState(),a2=acct(s2);a2.openOrders=a2.openOrders.filter(o=>o.id!==btn.dataset.id);saveState(s2);renderAll();msg("Limit order cancelled.","good")})
}
function renderHistory(){
 const s=loadState(),a=acct(s),tx=(a.transactions||[]).filter(t=>(t.timestamp||0)>(a.displayHistoryClearedAt||0)).slice(0,50),b=document.getElementById("order-history");if(!tx.length){b.innerHTML='<p class="muted">No displayed transactions.</p>';return}
 b.innerHTML=`<table class="broker-table"><thead><tr><th>Status</th><th>Side</th><th>Asset</th><th>Qty</th><th>Price</th><th>Type</th><th>Date</th></tr></thead><tbody>${tx.map(t=>`<tr><td>${t.status}</td><td class="${t.side==="BUY"?"positive":t.side==="SELL"?"negative":""}">${t.side}</td><td>${t.symbol}</td><td>${Number(t.qty||0).toFixed(3)}</td><td>${eur(t.price)}</td><td>${t.type}</td><td>${fmtDate(t.simDateISO)}</td></tr>`).join("")}</tbody></table>`
}
function renderEvents(){
 const s=loadState(),ev=s.events||[],b=document.getElementById("event-feed");document.getElementById("event-count").textContent=ev.length;if(!ev.length){b.innerHTML='<p class="muted">No corporate events yet. Dividends and split events appear as simulation time advances.</p>';return}
 b.innerHTML=ev.slice(0,12).map(e=>`<div class="event-item"><span class="event-type">${e.type}</span><div><strong>${e.title}</strong><small>${e.detail}</small><small>${fmtDate(e.simDateISO)}</small></div></div>`).join("")
}
function renderReplay(){
 const s=loadState(),banner=document.getElementById("replay-banner");banner.classList.toggle("hidden",!inReplay(s));if(inReplay(s))document.getElementById("replay-date").textContent=fmtDate(simDate(s));
 const days=+document.getElementById("replay-days").value;document.getElementById("replay-days-label").textContent=`${days} days back`;const d=new Date(s.simDateISO);d.setUTCDate(d.getUTCDate()-days);document.getElementById("replay-start-date").textContent=fmtDate(d)
}
function updateEstimate(){const s=loadState(),px=document.getElementById("order-type").value==="LIMIT"?(+document.getElementById("limit-price").value||currentPrice(s)):currentPrice(s),q=+document.getElementById("trade-qty").value||0;document.getElementById("estimate-price").textContent=eur(px);document.getElementById("estimate-value").textContent=eur(px*q)}
function sideUI(){document.querySelectorAll("#side-buttons button").forEach(b=>b.classList.toggle("active",b.dataset.side===selectedSide));const b=document.getElementById("place-order");b.textContent=`Review ${selectedSide.toLowerCase()} order`;b.classList.toggle("sell-order",selectedSide==="SELL")}
function draft(){const s=loadState(),type=document.getElementById("order-type").value,q=+document.getElementById("trade-qty").value,l=+document.getElementById("limit-price").value;if(!(q>0))return{error:"Enter a valid quantity."};if(type==="LIMIT"&&!(l>0))return{error:"Enter a valid limit price."};return{side:selectedSide,type,symbol:selectedSymbol,qty:q,limitPrice:type==="LIMIT"?l:null,currentPrice:currentPrice(s),thesis:document.getElementById("trade-thesis").value.trim()}}
function review(d){pendingOrderDraft=d;const s=loadState(),a=acct(s),m=metricsFor(a,s),px=d.type==="LIMIT"?d.limitPrice:d.currentPrice;document.getElementById("review-title").textContent=`${d.side} ${asset(d.symbol).name}`;document.getElementById("review-details").innerHTML=`<span><small>Order</small><strong>${d.side} · ${d.type}</strong></span><span><small>Quantity</small><strong>${d.qty.toFixed(3)}</strong></span><span><small>Price</small><strong>${eur(px)}</strong></span><span><small>Estimated value</small><strong>${eur(px*d.qty)}</strong></span><span><small>Buying power</small><strong>${eur(m.buyingPower)}</strong></span><span><small>Owned</small><strong>${(a.positions[d.symbol]?.qty||0).toFixed(3)}</strong></span>`;document.getElementById("order-review-modal").classList.remove("hidden")}
function renderAll(){populatePortfolios();renderAccount();renderMarket();renderHeader();drawChart();renderPositions();renderOpen();renderHistory();renderEvents();renderReplay();sideUI()}

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
