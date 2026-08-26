const MARKETMIND_STATE_KEY = "marketmind-state";

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
  "simulator.html": { level: 5, label: "Market Simulator" },
  "asset-analysis.html": { level: 6, label: "Full Asset Analysis" },
  "leverage.html": { level: 7, label: "Leverage Lab" },
  "news.html": { level: 8, label: "Market News Challenges" }
};

const DEFAULT_STATE = {
  version: 3,
  xp: 0,
  masteredConcepts: 0,
  totalConcepts: 120,
  streak: 0,
  coins: 50,
  lastActiveDate: null,
  lastRewardDate: null,
  lessonCompletions: 0,
  quizCompletions: 0,
  analystCasesCompleted: 0,
  simulatorCash: 10000,
  holdings: {},
  transactions: [],
  unlockHistory: []
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
  const s = { ...DEFAULT_STATE, ...(raw || {}) };
  // Legacy versions displayed 36 mastered concepts and 145 coins without a real XP system.
  // Give existing users enough XP to keep access to the features they already had.
  if ((raw?.xp === undefined || raw?.version === undefined) && Number(raw?.masteredConcepts || 0) >= 30) {
    s.xp = 2100;
    s.masteredConcepts = Number(raw.masteredConcepts || 36);
    s.coins = Math.max(Number(raw.coins || 0), 145);
  }
  s.version = 3;
  return s;
}

function getState() {
  try {
    const raw = JSON.parse(localStorage.getItem(MARKETMIND_STATE_KEY) || "null");
    return migrateState(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(s) {
  localStorage.setItem(MARKETMIND_STATE_KEY, JSON.stringify({ ...s, version: 3 }));
}

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

function updateStreakOnVisit() {
  const s = getState();
  const today = localDateKey();
  if (!s.lastActiveDate) {
    s.streak = 1;
    s.lastActiveDate = today;
    saveState(s);
    return s;
  }
  const gap = daysBetweenDateKeys(s.lastActiveDate, today);
  if (gap === 1) s.streak += 1;
  else if (gap > 1) s.streak = 0; // User requested a missed day to reset the streak to zero.
  if (gap !== 0) s.lastActiveDate = today;
  saveState(s);
  return s;
}

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

function setupSidebar() {
  const menu = document.getElementById("menu-btn");
  const side = document.getElementById("sidebar");
  const close = document.getElementById("sidebar-close");
  const overlay = document.getElementById("sidebar-overlay");
  if (!menu || !side) return;
  const openMenu = () => { side.classList.add("open"); overlay?.classList.add("show"); document.body.classList.add("menu-open"); };
  const closeMenu = () => { side.classList.remove("open"); overlay?.classList.remove("show"); document.body.classList.remove("menu-open"); };
  menu.onclick = openMenu;
  if (close) close.onclick = closeMenu;
  if (overlay) overlay.onclick = closeMenu;
  side.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { if (!a.classList.contains("locked-link")) closeMenu(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
}

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
