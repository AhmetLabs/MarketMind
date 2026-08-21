
const K = "mm-pfs";

const load = () => {
  try { return JSON.parse(localStorage.getItem(K) || "[]"); }
  catch { return []; }
};

const save = (items) => localStorage.setItem(K, JSON.stringify(items));

function showPortfolioMessage(message) {
  const box = document.getElementById("pf-global-msg");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
  clearTimeout(window.__pfToastTimer);
  window.__pfToastTimer = setTimeout(() => box.classList.add("hidden"), 2800);
}

function render() {
  const box = document.getElementById("pf-list");
  const items = load();

  box.innerHTML = items.length ? "" : '<p class="muted">No portfolios yet.</p>';

  items.forEach((p, i) => {
    if (p.start == null) p.start = p.capital;
    if (!p.holdings) p.holdings = {};
    if (!p.transactions) p.transactions = [];

    const positions = Object.values(p.holdings).filter(v => Number(v) > 0).length;

    box.insertAdjacentHTML("beforeend", `
      <div class="portfolio-row">
        <div>
          <strong>${p.name}</strong>
          <small>€${Number(p.capital).toLocaleString()} · ${p.style || "Balanced"} · ${positions} positions</small>
        </div>
        <div class="portfolio-row-actions">
          <button class="btn ghost" onclick="resetPF(${i})">Reset</button>
          <button class="btn ghost danger-outline" onclick="deletePF(${i})">Delete</button>
        </div>
      </div>
    `);
  });

  save(items);
}

function resetPF(i) {
  const items = load();
  const p = items[i];
  if (!p) return;

  const ok = confirm(`Reset "${p.name}"? This clears its positions and restores the starting capital.`);
  if (!ok) return;

  p.capital = p.start ?? p.capital;
  p.holdings = {};
  p.transactions = [];
  p.totalReturn = 0;
  p.realizedPnL = 0;

  save(items);
  render();
  showPortfolioMessage(`"${p.name}" has been reset to €${Number(p.capital).toLocaleString()}.`);
}

function deletePF(i) {
  const items = load();
  const p = items[i];
  if (!p) return;

  const ok = confirm(`Delete "${p.name}"?`);
  if (!ok) return;

  items.splice(i, 1);
  save(items);
  render();
  showPortfolioMessage("Portfolio deleted.");
}

document.getElementById("pf-create").onclick = () => {
  const c = Number(document.getElementById("pf-capital").value);

  if (c < 1000 || c > 1e9) {
    document.getElementById("pf-msg").textContent = "Choose €1,000 to €1B";
    return;
  }

  const items = load();
  const name = document.getElementById("pf-name").value.trim() || "New Portfolio";

  items.push({
    name,
    capital: c,
    start: c,
    style: document.getElementById("pf-style").value,
    holdings: {},
    transactions: [],
    totalReturn: 0,
    realizedPnL: 0
  });

  save(items);
  document.getElementById("pf-msg").textContent = "Portfolio created ✓";
  render();
};

render();
