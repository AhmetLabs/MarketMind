(function(){
"use strict";

const PF_KEY="mm-pfs", PF_ACTIVE_KEY="mm-active-pf-v14";
const SIM_MS=60*1000, REAL_MINUTES_PER_SIM_DAY=30, MAX_OFFLINE_SIM_DAYS=365;
const INITIAL_MARGIN=0.50, MAINT_MARGIN=0.30, TARGET_MARGIN=0.35, MARGIN_APR=0.08;

const ASSETS=[
 {symbol:"AUR",name:"Aurora Tech",type:"Stock",start:72,drift:.00055,vol:.018,seed:14,tradable:true,dividend:0},
 {symbol:"GLB",name:"Global 100 ETF",type:"ETF",start:64,drift:.00033,vol:.009,seed:25,tradable:true,dividend:.22},
 {symbol:"WDX",name:"World Index",type:"Index",start:188,drift:.00028,vol:.007,seed:36,tradable:false,dividend:0},
 {symbol:"GRN",name:"Green Future ETF",type:"ETF",start:39,drift:.00046,vol:.016,seed:47,tradable:true,dividend:.08},
 {symbol:"BNK",name:"Banking Leaders Fund",type:"Index Fund",start:56,drift:.00024,vol:.012,seed:58,tradable:true,dividend:.18}
];

let selectedSymbol="AUR",selectedSide="BUY",chartRange=365,pendingOrderDraft=null;
let replayTimer=null,replaySpeed=5;

function ensureRegistry(){
 let items=[];try{items=JSON.parse(localStorage.getItem(PF_KEY)||"[]")}catch{}
 let changed=false;
 items=items.map((p,i)=>{if(!p.id){p.id=`pf-${Date.now()}-${i}`;changed=true}if(p.start==null){p.start=Number(p.capital)||10000;changed=true}p.accountType||="CASH";return p});
 if(!items.length){items=[{id:"pf-main",name:"Main Portfolio",start:10000,capital:10000,style:"Balanced",accountType:"CASH"}];changed=true}
 if(changed)localStorage.setItem(PF_KEY,JSON.stringify(items));
 let active=localStorage.getItem(PF_ACTIVE_KEY);
 if(!items.some(p=>p.id===active)){active=items[0].id;localStorage.setItem(PF_ACTIVE_KEY,active)}
 return {items,active};
}
function activePortfolio(){const r=ensureRegistry();return r.items.find(p=>p.id===r.active)}
function brokerKey(){return `marketmind-broker-v14:${ensureRegistry().active}`}
function eur(v){return `€${Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function pct(v){return `${v>=0?"+":""}${Number(v||0).toFixed(2)}%`}
function fmtDate(v){return new Date(v).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function asset(sym){return ASSETS.find(a=>a.symbol===sym)}
function rand(seed){const x=Math.sin(seed)*10000;return x-Math.floor(x)}
function nextPrice(a,prev,day){const cycle=Math.sin((day+a.seed)/34)*.0032+Math.sin((day+a.seed)/91)*.0018;const noise=(rand(a.seed*1009+day*17)-.5)*a.vol*2;return Math.max(2,+((prev*(1+a.drift+cycle+noise)).toFixed(2)))}
function bootstrap(a,n=900){let p=a.start,arr=[];for(let i=0;i<n;i++){p=nextPrice(a,p,i);arr.push(p)}return arr}
function defaultState(start){
 const market={};ASSETS.forEach(a=>market[a.symbol]=bootstrap(a));
 return {version:14,cash:start,startingEquity:start,loan:0,interestAccrued:0,realizedPnL:0,positions:{},openOrders:[],transactions:[],events:[],appliedEvents:{},market,simDay:899,simDateISO:"2026-08-26T00:00:00.000Z",lastRealUpdate:Date.now(),displayHistoryClearedAt:0,replay:null}
}
function loadState(){
 const pf=activePortfolio();let s=null;try{s=JSON.parse(localStorage.getItem(brokerKey())||"null")}catch{}
 if(!s||s.version!==14)s=defaultState(Number(pf.start)||10000);
 s.positions||={};s.openOrders||=[];s.transactions||=[];s.events||=[];s.appliedEvents||={};s.market||={};
 ASSETS.forEach(a=>{if(!Array.isArray(s.market[a.symbol])||!s.market[a.symbol].length)s.market[a.symbol]=bootstrap(a)});
 return s
}
function saveState(s){localStorage.setItem(brokerKey(),JSON.stringify(s))}
function inReplay(s){return !!s.replay?.active}
function acct(s){return inReplay(s)?s.replay.account:s}
function priceIndex(s){return inReplay(s)?s.replay.index:s.market[selectedSymbol].length-1}
function currentPrice(s,sym=selectedSymbol){const arr=s.market[sym];const i=inReplay(s)?Math.min(s.replay.index,arr.length-1):arr.length-1;return arr[i]}
function previousPrice(s,sym=selectedSymbol){const arr=s.market[sym];const i=inReplay(s)?Math.min(s.replay.index,arr.length-1):arr.length-1;return arr[Math.max(0,i-1)]}
function simDate(s){if(!inReplay(s))return s.simDateISO;const d=new Date(s.simDateISO),days=(s.market[selectedSymbol].length-1)-s.replay.index;d.setUTCDate(d.getUTCDate()-days);return d.toISOString()}

function addEvent(s,type,title,detail){s.events.unshift({id:`ev-${Date.now()}-${Math.random()}`,type,title,detail,simDateISO:s.simDateISO});s.events=s.events.slice(0,30)}
function processCorporateActions(s){
 // Dividends every 90 sim days, one event id per day/symbol.
 if(s.simDay%90===0){
   ASSETS.filter(a=>a.dividend>0).forEach(a=>{
     const id=`div-${s.simDay}-${a.symbol}`;if(s.appliedEvents[id])return;
     s.appliedEvents[id]=1;const pos=s.positions[a.symbol];const qty=pos?.qty||0;const amount=qty*a.dividend;s.cash+=amount;
     addEvent(s,"DIVIDEND",`${a.symbol} dividend`,qty?`${qty.toFixed(3)} units × ${eur(a.dividend)} = ${eur(amount)} cash credited.`:`${eur(a.dividend)} per unit declared; no position held.`);
     if(qty)s.transactions.unshift({id,side:"DIVIDEND",type:"CASH",symbol:a.symbol,qty,price:a.dividend,timestamp:Date.now(),simDateISO:s.simDateISO,status:"CREDITED"});
   });
 }
 // One-time demo 2-for-1 split at sim day 930.
 if(s.simDay>=930&&!s.appliedEvents["split-AUR-930"]){
   s.appliedEvents["split-AUR-930"]=1;
   const ratio=2, sym="AUR";
   // Use split-adjusted historical series, as many real chart providers do.
   s.market[sym]=s.market[sym].map(p=>+(p/ratio).toFixed(2));
   const pos=s.positions[sym];if(pos){pos.qty*=ratio;pos.avgCost/=ratio}
   s.openOrders.filter(o=>o.symbol===sym).forEach(o=>{o.qty*=ratio;o.limitPrice/=ratio});
   addEvent(s,"SPLIT","AUR 2-for-1 stock split","Position quantities doubled and average cost/price basis halved. Economic value is unchanged at the split instant.");
 }
}
function accrueMarginInterest(s){
 if(s.loan<=0)return;
 const daily=s.loan*MARGIN_APR/365;s.loan+=daily;s.interestAccrued+=daily;
}
function metricsFor(account,s){
 let mv=0,unreal=0;
 Object.entries(account.positions||{}).forEach(([sym,p])=>{if(!p||p.qty<=0)return;const px=currentPrice(s,sym);mv+=p.qty*px;unreal+=(px-p.avgCost)*p.qty});
 const equity=account.cash+mv-(account.loan||0);
 const pf=activePortfolio();const margin=pf.accountType==="MARGIN"&&!inReplay(s);
 let reserved=0;(account.openOrders||[]).filter(o=>o.side==="BUY").forEach(o=>reserved+=o.qty*o.limitPrice);
 const maxGross=margin?Math.max(0,equity/INITIAL_MARGIN):account.cash;
 const buyingPower=margin?Math.max(0,maxGross-mv-reserved):Math.max(0,account.cash-reserved);
 const ratio=mv>0?equity/mv:Infinity;
 return {mv,unreal,equity,buyingPower,ratio,reserved}
}
function maintenanceCheck(s){
 if(inReplay(s))return;
 const pf=activePortfolio();if(pf.accountType!=="MARGIN")return;
 let m=metricsFor(s,s);
 if(m.mv<=0||m.ratio>=MAINT_MARGIN)return;
 addEvent(s,"MARGIN","Margin call",`Maintenance ratio fell to ${(m.ratio*100).toFixed(1)}%. Forced liquidation started.`);
 const positions=Object.entries(s.positions).sort((a,b)=>(b[1].qty*currentPrice(s,b[0]))-(a[1].qty*currentPrice(s,a[0])));
 for(const [sym,pos] of positions){
   if(m.ratio>=TARGET_MARGIN)break;
   execute(s,s,{side:"SELL",type:"MARGIN_LIQUIDATION",symbol:sym,qty:pos.qty,fillPrice:currentPrice(s,sym),thesis:"Automatic margin liquidation"},true);
   m=metricsFor(s,s);
 }
}
function processOpenOrders(s){
 const astate=acct(s),remain=[];
 for(const o of astate.openOrders||[]){
   const px=currentPrice(s,o.symbol);
   const fill=(o.side==="BUY"&&px<=o.limitPrice)||(o.side==="SELL"&&px>=o.limitPrice);
   if(fill){
     const ok=execute(s,astate,{...o,fillPrice:px,type:"LIMIT"},true);
     if(!ok)astate.transactions.unshift({...o,price:px,status:"REJECTED",timestamp:Date.now(),simDateISO:simDate(s)});
   }else remain.push(o)
 }
 astate.openOrders=remain;
}
function advanceOneSimDay(s){
 s.simDay++;
 ASSETS.forEach(a=>{const h=s.market[a.symbol];h.push(nextPrice(a,h.at(-1),s.simDay));if(h.length>1825)h.shift()});
 const d=new Date(s.simDateISO);d.setUTCDate(d.getUTCDate()+1);s.simDateISO=d.toISOString();
 accrueMarginInterest(s);processCorporateActions(s);processOpenOrders(s);maintenanceCheck(s)
}
function syncOffline(){
 const s=loadState();if(inReplay(s))return 0;
 const now=Date.now(),elapsed=Math.max(0,now-(s.lastRealUpdate||now));
 const days=Math.min(MAX_OFFLINE_SIM_DAYS,Math.floor(elapsed/(REAL_MINUTES_PER_SIM_DAY*SIM_MS)));
 for(let i=0;i<days;i++)advanceOneSimDay(s);
 s.lastRealUpdate=days?s.lastRealUpdate+days*REAL_MINUTES_PER_SIM_DAY*SIM_MS:now;saveState(s);return days
}

function execute(s,account,o,automatic=false){
 const a=asset(o.symbol),qty=Number(o.qty),px=Number(o.fillPrice??currentPrice(s,o.symbol));if(!a?.tradable||qty<=0||px<=0)return false;
 account.positions||={};account.transactions||=[];account.loan||=0;account.cash||=0;
 const p=account.positions[o.symbol]||{qty:0,avgCost:0};
 if(o.side==="BUY"){
   const cost=qty*px, m=metricsFor(account,s), margin=activePortfolio().accountType==="MARGIN"&&!inReplay(s);
   if(cost>m.buyingPower+1e-7)return false;
   const useCash=Math.min(account.cash,cost),borrow=cost-useCash;
   account.cash-=useCash;if(borrow>0){if(!margin)return false;account.loan+=borrow}
   const old=p.qty*p.avgCost;p.qty+=qty;p.avgCost=(old+cost)/p.qty;account.positions[o.symbol]=p;
 }else{
   if(qty>p.qty+1e-7)return false;
   const realized=(px-p.avgCost)*qty;account.realizedPnL=(account.realizedPnL||0)+realized;
   let proceeds=qty*px;
   if(account.loan>0&&!inReplay(s)){const repay=Math.min(account.loan,proceeds);account.loan-=repay;proceeds-=repay}
   account.cash+=proceeds;p.qty-=qty;if(p.qty<=1e-7)delete account.positions[o.symbol];else account.positions[o.symbol]=p;
 }
 account.transactions.unshift({id:o.id||`tx-${Date.now()}-${Math.random()}`,side:o.side,type:o.type||"MARKET",symbol:o.symbol,qty,price:px,limitPrice:o.limitPrice??null,timestamp:Date.now(),simDateISO:simDate(s),status:"FILLED",thesis:o.thesis||"",automatic});
 return true
}

function submitOrder(d){
 const s=loadState(),account=acct(s),a=asset(d.symbol);if(!a.tradable)return msg("This benchmark cannot be bought directly.","bad");
 const px=currentPrice(s,d.symbol);
 if(d.type==="LIMIT"){
   const marketable=(d.side==="BUY"&&d.limitPrice>=px)||(d.side==="SELL"&&d.limitPrice<=px);
   if(marketable){
     const ok=execute(s,account,{...d,fillPrice:px});if(!ok)return msg(d.side==="BUY"?"Insufficient buying power.":"Insufficient position.","bad");
     msg(`Marketable limit order filled at ${eur(px)}.`,"good");
   }else{
     const m=metricsFor(account,s);
     if(d.side==="BUY"&&d.qty*d.limitPrice>m.buyingPower+1e-7)return msg("Not enough buying power for this limit order.","bad");
     if(d.side==="SELL"){
       const owned=account.positions[d.symbol]?.qty||0;
       const already=(account.openOrders||[]).filter(o=>o.side==="SELL"&&o.symbol===d.symbol).reduce((n,o)=>n+o.qty,0);
       if(d.qty+already>owned+1e-7)return msg("Your open sell orders exceed the position you own.","bad");
     }
     account.openOrders||=[];account.openOrders.unshift({...d,id:`ord-${Date.now()}-${Math.random()}`,status:"OPEN",createdAt:Date.now(),simDateISO:simDate(s)});
     msg(`${d.side} limit order opened at ${eur(d.limitPrice)}.`,"good");
   }
 }else{
   const ok=execute(s,account,{...d,fillPrice:px});if(!ok)return msg(d.side==="BUY"?"Insufficient buying power.":"Insufficient position.","bad");
   msg(`${d.side==="BUY"?"Bought":"Sold"} ${d.qty} ${d.symbol} at ${eur(px)}.`,"good");
 }
 saveState(s);renderAll()
}

function msg(t,k=""){const e=document.getElementById("trade-message");e.textContent=t;e.className=`trade-note ${k==="good"?"positive":k==="bad"?"negative":""}`}
function populatePortfolios(){
 const {items,active}=ensureRegistry(),sel=document.getElementById("portfolio-select");sel.innerHTML="";
 items.forEach(p=>sel.insertAdjacentHTML("beforeend",`<option value="${p.id}">${p.name} · ${p.accountType==="MARGIN"?"Margin":"Cash"}</option>`));sel.value=active;
 sel.onchange=()=>{localStorage.setItem(PF_ACTIVE_KEY,sel.value);selectedSymbol="AUR";syncOffline();renderAll()}
}
function renderAccount(){
 const s=loadState(),a=acct(s),m=metricsFor(a,s),pf=activePortfolio();
 let prevMv=0;Object.entries(a.positions||{}).forEach(([sym,p])=>prevMv+=p.qty*previousPrice(s,sym));
 const prevEq=a.cash+prevMv-(a.loan||0),chg=m.equity-prevEq,cp=prevEq?chg/prevEq*100:0;
 document.getElementById("account-equity").textContent=eur(m.equity);document.getElementById("account-cash").textContent=eur(a.cash);document.getElementById("account-invested").textContent=eur(m.mv);document.getElementById("account-buying-power").textContent=eur(m.buyingPower);document.getElementById("account-unrealized").textContent=eur(m.unreal);document.getElementById("account-realized").textContent=eur(a.realizedPnL||0);document.getElementById("account-loan").textContent=eur(a.loan||0);document.getElementById("margin-interest").textContent=eur(a.interestAccrued||0);
 document.getElementById("maintenance-ratio").textContent=m.ratio===Infinity?"—":`${(m.ratio*100).toFixed(1)}%`;
 const dc=document.getElementById("account-day-change");dc.textContent=`${eur(chg)} (${pct(cp)}) today`;dc.className=chg>=0?"positive":"negative";
 document.getElementById("sim-clock").textContent=fmtDate(simDate(s));document.getElementById("account-type-pill").textContent=inReplay(s)?"Replay cash":pf.accountType==="MARGIN"?"Margin":"Cash";
 document.getElementById("toggle-margin").textContent=pf.accountType==="MARGIN"?"Disable margin account":"Enable margin account";document.getElementById("repay-margin").classList.toggle("hidden",!(a.loan>0&&!inReplay(s)));
 document.getElementById("toggle-margin").disabled=inReplay(s);
 if(!inReplay(s)&&window.recordPortfolioSnapshot){const reg=ensureRegistry(),pf=reg.items.find(x=>x.id===reg.active);window.recordPortfolioSnapshot({portfolioId:pf.id,portfolioName:pf.name,equity:m.equity,realizedPnL:a.realizedPnL||0,unrealizedPnL:m.unreal});}
}
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

const offline=syncOffline();document.getElementById("offline-status").textContent=offline?`Caught up ${offline} sim day${offline===1?"":"s"}`:"Market synced";
document.getElementById("trade-asset").onchange=e=>{selectedSymbol=e.target.value;renderAll()};
document.querySelectorAll("#side-buttons button").forEach(b=>b.onclick=()=>{selectedSide=b.dataset.side;sideUI()});
document.getElementById("order-type").onchange=()=>{const l=document.getElementById("order-type").value==="LIMIT";document.getElementById("limit-price-row").classList.toggle("hidden",!l);if(l)document.getElementById("limit-price").value=currentPrice(loadState()).toFixed(2);updateEstimate()};
document.getElementById("trade-qty").oninput=updateEstimate;document.getElementById("limit-price").oninput=updateEstimate;
document.getElementById("place-order").onclick=()=>{const d=draft();if(d.error)return msg(d.error,"bad");if(!asset(d.symbol).tradable)return msg("This is a benchmark, not a directly tradable security.","bad");review(d)};
document.getElementById("cancel-order").onclick=()=>{pendingOrderDraft=null;document.getElementById("order-review-modal").classList.add("hidden")};
document.getElementById("confirm-order").onclick=()=>{if(!pendingOrderDraft)return;const d=pendingOrderDraft;pendingOrderDraft=null;document.getElementById("order-review-modal").classList.add("hidden");submitOrder(d)};
document.getElementById("clear-history").onclick=()=>{const s=loadState(),a=acct(s);a.displayHistoryClearedAt=Date.now();saveState(s);renderHistory()};
document.querySelectorAll("#timeframe-buttons button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#timeframe-buttons button").forEach(x=>x.classList.remove("active"));b.classList.add("active");chartRange=+b.dataset.range;drawChart()});
document.getElementById("chart-wrap").onmousemove=inspectChart;document.getElementById("chart-wrap").onclick=inspectChart;
document.getElementById("analyze-btn").onclick=()=>{const b=document.getElementById("analysis-box");b.classList.toggle("hidden")};document.querySelectorAll(".analysis-check").forEach(c=>c.onchange=()=>document.getElementById("analysis-score").textContent=`${[...document.querySelectorAll(".analysis-check")].filter(x=>x.checked).length} / 5`);
document.getElementById("toggle-margin").onclick=()=>{
 if(inReplay(loadState()))return;
 const r=ensureRegistry(),p=r.items.find(x=>x.id===r.active),s=loadState(),m=metricsFor(s,s);
 if(p.accountType==="MARGIN"&&(s.loan>0||m.mv>0)){document.getElementById("margin-message").textContent="Sell positions and repay the margin loan before switching back to a cash account.";return}
 p.accountType=p.accountType==="MARGIN"?"CASH":"MARGIN";localStorage.setItem(PF_KEY,JSON.stringify(r.items));document.getElementById("margin-message").textContent=p.accountType==="MARGIN"?"Margin enabled: up to ~2× gross exposure, subject to maintenance rules.":"Cash account enabled.";renderAll()
};
document.getElementById("repay-margin").onclick=()=>{const s=loadState();if(s.loan<=0)return;const pay=Math.min(s.cash,s.loan);s.cash-=pay;s.loan-=pay;saveState(s);renderAll();document.getElementById("margin-message").textContent=`Repaid ${eur(pay)} of margin loan.`};
document.getElementById("replay-days").oninput=renderReplay;document.getElementById("replay-speed").onchange=e=>{replaySpeed=+e.target.value||5};
function stopReplayTimer(){if(replayTimer){clearInterval(replayTimer);replayTimer=null}const ff=document.getElementById("replay-fast-forward");if(ff)ff.textContent="▶▶ Fast forward"}
function replayAdvance(days=1){const s=loadState();if(!inReplay(s))return;let moved=0;while(moved<days&&s.replay.index<s.market[selectedSymbol].length-1){s.replay.index++;processOpenOrders(s);moved++}saveState(s);renderAll();if(s.replay.index>=s.market[selectedSymbol].length-1){stopReplayTimer();msg("Replay reached the current simulated date.","good")}}
document.getElementById("replay-start").onclick=()=>{stopReplayTimer();const s=loadState(),days=+document.getElementById("replay-days").value,startCash=Math.max(1000,Math.min(1e9,+document.getElementById("replay-start-cash").value||10000)),index=Math.max(30,s.market[selectedSymbol].length-1-days);s.replay={active:true,index,account:{cash:startCash,startingEquity:startCash,loan:0,interestAccrued:0,realizedPnL:0,positions:{},openOrders:[],transactions:[],displayHistoryClearedAt:0}};saveState(s);renderAll();msg(`Historical Replay started with ${eur(startCash)}. Future prices are hidden.`,"good")};
document.getElementById("replay-fast-forward").onclick=()=>{const s=loadState();if(!inReplay(s))return;if(replayTimer){stopReplayTimer();return}document.getElementById("replay-fast-forward").textContent="▶▶ Running";replayTimer=setInterval(()=>replayAdvance(replaySpeed),500)};document.getElementById("replay-pause").onclick=()=>{stopReplayTimer();msg("Historical Replay paused.","good")};document.getElementById("replay-exit-x").onclick=()=>{stopReplayTimer();const s=loadState();s.replay=null;saveState(s);renderAll();msg("Returned to live simulated portfolio.","good")};
sideUI();renderAll();
setInterval(()=>{const n=syncOffline();if(n){document.getElementById("offline-status").textContent=`Advanced ${n} sim day${n===1?"":"s"}`;renderAll()}},60*1000);

})();
