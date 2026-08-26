
/* MarketMind v1.3 — persistent fictional brokerage engine */
const MM_BROKER_KEY = "marketmind-broker-v13";
const SIM_MINUTE_MS = 60 * 1000;
const REAL_MINUTES_PER_SIM_DAY = 30; // 30 real minutes = one simulated market day.
const MAX_OFFLINE_SIM_DAYS = 365;

const ASSETS = [
  {symbol:"AUR", name:"Aurora Tech", type:"Stock", start:72, drift:0.00055, vol:0.018, seed:14, tradable:true},
  {symbol:"GLB", name:"Global 100 ETF", type:"ETF", start:64, drift:0.00033, vol:0.009, seed:25, tradable:true},
  {symbol:"WDX", name:"World Index", type:"Index", start:188, drift:0.00028, vol:0.007, seed:36, tradable:false},
  {symbol:"GRN", name:"Green Future ETF", type:"ETF", start:39, drift:0.00046, vol:0.016, seed:47, tradable:true},
  {symbol:"BNK", name:"Banking Leaders Fund", type:"Index Fund", start:56, drift:0.00024, vol:0.012, seed:58, tradable:true}
];

let selectedSymbol = "AUR";
let selectedSide = "BUY";
let chartRange = 365;
let pendingOrderDraft = null;

function defaultBrokerState() {
  return {
    version: 13,
    cash: 10000,
    startingEquity: 10000,
    realizedPnL: 0,
    positions: {},
    openOrders: [],
    transactions: [],
    market: {},
    simDay: 729,
    simDateISO: "2026-08-26T00:00:00.000Z",
    lastRealUpdate: Date.now(),
    displayHistoryClearedAt: 0
  };
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateNextPrice(asset, previous, dayIndex) {
  const cycle = Math.sin((dayIndex + asset.seed) / 34) * 0.0032 +
                Math.sin((dayIndex + asset.seed) / 91) * 0.0018;
  const noise = (seededRandom(asset.seed * 1009 + dayIndex * 17) - 0.5) * asset.vol * 2;
  const move = asset.drift + cycle + noise;
  return Math.max(2, Number((previous * (1 + move)).toFixed(2)));
}

function bootstrapHistory(asset, days=730) {
  const prices = [];
  let p = asset.start;
  for (let i=0;i<days;i++) {
    p = generateNextPrice(asset, p, i);
    prices.push(p);
  }
  return prices;
}

function loadBroker() {
  let s;
  try { s = JSON.parse(localStorage.getItem(MM_BROKER_KEY) || "null"); } catch { s = null; }
  if (!s || s.version !== 13) {
    s = defaultBrokerState();
    ASSETS.forEach(a => s.market[a.symbol] = bootstrapHistory(a));
    saveBroker(s);
  }
  // Repair missing fields.
  s.positions ||= {};
  s.openOrders ||= [];
  s.transactions ||= [];
  s.market ||= {};
  ASSETS.forEach(a => { if (!Array.isArray(s.market[a.symbol]) || !s.market[a.symbol].length) s.market[a.symbol] = bootstrapHistory(a); });
  return s;
}

function saveBroker(s) {
  localStorage.setItem(MM_BROKER_KEY, JSON.stringify(s));
}

function asset(sym){ return ASSETS.find(a => a.symbol === sym); }
function eur(v){ return `€${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function pct(v){ return `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`; }
function fmtDate(d){ return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function currentPrice(s, sym){ const arr=s.market[sym]; return arr[arr.length-1]; }
function previousPrice(s,sym){ const arr=s.market[sym]; return arr[Math.max(0,arr.length-2)]; }

function syncOfflineMarket() {
  const s = loadBroker();
  const now = Date.now();
  const elapsed = Math.max(0, now - (s.lastRealUpdate || now));
  const simDays = Math.min(MAX_OFFLINE_SIM_DAYS, Math.floor(elapsed / (REAL_MINUTES_PER_SIM_DAY * SIM_MINUTE_MS)));

  if (simDays > 0) {
    for (let d=0; d<simDays; d++) {
      s.simDay++;
      ASSETS.forEach(a => {
        const hist = s.market[a.symbol];
        hist.push(generateNextPrice(a, hist[hist.length-1], s.simDay));
        // Keep up to ~5 years of daily history.
        if (hist.length > 1825) hist.shift();
      });
      processOpenOrdersForDay(s);
      const simDate = new Date(s.simDateISO);
      simDate.setUTCDate(simDate.getUTCDate() + 1);
      s.simDateISO = simDate.toISOString();
    }
    s.lastRealUpdate += simDays * REAL_MINUTES_PER_SIM_DAY * SIM_MINUTE_MS;
    saveBroker(s);
  } else {
    s.lastRealUpdate = now;
    saveBroker(s);
  }
  return simDays;
}

function processOpenOrdersForDay(s) {
  const stillOpen = [];
  s.openOrders.forEach(o => {
    const p = currentPrice(s,o.symbol);
    const shouldFill = (o.side==="BUY" && p <= o.limitPrice) ||
                       (o.side==="SELL" && p >= o.limitPrice);
    if (shouldFill) {
      const ok = executeOrder(s,{...o, type:"LIMIT", fillPrice:p}, true);
      if (!ok) {
        o.status="REJECTED";
        o.rejectReason="Insufficient cash or position at fill.";
        s.transactions.unshift({...o, price:p, timestamp:Date.now(), status:"REJECTED"});
      }
    } else stillOpen.push(o);
  });
  s.openOrders = stillOpen;
}

function positionCostBasis(pos) {
  return (pos?.qty || 0) * (pos?.avgCost || 0);
}

function portfolioMetrics(s) {
  let invested=0, unrealized=0;
  Object.entries(s.positions).forEach(([sym,pos])=>{
    if (!pos || pos.qty <= 0) return;
    const p=currentPrice(s,sym);
    invested += pos.qty*p;
    unrealized += (p-pos.avgCost)*pos.qty;
  });
  const equity=s.cash+invested;
  return {invested,unrealized,equity,buyingPower:s.cash};
}

function executeOrder(s, order, fromOpenOrder=false) {
  const a=asset(order.symbol);
  if (!a || !a.tradable) return false;
  const qty=Number(order.qty);
  const price=Number(order.fillPrice ?? currentPrice(s,order.symbol));
  if (!Number.isFinite(qty) || qty<=0 || !Number.isFinite(price) || price<=0) return false;

  const pos=s.positions[order.symbol] || {qty:0,avgCost:0};
  if (order.side==="BUY") {
    const cost=qty*price;
    if (cost > s.cash + 1e-9) return false;
    const oldCost=pos.qty*pos.avgCost;
    pos.qty += qty;
    pos.avgCost = (oldCost+cost)/pos.qty;
    s.cash -= cost;
    s.positions[order.symbol]=pos;
  } else {
    if (qty > pos.qty + 1e-9) return false;
    const realized=(price-pos.avgCost)*qty;
    s.realizedPnL += realized;
    s.cash += qty*price;
    pos.qty -= qty;
    if (pos.qty <= 1e-9) delete s.positions[order.symbol];
    else s.positions[order.symbol]=pos;
  }

  s.transactions.unshift({
    id:order.id || cryptoId(),
    side:order.side,
    type:order.type || "MARKET",
    symbol:order.symbol,
    qty,
    price,
    limitPrice:order.limitPrice ?? null,
    timestamp:Date.now(),
    simDateISO:s.simDateISO,
    thesis:order.thesis || "",
    status:"FILLED",
    source:fromOpenOrder ? "AUTO_FILL" : "USER"
  });
  return true;
}

function cryptoId(){
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

function placeDraftOrder(draft) {
  const s=loadBroker();
  const a=asset(draft.symbol);
  if(!a.tradable){
    setMessage(`${a.name} is an index benchmark and cannot be bought directly. Use a fund/ETF instead.`,"bad");
    return;
  }

  if(draft.type==="MARKET"){
    const ok=executeOrder(s,{...draft, fillPrice:currentPrice(s,draft.symbol)});
    if(!ok){
      setMessage(draft.side==="BUY" ? "Not enough buying power." : "Not enough units to sell.","bad");
      return;
    }
    saveBroker(s);
    setMessage(`${draft.side==="BUY"?"Bought":"Sold"} ${draft.qty} ${draft.symbol} at ${eur(currentPrice(s,draft.symbol))}.`,"good");
  } else {
    if(draft.side==="BUY"){
      const reservedPotential=draft.qty*draft.limitPrice;
      if(reservedPotential > s.cash){
        setMessage("Not enough cash for this limit order if it fills.","bad");
        return;
      }
    } else {
      const owned=s.positions[draft.symbol]?.qty || 0;
      if(draft.qty > owned){
        setMessage(`You only own ${owned.toFixed(3)} ${draft.symbol}.`,"bad");
        return;
      }
    }
    s.openOrders.unshift({...draft,id:cryptoId(),status:"OPEN",createdAt:Date.now(),simDateISO:s.simDateISO});
    saveBroker(s);
    setMessage(`${draft.side} limit order placed at ${eur(draft.limitPrice)}.`,"good");
  }
  renderAll();
}

function setMessage(text,type=""){
  const el=document.getElementById("trade-message");
  el.textContent=text;
  el.className=`trade-note ${type==="bad"?"negative":type==="good"?"positive":""}`;
}

function renderAccount(){
  const s=loadBroker(),m=portfolioMetrics(s);
  const dayBase = (() => {
    let prevInvested=0;
    Object.entries(s.positions).forEach(([sym,pos])=>{
      const arr=s.market[sym]; const pp=arr[Math.max(0,arr.length-2)];
      prevInvested += pos.qty*pp;
    });
    return s.cash+prevInvested;
  })();
  const dayChange=m.equity-dayBase;
  const dayPct=dayBase?dayChange/dayBase*100:0;

  document.getElementById("account-equity").textContent=eur(m.equity);
  document.getElementById("account-cash").textContent=eur(s.cash);
  document.getElementById("account-invested").textContent=eur(m.invested);
  document.getElementById("account-buying-power").textContent=eur(m.buyingPower);
  document.getElementById("account-unrealized").textContent=eur(m.unrealized);
  document.getElementById("account-realized").textContent=eur(s.realizedPnL);
  document.getElementById("sim-clock").textContent=fmtDate(s.simDateISO);

  const ch=document.getElementById("account-day-change");
  ch.textContent=`${eur(dayChange)} (${pct(dayPct)}) today`;
  ch.className=dayChange>=0?"positive":"negative";
}

function renderMarket(){
  const s=loadBroker();
  const list=document.getElementById("market-list");
  const select=document.getElementById("trade-asset");
  list.innerHTML=""; select.innerHTML="";
  ASSETS.forEach(a=>{
    const p=currentPrice(s,a.symbol), prev=previousPrice(s,a.symbol);
    const change=(p-prev)/prev*100;
    const row=document.createElement("div");
    row.className=`asset-row ${a.symbol===selectedSymbol?"asset-selected":""}`;
    row.innerHTML=`
      <button class="asset-select-btn" data-symbol="${a.symbol}">
        <span class="asset-name">
          <strong>${a.symbol}</strong>
          <small>${a.name} · ${a.type}${a.tradable?"":" · Benchmark only"}</small>
        </span>
      </button>
      <strong>${eur(p)}</strong>
      <span class="${change>=0?"positive":"negative"}">${pct(change)}</span>
      <button class="btn ghost quick-trade" data-symbol="${a.symbol}">${a.tradable?"Trade":"View"}</button>`;
    list.appendChild(row);
    select.insertAdjacentHTML("beforeend",`<option value="${a.symbol}">${a.symbol} — ${a.name}${a.tradable?"":" (benchmark)"}</option>`);
  });
  select.value=selectedSymbol;
  document.querySelectorAll(".asset-select-btn,.quick-trade").forEach(btn=>btn.onclick=()=>{
    selectedSymbol=btn.dataset.symbol;
    document.getElementById("trade-asset").value=selectedSymbol;
    renderAll();
  });
}

function renderAssetHeader(){
  const s=loadBroker(),a=asset(selectedSymbol);
  const p=currentPrice(s,selectedSymbol),prev=previousPrice(s,selectedSymbol);
  const change=(p-prev)/prev*100;
  document.getElementById("asset-title").textContent=a.name;
  document.getElementById("asset-subtitle").textContent=`${a.symbol} · ${a.type}${a.tradable?"":" · Benchmark only"}`;
  document.getElementById("asset-price").textContent=eur(p);
  const c=document.getElementById("asset-change");
  c.textContent=`${pct(change)} today`;
  c.className=change>=0?"positive":"negative";
  document.getElementById("estimate-price").textContent=eur(p);
  document.getElementById("position-title").textContent=a.name;
  updateEstimate();
}

function chartSlice(){
  const s=loadBroker(),arr=s.market[selectedSymbol];
  const n=chartRange===0?arr.length:Math.min(chartRange,arr.length);
  return {data:arr.slice(-n),offset:arr.length-n,s};
}

function drawChart(){
  const svg=document.getElementById("price-chart");
  const {data}=chartSlice();
  const W=1000,H=360,padL=46,padR=24,padT=24,padB=34;
  const min=Math.min(...data),max=Math.max(...data),span=Math.max(0.01,max-min);
  const pts=data.map((v,i)=>({
    x:padL+(i/Math.max(1,data.length-1))*(W-padL-padR),
    y:padT+(1-(v-min)/span)*(H-padT-padB),
    price:v,index:i
  }));
  const path=pts.map((p,i)=>`${i?"L":"M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const fill=`${path} L ${pts.at(-1).x} ${H-padB} L ${pts[0].x} ${H-padB} Z`;

  svg.innerHTML=`
    <defs><linearGradient id="mmArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#35e08f" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#35e08f" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" class="chart-grid-line"/>
    <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" class="chart-grid-line"/>
    <path d="${fill}" fill="url(#mmArea)"/>
    <path d="${path}" class="chart-price-line"/>
    <circle cx="${pts.at(-1).x}" cy="${pts.at(-1).y}" r="5" class="chart-end-dot"/>
    <text x="8" y="${padT+10}" class="chart-svg-label">${eur(max)}</text>
    <text x="8" y="${H-padB}" class="chart-svg-label">${eur(min)}</text>
  `;
  svg.dataset.points=JSON.stringify(pts.map(p=>[p.x,p.y,p.price,p.index]));
}

function chartInspectFromEvent(evt,lock=false){
  const wrap=document.getElementById("chart-wrap");
  const svg=document.getElementById("price-chart");
  const rect=svg.getBoundingClientRect();
  const vbX=(evt.clientX-rect.left)/rect.width*1000;
  const pts=JSON.parse(svg.dataset.points||"[]");
  if(!pts.length)return;
  let nearest=pts.reduce((best,p)=>Math.abs(p[0]-vbX)<Math.abs(best[0]-vbX)?p:best,pts[0]);
  const [x,y,price,localIdx]=nearest;
  const {offset,s}=chartSlice();
  const globalIdx=offset+localIdx;
  const daysBack=(s.market[selectedSymbol].length-1)-globalIdx;
  const d=new Date(s.simDateISO);
  d.setUTCDate(d.getUTCDate()-daysBack);

  document.getElementById("chart-point-price").textContent=eur(price);
  document.getElementById("chart-point-date").textContent=fmtDate(d.toISOString());

  const xPx=x/1000*rect.width;
  const yPx=y/360*rect.height;
  const cross=document.getElementById("chart-crosshair");
  cross.style.left=`${xPx}px`;
  cross.classList.remove("hidden");

  const tip=document.getElementById("chart-tooltip");
  tip.innerHTML=`<strong>${eur(price)}</strong><small>${fmtDate(d.toISOString())}</small>`;
  tip.style.left=`${Math.min(rect.width-120,Math.max(8,xPx+10))}px`;
  tip.style.top=`${Math.max(8,yPx-52)}px`;
  tip.classList.remove("hidden");
  if(lock) wrap.dataset.locked="1";
}

function renderPositions(){
  const s=loadBroker();
  const container=document.getElementById("holdings");
  const entries=Object.entries(s.positions).filter(([,p])=>p.qty>0);
  document.getElementById("holding-count").textContent=`${entries.length} position${entries.length===1?"":"s"}`;
  if(!entries.length){
    container.innerHTML='<p class="muted">No positions yet.</p>';
  } else {
    container.innerHTML='<div class="broker-holdings-list"></div>';
    const list=container.firstElementChild;
    entries.forEach(([sym,pos])=>{
      const p=currentPrice(s,sym),value=p*pos.qty,pnl=(p-pos.avgCost)*pos.qty,pnlPct=pos.avgCost?(p-pos.avgCost)/pos.avgCost*100:0;
      const row=document.createElement("button");
      row.className="holding-broker-row";
      row.innerHTML=`<span><strong>${sym}</strong><small>${pos.qty.toFixed(3)} units · avg ${eur(pos.avgCost)}</small></span><span><strong>${eur(value)}</strong><small class="${pnl>=0?"positive":"negative"}">${eur(pnl)} · ${pct(pnlPct)}</small></span>`;
      row.onclick=()=>{selectedSymbol=sym;document.getElementById("trade-asset").value=sym;renderAll()};
      list.appendChild(row);
    });
  }

  const pos=s.positions[selectedSymbol];
  const box=document.getElementById("selected-position");
  if(!pos || pos.qty<=0){
    box.innerHTML='<p class="muted">No position in this asset.</p>';
  } else {
    const p=currentPrice(s,selectedSymbol),value=p*pos.qty,pnl=(p-pos.avgCost)*pos.qty,pnlPct=(p-pos.avgCost)/pos.avgCost*100;
    box.innerHTML=`
      <div class="position-metrics">
        <span><small>Quantity</small><strong>${pos.qty.toFixed(3)}</strong></span>
        <span><small>Average cost</small><strong>${eur(pos.avgCost)}</strong></span>
        <span><small>Market value</small><strong>${eur(value)}</strong></span>
        <span><small>Unrealized P/L</small><strong class="${pnl>=0?"positive":"negative"}">${eur(pnl)} · ${pct(pnlPct)}</strong></span>
      </div>
      <button id="sell-all-position" class="btn ghost" style="margin-top:12px">Sell entire position</button>`;
    document.getElementById("sell-all-position").onclick=()=>{
      selectedSide="SELL"; updateSideButtons();
      document.getElementById("trade-qty").value=pos.qty.toFixed(3);
      updateEstimate();
      document.querySelector(".trade-ticket").scrollIntoView({behavior:"smooth",block:"start"});
    };
  }
}

function renderOpenOrders(){
  const s=loadBroker(),box=document.getElementById("open-orders");
  document.getElementById("open-orders-count").textContent=s.openOrders.length;
  if(!s.openOrders.length){
    box.innerHTML='<p class="muted">No open limit orders.</p>';return;
  }
  box.innerHTML=`<table class="broker-table"><thead><tr><th>Side</th><th>Asset</th><th>Qty</th><th>Limit</th><th>Created</th><th></th></tr></thead><tbody>${s.openOrders.map(o=>`
    <tr>
      <td><span class="${o.side==="BUY"?"positive":"negative"}">${o.side}</span></td>
      <td>${o.symbol}</td><td>${Number(o.qty).toFixed(3)}</td><td>${eur(o.limitPrice)}</td>
      <td>${fmtDate(o.simDateISO)}</td>
      <td><button class="btn ghost cancel-open-order" data-id="${o.id}">Cancel</button></td>
    </tr>`).join("")}</tbody></table>`;
  document.querySelectorAll(".cancel-open-order").forEach(b=>b.onclick=()=>{
    const s2=loadBroker();
    s2.openOrders=s2.openOrders.filter(o=>o.id!==b.dataset.id);
    saveBroker(s2);renderAll();setMessage("Limit order cancelled.","good");
  });
}

function renderHistory(){
  const s=loadBroker(),box=document.getElementById("order-history");
  const tx=s.transactions.filter(t=>(t.timestamp||0)>(s.displayHistoryClearedAt||0)).slice(0,40);
  if(!tx.length){box.innerHTML='<p class="muted">No displayed transactions.</p>';return}
  box.innerHTML=`<table class="broker-table"><thead><tr><th>Status</th><th>Side</th><th>Asset</th><th>Qty</th><th>Price</th><th>Type</th><th>Sim date</th></tr></thead><tbody>${tx.map(t=>`
    <tr>
      <td>${t.status}</td>
      <td class="${t.side==="BUY"?"positive":"negative"}">${t.side}</td>
      <td>${t.symbol}</td>
      <td>${Number(t.qty).toFixed(3)}</td>
      <td>${eur(t.price)}</td>
      <td>${t.type}${t.type==="LIMIT"&&t.limitPrice?` @ ${eur(t.limitPrice)}`:""}</td>
      <td>${fmtDate(t.simDateISO||new Date(t.timestamp).toISOString())}</td>
    </tr>`).join("")}</tbody></table>`;
}

function updateEstimate(){
  const s=loadBroker();
  const p=currentPrice(s,selectedSymbol);
  const qty=Number(document.getElementById("trade-qty").value)||0;
  const type=document.getElementById("order-type").value;
  const limit=Number(document.getElementById("limit-price").value)||p;
  const ep=type==="LIMIT"?limit:p;
  document.getElementById("estimate-price").textContent=eur(ep);
  document.getElementById("estimate-value").textContent=eur(qty*ep);
}

function updateSideButtons(){
  document.querySelectorAll("#side-buttons button").forEach(b=>b.classList.toggle("active",b.dataset.side===selectedSide));
  const place=document.getElementById("place-order");
  place.textContent=`Review ${selectedSide.toLowerCase()} order`;
  place.classList.toggle("sell-order",selectedSide==="SELL");
}

function buildDraft(){
  const s=loadBroker();
  const type=document.getElementById("order-type").value;
  const qty=Number(document.getElementById("trade-qty").value);
  const limitPrice=Number(document.getElementById("limit-price").value);
  if(!Number.isFinite(qty)||qty<=0) return {error:"Enter a valid quantity."};
  if(type==="LIMIT" && (!Number.isFinite(limitPrice)||limitPrice<=0)) return {error:"Enter a valid limit price."};
  return {
    side:selectedSide,
    type,
    symbol:selectedSymbol,
    qty,
    limitPrice:type==="LIMIT"?limitPrice:null,
    thesis:document.getElementById("trade-thesis").value.trim(),
    currentPrice:currentPrice(s,selectedSymbol)
  };
}

function showOrderReview(draft){
  pendingOrderDraft=draft;
  const s=loadBroker(),a=asset(draft.symbol);
  const estPrice=draft.type==="LIMIT"?draft.limitPrice:draft.currentPrice;
  document.getElementById("review-title").textContent=`${draft.side} ${a.name}`;
  document.getElementById("review-details").innerHTML=`
    <span><small>Order</small><strong>${draft.side} · ${draft.type}</strong></span>
    <span><small>Quantity</small><strong>${draft.qty.toFixed(3)}</strong></span>
    <span><small>${draft.type==="LIMIT"?"Limit price":"Current price"}</small><strong>${eur(estPrice)}</strong></span>
    <span><small>Estimated value</small><strong>${eur(draft.qty*estPrice)}</strong></span>
    <span><small>Buying power</small><strong>${eur(s.cash)}</strong></span>
    <span><small>Position owned</small><strong>${(s.positions[draft.symbol]?.qty||0).toFixed(3)}</strong></span>`;
  document.getElementById("order-review-modal").classList.remove("hidden");
}

function renderAll(){
  renderAccount();
  renderMarket();
  renderAssetHeader();
  drawChart();
  renderPositions();
  renderOpenOrders();
  renderHistory();
}

const offlineDays = syncOfflineMarket();
document.getElementById("offline-status").textContent = offlineDays>0 ? `Caught up ${offlineDays} sim day${offlineDays===1?"":"s"}` : "Market synced";

document.getElementById("trade-asset").addEventListener("change",e=>{selectedSymbol=e.target.value;renderAll()});
document.querySelectorAll("#side-buttons button").forEach(b=>b.onclick=()=>{selectedSide=b.dataset.side;updateSideButtons()});
document.getElementById("order-type").addEventListener("change",()=>{
  document.getElementById("limit-price-row").classList.toggle("hidden",document.getElementById("order-type").value!=="LIMIT");
  const s=loadBroker();document.getElementById("limit-price").value=currentPrice(s,selectedSymbol).toFixed(2);updateEstimate();
});
document.getElementById("trade-qty").addEventListener("input",updateEstimate);
document.getElementById("limit-price").addEventListener("input",updateEstimate);

document.getElementById("place-order").onclick=()=>{
  const d=buildDraft();
  if(d.error)return setMessage(d.error,"bad");
  if(!asset(d.symbol).tradable)return setMessage("This index is a benchmark and cannot be bought directly. Choose an ETF or fund.","bad");
  showOrderReview(d);
};
document.getElementById("cancel-order").onclick=()=>{pendingOrderDraft=null;document.getElementById("order-review-modal").classList.add("hidden")};
document.getElementById("confirm-order").onclick=()=>{
  if(!pendingOrderDraft)return;
  const d=pendingOrderDraft;pendingOrderDraft=null;
  document.getElementById("order-review-modal").classList.add("hidden");
  placeDraftOrder(d);
};

document.getElementById("clear-history").onclick=()=>{
  const s=loadBroker();s.displayHistoryClearedAt=Date.now();saveBroker(s);renderHistory();
};

document.querySelectorAll("#timeframe-buttons button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#timeframe-buttons button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");chartRange=Number(b.dataset.range);drawChart();
});

const chartWrap=document.getElementById("chart-wrap");
chartWrap.addEventListener("mousemove",e=>{if(chartWrap.dataset.locked!=="1")chartInspectFromEvent(e,false)});
chartWrap.addEventListener("click",e=>{chartWrap.dataset.locked = chartWrap.dataset.locked==="1" ? "0" : "1"; chartInspectFromEvent(e,true)});
chartWrap.addEventListener("mouseleave",()=>{
  if(chartWrap.dataset.locked==="1")return;
  document.getElementById("chart-crosshair").classList.add("hidden");
  document.getElementById("chart-tooltip").classList.add("hidden");
  document.getElementById("chart-point-price").textContent="Move over chart";
  document.getElementById("chart-point-date").textContent="";
});

const analyzeBtn=document.getElementById("analyze-btn");
analyzeBtn.onclick=()=>{
  const box=document.getElementById("analysis-box");
  box.classList.toggle("hidden");
  analyzeBtn.textContent=box.classList.contains("hidden")?"Quick analysis":"Hide quick analysis";
};
document.querySelectorAll(".analysis-check").forEach(c=>c.addEventListener("change",()=>{
  const n=[...document.querySelectorAll(".analysis-check")].filter(x=>x.checked).length;
  document.getElementById("analysis-score").textContent=`${n} / 5`;
}));

updateSideButtons();
renderAll();

// During an open page, allow the fictional market to catch up if enough real time passes.
setInterval(()=>{
  const n=syncOfflineMarket();
  if(n>0){
    document.getElementById("offline-status").textContent=`Advanced ${n} sim day${n===1?"":"s"}`;
    renderAll();
  }
}, 60 * 1000);
