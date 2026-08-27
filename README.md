# MarketMind v1.0 Prototype

Core loop: Learn → Test → Analyze → Invest → Review.

Includes lessons, dictionary, quizzes, Analyst Lab, multiple virtual portfolios, historical fictional simulator, leverage education, and simulated market news.

Not production-ready: no backend authentication, live market data, real trading, real payments, or broker connection.


## v1.0.1 fixes
- Fixed simulator sidebar/card overlap while scrolling
- Cleaned malformed simulator button markup
- Leverage card now stays visually separate from Buy/Sell controls
- Portfolio Reset now clears positions/transactions and restores starting capital
- Added reset confirmation and success message
- Added Delete portfolio action
- Added Back arrow/button on secondary pages

## v1.0.2 final fixes
- Restored the previous dashboard design
- Restored and standardized the hamburger menu beside MarketMind
- Hamburger now opens the full left navigation on every page
- Menu contains Profile, Dashboard, Lessons, Dictionary, Quiz, Analyst Lab, Simulator, Portfolios, Leverage Lab, News, Settings and Upgrade
- Keeps all v1.0.1 simulator, reset and back-navigation fixes

## v1.1 — Progression Engine
- Real XP-based levels and current path
- Feature unlocks tied to level progression
- Streak updates from real calendar visits and resets to 0 after a missed day
- MindCoins persist and update from lessons, quizzes and daily rewards
- Profile page now shows level, XP, streak, coins, activity and feature unlocks
- Existing users are migrated so already-used features are not suddenly lost

Planned next: v1.2 lesson review flow + fictional finance contract + reward claim + finance fact + hint economy.


## MarketMind v1.2 — Lesson Completion & Reward Economy
- Unfamiliar lesson concepts are collected and repeated in a dedicated review round
- Lessons only reach the reward stage after review is completed
- Finance learning contract must be signed before XP/MindCoin rewards are claimed
- Every signed contract reveals a random finance fact
- MindCoins now have a real use:
  - lesson hint: 3 coins
  - lesson full explanation: 10 coins
  - quiz hint: 4 coins
  - quiz full answer: 14 coins
- Multiple quiz hints can be purchased when available
- Missed quiz concepts are shown again at completion
- Quiz rewards are also gated behind the finance contract
- Contract signatures and quiz/lesson completion metadata are persisted in localStorage


## MarketMind v1.3 — Realistic Simulator Core
- New broker-style simulator UI with persistent fictional market prices
- Simulated market catches up after the site was closed/offline
  - 30 real minutes = 1 simulated market day in this prototype
  - offline catch-up is capped at 365 simulated days per return
- Interactive chart inspection
  - hover to inspect historical price/date
  - click to lock a chart point
- Cash account with:
  - portfolio value
  - cash
  - invested value
  - buying power
  - realized P/L
  - unrealized P/L
- Real average-cost position accounting
- Market orders
- Limit orders that remain open and can auto-fill during offline market progression
- Open-order cancellation
- Order review/confirmation screen
- Transaction history
- Tradability rule: the World Index is a benchmark and cannot be bought directly; ETFs/funds can
- Leverage remains intentionally separate until the base cash-account order engine has been tested
- All prices/assets remain fictional and educational; no real brokerage or live market connection is included

## MarketMind v1.4 — Portfolio, Margin & Historical Training
- Fixed position accounting so Average Cost and Unrealized/Realized P&L update from actual fills
- Rebuilt limit-order logic:
  - marketable limits fill immediately at current simulated price
  - non-marketable limits stay open
  - buying power and owned quantity are validated
  - duplicate/open sell quantity is checked
- Simulator is now tied to the selected portfolio
  - each portfolio has an independent cash balance, positions, orders, P/L, replay state and margin state
  - reset/delete also clears that portfolio's simulator account
- Simplified margin account:
  - ~2× max gross exposure (50% initial margin)
  - 30% maintenance margin
  - 8% simulated annual loan interest
  - auto-repayment from sale proceeds
  - forced liquidation when maintenance falls below threshold
- Dividend events credit cash to held positions on simulated payment days
- Corporate actions:
  - demo AUR 2-for-1 split adjusts price history, position quantity, average cost and open limit orders
- Historical Replay:
  - choose a start date up to 720 days back
  - separate €10,000 replay account
  - future chart data hidden
  - advance one day at a time
  - replay orders use only data available at the replay date
- Important: margin/corporate-action rules are educational simplifications, not a replica of a specific real broker.

## MarketMind v1.5.1 — Calendar & Recovery Visibility Fix
- Performance Calendar is now accessible from Level 1
- Performance Calendar link is inserted into every sidebar
- Dashboard includes a direct Performance Calendar card
- Settings now visibly includes the Restore Legacy Progress Baseline panel
- Settings repair shows exactly what it restores
- Calendar explains that P/L history begins recording once the simulator is opened in this version

## MarketMind v1.5.2 — Simulator Merge/Stability Fix
- Rebuilt from the clean v1.5.1 source rather than from the locally merged simulator.
- Enforces one navigation, one Watchlist, one Events card and one Order Ticket.
- Repairs an accidentally zeroed empty simulator account back to its portfolio starting capital.
- Portfolio registry repairs invalid zero/missing starting capital to a safe starting value.
- Simulator startup verifies that portfolio and asset selectors were populated.
- Version label updated to v1.5.2.
- Includes CLEAN_INSTALL_v1_5_2.txt to avoid repeating the merge-duplication issue.


## v1.6.0A — Progression Core
- 30-level curriculum
- XP curve gets progressively harder
- Mastery states API (new / learning / familiar / mastered)
- Level gates combine XP, mastery, formula score, written score and checkpoint score
- Duolingo-style Learning Path scaffold with Lesson → Flashcards → Practice → Analysis → Review → Checkpoint
- Placement Assessment scaffold for Beginner 1 / Amateur 3 / Intermediate 6 / Advanced 12 / Expert 15
- Existing meaningful v1.5 progress migrates without a destructive reset

## v1.6.0A1 — Hamburger hotfix
- Hamburger navigation now uses delegated click handling independent of progression initialization.
- Close button, overlay click and Escape key all close the menu.
- Strengthened sidebar/menu z-index and pointer behavior.
