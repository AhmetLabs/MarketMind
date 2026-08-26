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
