const MARKETMIND_STATE_KEY = "marketmind-state";
const MARKETMIND_STATE_VERSION = 5;
const MARKETMIND_RECOVERY_KEY = "marketmind-v15-recovery-applied";
const MARKETMIND_CALENDAR_KEY = "marketmind-calendar-v15";

const LEVELS = [
  { level: 1, name: "Finance Fundamentals", minXp: 0, maxXp: 399, description: "Core statements, cash, debt and essential ratios." },
  { level: 2, name: "Financial Statements", minXp: 400, maxXp: 799, description: "Read the income statement, balance sheet and cash flow statement together." },
  { level: 3, name: "Financial Analysis", minXp: 800, maxXp: 1299, description: "Margins, working capital, earnings quality and operating leverage." },
  { level: 4, name: "Valuation", minXp: 1300, maxXp: 1899, description: "Multiples, ROIC, WACC, DCF and sensitivity analysis." },
  { level: 5, name: "Analyst Training", minXp: 1900, maxXp: 2599, description: "Build theses, separate facts from hypotheses and compare companies." },
  { level: 6, name: "Portfolio Management", minXp: 2600, maxXp: 3399, description: "Portfolio construction, position sizing and simulated decision making." },
  { level: 7, name: "Advanced Risk", minXp: 3400, maxXp: 4299, description: "Leverage, margin, risk controls and downside analysis." },
  { level: 8, name: "Investment Committee", minXp: 4300, maxXp: Infinity, description: "Full cases, capital allocation and investment committee decisions." }
];

const FEATURE_UNLOCKS = {
  "lesson.html": { level: 1, label: "Lessons" },
  "dictionary.html": { level: 1, label: "Dictionary" },
  "quiz.html": { level: 2, label: "Quiz" },
  "analyst.html": { level: 3, label: "Analyst Lab" },
  "portfolios.html": { level: 4, label: "Portfolios" },
  "calendar.html": { level: 1, label: "Performance Calendar" },
  "simulator.html": { level: 5, label: "Market Simulator" },
  "asset-analysis.html": { level: 6, label: "Full Asset Analysis" },
  "leverage.html": { level: 7, label: "Leverage Lab" },
  "news.html": { level: 8, label: "Market News Challenges" }
};

const DEFAULT_STATE = {
  version: MARKETMIND_STATE_VERSION, xp: 2100, masteredConcepts: 36, totalConcepts: 145,
  streak: 1, coins: 145, lastActiveDate: null, lastRewardDate: null, lessonCompletions: 0,
  quizCompletions: 0, analystCasesCompleted: 0, simulatorCash: 10000, holdings: {},
  transactions: [], unlockHistory: [], lastContractSignature: "", contractsSigned: 0
};

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetweenDateKeys(a, b) {
  if (!a || !b) return null;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ua = Date.UTC(ay, am - 1, ad);
  const ub = Date.UTC(by, bm - 1, bd);
  return Math.round((ub - ua) / 86400000);
}

function migrateState(raw) {
  let s = { ...DEFAULT_STATE, ...(raw || {}) };
  const looksAccidentallyReset = !raw || ((Number(raw.xp||0)===0) && (Number(raw.masteredConcepts||0)===0) && (Number(raw.lessonCompletions||0)===0) && (Number(raw.quizCompletions||0)===0) && (Number(raw.coins||0)<=50));
  if (looksAccidentallyReset && localStorage.getItem(MARKETMIND_RECOVERY_KEY)!=="1") {
    s.xp=Math.max(Number(s.xp||0),2100); s.masteredConcepts=Math.max(Number(s.masteredConcepts||0),36);
    s.totalConcepts=Math.max(Number(s.totalConcepts||0),145); s.coins=Math.max(Number(s.coins||0),145);
    s.streak=1; s.lastActiveDate=null; localStorage.setItem(MARKETMIND_RECOVERY_KEY,"1");
  }
  s.version=MARKETMIND_STATE_VERSION; s.xp=Math.max(0,Number(s.xp||0)); s.coins=Math.max(0,Number(s.coins||0));
  s.masteredConcepts=Math.max(0,Number(s.masteredConcepts||0)); s.totalConcepts=Math.max(145,Number(s.totalConcepts||145)); return s;
}
function getState(){
  try { const raw=JSON.parse(localStorage.getItem(MARKETMIND_STATE_KEY)||"null"); const migrated=migrateState(raw); localStorage.setItem(MARKETMIND_STATE_KEY,JSON.stringify(migrated)); return migrated; }
  catch { const fallback={...DEFAULT_STATE}; localStorage.setItem(MARKETMIND_STATE_KEY,JSON.stringify(fallback)); return fallback; }
}
function saveState(s){ localStorage.setItem(MARKETMIND_STATE_KEY,JSON.stringify({...s,version:MARKETMIND_STATE_VERSION})); }
window.getState=getState; window.saveState=saveState;

function getLevelInfo(xp = getState().xp) {
  return LEVELS.find(l => xp >= l.minXp && xp <= l.maxXp) || LEVELS[LEVELS.length - 1];
}

function getNextLevelInfo(xp = getState().xp) {
  const current = getLevelInfo(xp);
  return LEVELS.find(l => l.level === current.level + 1) || null;
}

function levelProgress(xp = getState().xp) {
  const current = getLevelInfo(xp);
  const next = getNextLevelInfo(xp);
  if (!next) return 100;
  const span = next.minXp - current.minXp;
  return Math.max(0, Math.min(100, Math.round(((xp - current.minXp) / span) * 100)));
}

function updateStreakOnVisit(){
  const s=getState(),today=localDateKey();
  if(!s.lastActiveDate){s.streak=1;s.lastActiveDate=today;saveState(s);return s;}
  const gap=daysBetweenDateKeys(s.lastActiveDate,today);
  if(gap===1)s.streak=Math.max(1,Number(s.streak||0))+1; else if(gap>1)s.streak=1;
  if(gap!==0)s.lastActiveDate=today; saveState(s); return s;
}


function getCalendarState(){try{return JSON.parse(localStorage.getItem(MARKETMIND_CALENDAR_KEY)||"null")||{visits:{},portfolios:{}}}catch{return{visits:{},portfolios:{}}}}
function saveCalendarState(c){localStorage.setItem(MARKETMIND_CALENDAR_KEY,JSON.stringify(c))}
function recordVisit(pageName=""){const c=getCalendarState(),key=localDateKey(),e=c.visits[key]||{count:0,pages:[],firstVisit:new Date().toISOString(),lastVisit:null};e.count++;e.lastVisit=new Date().toISOString();if(pageName&&!e.pages.includes(pageName))e.pages.push(pageName);c.visits[key]=e;saveCalendarState(c)}
function recordPortfolioSnapshot({portfolioId,portfolioName,equity,realizedPnL=0,unrealizedPnL=0}={}){if(!portfolioId||!Number.isFinite(Number(equity)))return;const c=getCalendarState();c.portfolios[portfolioId]||={name:portfolioName||"Portfolio",days:{}};c.portfolios[portfolioId].name=portfolioName||c.portfolios[portfolioId].name;const days=c.portfolios[portfolioId].days,today=localDateKey(),prevKeys=Object.keys(days).filter(k=>k<today).sort(),prev=prevKeys.length?days[prevKeys.at(-1)]:null,baseline=prev?Number(prev.closeEquity):Number(equity);const d=days[today]||{openEquity:baseline,closeEquity:Number(equity),pnl:0,returnPct:0,realizedPnL:0,unrealizedPnL:0,snapshots:0};d.closeEquity=Number(equity);d.pnl=d.closeEquity-d.openEquity;d.returnPct=d.openEquity?(d.pnl/d.openEquity)*100:0;d.realizedPnL=Number(realizedPnL||0);d.unrealizedPnL=Number(unrealizedPnL||0);d.snapshots=(d.snapshots||0)+1;days[today]=d;saveCalendarState(c)}
window.getCalendarState=getCalendarState;window.recordPortfolioSnapshot=recordPortfolioSnapshot;

function showToast(message, type = "success") {
  let host = document.getElementById("mm-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "mm-toast-host";
    host.className = "mm-toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `mm-toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 20);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function recordUnlocks(beforeLevel, afterLevel, state) {
  if (afterLevel <= beforeLevel) return [];
  const unlocked = [];
  for (const [href, meta] of Object.entries(FEATURE_UNLOCKS)) {
    if (meta.level > beforeLevel && meta.level <= afterLevel) {
      unlocked.push(meta.label);
      state.unlockHistory = state.unlockHistory || [];
      if (!state.unlockHistory.includes(href)) state.unlockHistory.push(href);
    }
  }
  return unlocked;
}

function awardProgress({ xp = 0, coins = 0, activity = "Progress" } = {}) {
  const s = getState();
  const beforeLevel = getLevelInfo(s.xp).level;
  s.xp += Math.max(0, Number(xp) || 0);
  s.coins += Math.max(0, Number(coins) || 0);
  const afterLevel = getLevelInfo(s.xp).level;
  const unlocked = recordUnlocks(beforeLevel, afterLevel, s);
  saveState(s);
  updateDashboard();
  const rewardBits = [];
  if (xp) rewardBits.push(`+${xp} XP`);
  if (coins) rewardBits.push(`+${coins} MindCoins`);
  if (rewardBits.length) showToast(`${activity}: ${rewardBits.join(" · ")}`);
  if (afterLevel > beforeLevel) {
    showToast(`Level up! Level ${afterLevel} — ${getLevelInfo(s.xp).name}`, "level");
    if (unlocked.length) setTimeout(() => showToast(`Unlocked: ${unlocked.join(", ")}`, "unlock"), 450);
  }
  return { state: s, beforeLevel, afterLevel, unlocked };
}
window.awardProgress = awardProgress;

function isFeatureUnlocked(href, s = getState()) {
  const file = (href || "").split("?")[0].split("#")[0].split("/").pop();
  const gate = FEATURE_UNLOCKS[file];
  if (!gate) return true;
  return getLevelInfo(s.xp).level >= gate.level;
}

function updateDashboard() {
  const s = getState();
  const level = getLevelInfo(s.xp);
  const next = getNextLevelInfo(s.xp);
  const progress = levelProgress(s.xp);
  const values = {
    "progress-text": next ? `${s.xp} XP · ${next.minXp - s.xp} XP to Level ${next.level}` : `${s.xp} XP · Max level reached`,
    "progress-percent": `${progress}%`,
    "streak-count": s.streak,
    "coin-count": s.coins,
    "current-path-name": level.name,
    "current-level-pill": `Level ${level.level}`,
    "current-path-description": level.description
  };
  for (const [id, val] of Object.entries(values)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = `${progress}%`;

  document.querySelectorAll("[data-level-card]").forEach(card => {
    const target = Number(card.dataset.levelCard);
    const status = card.querySelector("[data-level-status]");
    const bar = card.querySelector("[data-level-bar]");
    card.classList.toggle("level-locked", target > level.level);
    card.classList.toggle("level-current", target === level.level);
    card.classList.toggle("level-complete", target < level.level);
    if (target < level.level) {
      if (bar) bar.style.width = "100%";
      if (status) status.textContent = "Completed ✓";
    } else if (target === level.level) {
      if (bar) bar.style.width = `${progress}%`;
      if (status) status.textContent = `${progress}% to next level`;
    } else {
      if (bar) bar.style.width = "0%";
      if (status) status.textContent = `🔒 Unlock at Level ${target}`;
    }
  });
}

function setupReward() {
  const b = document.getElementById("claim-reward");
  if (!b) return;
  const s = getState();
  const today = localDateKey();
  if (s.lastRewardDate === today) {
    b.textContent = "Claimed ✓";
    b.disabled = true;
    return;
  }
  b.addEventListener("click", () => {
    const x = getState();
    x.coins += 15;
    x.lastRewardDate = today;
    saveState(x);
    b.textContent = "+15 claimed ✓";
    b.disabled = true;
    updateDashboard();
    showToast("Daily reward: +15 MindCoins");
  });
}

function setupFeatureLocks() {
  const s = getState();
  const currentLevel = getLevelInfo(s.xp).level;
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute("href");
    const file = (href || "").split("?")[0].split("#")[0].split("/").pop();
    const gate = FEATURE_UNLOCKS[file];
    if (!gate || currentLevel >= gate.level) return;
    a.classList.add("locked-link");
    a.setAttribute("aria-disabled", "true");
    a.dataset.lockLevel = gate.level;
    a.title = `Unlocks at Level ${gate.level}`;
    a.addEventListener("click", e => {
      e.preventDefault();
      showToast(`${gate.label} unlocks at Level ${gate.level}. Keep learning to earn XP.`, "locked");
    });
  });
}

function enforceCurrentPageUnlock() {
  const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (current === "index.html") return;
  const gate = FEATURE_UNLOCKS[current];
  if (!gate) return;
  const level = getLevelInfo().level;
  if (level < gate.level) {
    window.location.replace(`index.html?locked=${encodeURIComponent(gate.label)}&level=${gate.level}`);
  }
}

function showLockedQueryMessage() {
  const params = new URLSearchParams(location.search);
  if (!params.get("locked")) return;
  setTimeout(() => showToast(`${params.get("locked")} unlocks at Level ${params.get("level")}.`, "locked"), 100);
  history.replaceState({}, "", "index.html");
}

function setupSidebar(){const menu=document.getElementById("menu-btn"),side=document.getElementById("sidebar"),close=document.getElementById("sidebar-close"),overlay=document.getElementById("sidebar-overlay");if(!menu||!side)return;menu.style.pointerEvents="auto";menu.style.cursor="pointer";const open=e=>{e?.preventDefault();e?.stopPropagation();side.classList.add("open");overlay?.classList.add("show");document.body.classList.add("menu-open")};const shut=e=>{e?.preventDefault();side.classList.remove("open");overlay?.classList.remove("show");document.body.classList.remove("menu-open")};menu.addEventListener("click",open);close?.addEventListener("click",shut);overlay?.addEventListener("click",shut);document.addEventListener("keydown",e=>{if(e.key==="Escape")shut()})}

function setupBackNavigation() {
  const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (current === "index.html" || current === "") return;
  const shell = document.querySelector("main.shell");
  if (!shell || shell.querySelector(".page-back-row")) return;
  const row = document.createElement("div");
  row.className = "page-back-row";
  row.innerHTML = `<button class="back-button" type="button" aria-label="Go back"><span aria-hidden="true">←</span><span>Back</span></button>`;
  row.querySelector(".back-button").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "index.html";
  });
  shell.prepend(row);
}

document.addEventListener("DOMContentLoaded", () => {
  recordVisit((window.location.pathname.split("/").pop() || "index.html").toLowerCase());
  enforceCurrentPageUnlock();
  updateStreakOnVisit();
  updateDashboard();
  setupReward();
  setupSidebar();
  setupBackNavigation();
  setupFeatureLocks();
  showLockedQueryMessage();
});


/* MarketMind v1.2 — rewards, contracts and help economy */
const FINANCE_FACTS = [
  "A company can report positive Net Income while generating negative Operating Cash Flow.",
  "A higher Revenue Growth rate does not automatically mean a company is creating economic value.",
  "ROIC above WACC generally suggests that a company is creating economic value on invested capital.",
  "A DCF valuation can change materially when WACC or the Terminal Growth Rate changes slightly.",
  "Accounts Receivable can rise even when the related cash has not yet been collected.",
  "A share buyback can destroy value if a company repurchases shares well above intrinsic value.",
  "Operating leverage can amplify both profit growth and profit declines.",
  "Free Cash Flow is not the same as Net Income because accounting profit and cash generation differ.",
  "A high ROE can sometimes be boosted by leverage or share buybacks rather than better operations.",
  "Terminal Value often represents a large part of a DCF, which is why its assumptions deserve close scrutiny."
];

function spendMindCoins(cost, reason = "Purchase") {
  const s = getState();
  cost = Math.max(0, Number(cost) || 0);
  if (s.coins < cost) {
    showToast(`Not enough MindCoins. ${reason} costs ${cost}.`, "locked");
    return false;
  }
  s.coins -= cost;
  saveState(s);
  updateDashboard();
  showToast(`${reason}: -${cost} MindCoins`);
  return true;
}
window.spendMindCoins = spendMindCoins;

function randomFinanceFact() {
  return FINANCE_FACTS[Math.floor(Math.random() * FINANCE_FACTS.length)];
}
window.randomFinanceFact = randomFinanceFact;

function signFinanceContract({title="Finance Learning Contract", rewardXp=0, rewardCoins=0, activity="Contract reward"} = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "contract-overlay show";
    overlay.innerHTML = `
      <div class="contract-card">
        <div class="contract-seal">MM</div>
        <p class="eyebrow">MARKETMIND FINANCE CONTRACT</p>
        <h2>${title}</h2>
        <p class="contract-copy">I confirm that I completed this exercise honestly, reviewed the concepts I did not know, and understand that the goal is to improve my reasoning rather than only collect rewards.</p>
        <div class="contract-terms">
          <span>✓ Review unfamiliar concepts</span>
          <span>✓ Use hints before full answers when possible</span>
          <span>✓ Keep facts and hypotheses separate</span>
        </div>
        <label class="contract-sign-label">Sign your learning contract</label>
        <input id="contract-signature" class="contract-signature" placeholder="Type your name or initials">
        <label class="contract-check"><input id="contract-agree" type="checkbox"> I agree to the learning contract.</label>
        <button id="contract-claim" class="btn primary" disabled>Sign & claim reward</button>
        <button id="contract-cancel" class="btn ghost">Not yet</button>
      </div>`;

    document.body.appendChild(overlay);
    const sig = overlay.querySelector("#contract-signature");
    const agree = overlay.querySelector("#contract-agree");
    const claim = overlay.querySelector("#contract-claim");
    const update = () => claim.disabled = !(sig.value.trim() && agree.checked);
    sig.addEventListener("input", update);
    agree.addEventListener("change", update);

    overlay.querySelector("#contract-cancel").onclick = () => {
      overlay.remove();
      resolve(false);
    };
    claim.onclick = () => {
      const signer = sig.value.trim();
      awardProgress({xp:rewardXp, coins:rewardCoins, activity});
      const s = getState();
      s.lastContractSignature = signer;
      s.contractsSigned = (s.contractsSigned || 0) + 1;
      saveState(s);
      const fact = randomFinanceFact();
      overlay.querySelector(".contract-card").innerHTML = `
        <div class="contract-seal signed">✓</div>
        <p class="eyebrow">CONTRACT SIGNED</p>
        <h2>Reward unlocked</h2>
        <div class="contract-reward">
          <strong>+${rewardXp} XP</strong>
          <strong>+${rewardCoins} MindCoins</strong>
        </div>
        <div class="finance-fact"><small>FINANCE FACT</small><p>${fact}</p></div>
        <button id="contract-done" class="btn primary">Continue</button>`;
      overlay.querySelector("#contract-done").onclick = () => {
        overlay.remove();
        resolve(true);
      };
    };
  });
}
window.signFinanceContract = signFinanceContract;

function restoreLegacyProgress(){const s=getState();s.xp=Math.max(s.xp,2100);s.masteredConcepts=Math.max(s.masteredConcepts,36);s.totalConcepts=Math.max(s.totalConcepts,145);s.coins=Math.max(s.coins,145);s.streak=1;s.lastActiveDate=localDateKey();saveState(s);updateDashboard();showToast("Progress repaired: legacy MarketMind baseline restored.","level");return s} window.restoreLegacyProgress=restoreLegacyProgress;
