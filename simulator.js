const assets=[
  {symbol:"AUR",name:"Aurora Tech",type:"Stock",price:128.40,change:1.8},
  {symbol:"GLB",name:"Global 100 ETF",type:"ETF",price:86.25,change:0.6},
  {symbol:"WDX",name:"World Index",type:"Index",price:245.10,change:-0.4},
  {symbol:"GRN",name:"Green Future ETF",type:"ETF",price:51.70,change:2.3},
  {symbol:"BNK",name:"Banking Leaders",type:"Index Fund",price:73.95,change:-0.9}
];

const market=document.getElementById("market-list");
const select=document.getElementById("trade-asset");
const holdingsEl=document.getElementById("holdings");
const msg=document.getElementById("trade-message");

assets.forEach(a=>{
  market.insertAdjacentHTML("beforeend",`<div class="asset-row">
    <div class="asset-name"><strong>${a.symbol}</strong><small>${a.name} · ${a.type}</small></div>
    <strong>€${a.price.toFixed(2)}</strong>
    <span class="${a.change>=0?"positive":"negative"}">${a.change>=0?"+":""}${a.change.toFixed(1)}%</span>
    <button class="btn ghost quick-buy" data-symbol="${a.symbol}">Trade</button>
  </div>`);
  select.insertAdjacentHTML("beforeend",`<option value="${a.symbol}">${a.symbol} — ${a.name}</option>`);
});

document.querySelectorAll(".quick-buy").forEach(b=>b.addEventListener("click",()=>{
  select.value=b.dataset.symbol; document.getElementById("trade-qty").focus();
}));

function state(){return getState()}
function save(s){saveState(s);renderPortfolio()}

function buy(){
  const s=state(), symbol=select.value, qty=Number(document.getElementById("trade-qty").value);
  const asset=assets.find(a=>a.symbol===symbol), cost=asset.price*qty;
  if(!Number.isFinite(qty)||qty<=0){msg.textContent="Enter a valid quantity.";return}
  if(cost>s.simulatorCash){msg.textContent="Not enough virtual cash.";return}
  s.simulatorCash-=cost;
  s.holdings[symbol]=(s.holdings[symbol]||0)+qty;
  s.transactions.push({side:"BUY",symbol,qty,price:asset.price,date:new Date().toISOString()});
  msg.textContent=`Bought ${qty} ${symbol} for €${cost.toFixed(2)} (virtual).`;
  save(s);
}
function sell(){
  const s=state(), symbol=select.value, qty=Number(document.getElementById("trade-qty").value);
  const asset=assets.find(a=>a.symbol===symbol), owned=s.holdings[symbol]||0;
  if(!Number.isFinite(qty)||qty<=0){msg.textContent="Enter a valid quantity.";return}
  if(qty>owned){msg.textContent=`You only own ${owned} ${symbol}.`;return}
  s.holdings[symbol]-=qty; if(s.holdings[symbol]===0)delete s.holdings[symbol];
  s.simulatorCash+=asset.price*qty;
  s.transactions.push({side:"SELL",symbol,qty,price:asset.price,date:new Date().toISOString()});
  msg.textContent=`Sold ${qty} ${symbol} for €${(asset.price*qty).toFixed(2)} (virtual).`;
  save(s);
}
function renderPortfolio(){
  const s=state(); let invested=0;
  const rows=Object.entries(s.holdings);
  holdingsEl.innerHTML=rows.length?"":"<p class='muted'>No positions yet.</p>";
  rows.forEach(([symbol,qty])=>{
    const asset=assets.find(a=>a.symbol===symbol), value=asset.price*qty; invested+=value;
    holdingsEl.insertAdjacentHTML("beforeend",`<div class="holding-row"><span><strong>${symbol}</strong><br><small class="muted">${qty} units</small></span><strong>€${value.toFixed(2)}</strong></div>`);
  });
  const total=s.simulatorCash+invested;
  document.getElementById("cash-value").textContent=`€${s.simulatorCash.toFixed(2)}`;
  document.getElementById("invested-value").textContent=`€${invested.toFixed(2)}`;
  document.getElementById("portfolio-value").textContent=`€${total.toFixed(2)}`;
  document.getElementById("return-value").textContent=`${(((total-10000)/10000)*100).toFixed(1)}%`;
  document.getElementById("holding-count").textContent=`${rows.length} asset${rows.length===1?"":"s"}`;
}
document.getElementById("buy-btn").onclick=buy;
document.getElementById("sell-btn").onclick=sell;
renderPortfolio();

const ab=document.getElementById("analyze-btn");if(ab)ab.addEventListener("click",()=>{const x=document.getElementById("analysis-box");x.classList.toggle("hidden");ab.textContent=x.classList.contains("hidden")?"Analyze before buying":"Hide analysis"});document.querySelectorAll(".chart-toolbar button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".chart-toolbar button").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
