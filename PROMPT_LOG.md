# PROMPT_LOG

## Project: Portfolio Detective + Quant Extensions

## Major prompts used

1. **"Implement Portfolio Detective with SEC ingestion and ranked likely drivers first, then add QP and backtesting."**
   - Result: built MVP-first flow with `Event`, `EventImpact`, `DetectiveReport`, `DetectiveReportItem`, and detective APIs/UI.

2. **"Use existing auth + ownership patterns; keep all new APIs user-scoped and return 404 for non-owners."**
   - Result: every new route mirrors existing snapshot/portfolio ownership checks.

3. **"Replace clipping heuristic with a real constrained QP solver."**
   - Result: added `lib/qp.ts` using `quadprog-js` and routed min-variance through QP constraints (`sum=1`, `w>=0`, optional `maxWeight`).

4. **"Add periodic rebalancing backtests with transaction costs and persisted reports."**
   - Result: added `BacktestRun` model + `lib/backtest.ts`, run/list/detail APIs, and `/backtests/[backtestId]` page.

## Design decisions and what changed

- **MVP rule-based detective scoring first** (`recency + |post1dAbRet| + contribution + eventTypeWeight`) to guarantee deterministic end-to-end behavior before ML.
- **SEC-first event ingestion** with descriptive `User-Agent`, retries, and pacing to keep ingestion robust without paid APIs.
- **Portfolio-scoped events** (`portfolioId` on `Event`) to simplify privacy and ownership checks in this assignment context.
- **JSON payload persistence** (`summaryJson`, `metricsJson`, `seriesJson`, `weightsJson`) to ship quickly while preserving room for stricter typed columns later.
- **Minimal frontend churn** by extending existing `/portfolios/[id]` runner/list patterns instead of introducing a new data layer.

## Implementation notes learned

- Reusing aligned price infrastructure (`lib/marketData.ts`) reduced duplicate bugs in detective and backtest computations.
- Keeping API response structures close to existing snapshot payloads made client integration much faster.
- Running `prisma generate` and `tsc --noEmit` after each large phase helped catch path/type issues early.

## Follow-up backlog

- Add Fama-French factor exposure module (data ingestion + regression UI/API).
- Extend alerts/watchlist with event/intraday/factor triggers and optional scheduling.
- Add intraday data fetch + intraday move analytics.
- Add export routes for detective/backtests and optional ML training/scoring pipeline.
# Prompt Log

A record of the key AI prompts used during development of the Quant Risk Snapshot app. All prompts were given to Claude (via Cursor IDE). Outputs were reviewed, tested, and edited by me.

---

## 1. Initial project plan

**Prompt (paraphrased):**
> Implement the following to-dos from the plan: (1) Update prices API to Alpha Vantage + cache/normalize, (2) Add lib math utilities + shared types, (3) Replace input page with portfolio form, (4) Add report page with charts + exports.

**What the AI did:**
- Rewrote `app/api/prices/route.ts` to call Alpha Vantage with caching and date alignment
- Created `lib/math.ts` with functions for returns, volatility, drawdown, beta, covariance, correlation, VaR/CVaR, risk contributions
- Created `lib/types.ts` with shared TypeScript types
- Created `app/page.tsx` as a portfolio input form (weights/shares mode, range, benchmark, shrinkage)
- Created `app/report/page.tsx` with metric cards, Recharts line/bar charts, and JSON/CSV export
- Created reusable components: `MetricCard`, `LineChartCard`, `BarChartCard`

**What I reviewed/changed:** Verified the math functions produce correct outputs against known test cases. Tested locally with AAPL + MSFT portfolios.

---

## 2. Gap analysis and completion

**Prompt (paraphrased):**
> Have you completed everything in the full project plan? (Pasted the complete 12-section project spec including rebalancer, all metrics, correlation heatmap, etc.)

**What the AI did:**
- Identified missing items: Total Return, CAGR, Sharpe ratio, Effective N, equity indexed to 100, correlation heatmap (was a plain table), rebalancer page, retries, README
- Created `app/layout.tsx` (root layout with nav)
- Added `totalReturn`, `cagr`, `sharpeRatio`, `effectiveN` to `lib/math.ts`
- Extracted `lib/marketData.ts` from the route (fetch, cache, alignment, retries with exponential backoff)
- Created `lib/rebalance.ts` (min-variance via matrix inverse + clipping, risk parity iterative, turnover blending, trades computation)
- Created `components/CorrHeatmap.tsx` (color-coded red/white/blue heatmap)
- Created `app/rebalance/page.tsx` (objective selector, gamma slider, max weight, trades table, CSV export)
- Wrote `README.md` with methodology, API docs, limitations

---

## 3. API provider switch (Alpha Vantage -> Finnhub -> Yahoo Finance)

**Prompt (paraphrased):**
> Alpha Vantage says "premium endpoint" and rate limits are too strict. Find something free instead.

**What the AI did:**
- First switched to Finnhub (had issues with API key authentication)
- Then switched to Yahoo Finance (no API key required at all)
- Rewrote `lib/marketData.ts` to call Yahoo Finance v8 chart API
- Updated `.env.local`, `route.ts`, and `README.md` accordingly

**Why Yahoo Finance:** Free, no API key needed, provides adjusted close prices, JSON format, sufficient rate limits for a portfolio app.

---

## 4. UI redesign with Tailwind CSS

**Prompt (paraphrased):**
> Redesign the UI to look modern and clean like a professional dashboard. Use Tailwind CSS and lucide-react icons.

**What the AI did:**
- Created `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`
- Created `lib/utils.ts` with `cn()` utility (clsx + tailwind-merge)
- Created `components/SiteHeader.tsx` (sticky nav with active route highlighting)
- Redesigned all three pages with card-based layouts, responsive grids, skeleton loading states, and clean typography
- Added color-coded trade indicators (green = buy, red = sell) on the rebalance page

---

## 5. Adding beginner-friendly documentation

**Prompt (paraphrased):**
> Add detailed instructions on how to navigate the page and what everything means, for someone with no finance knowledge.

**What the AI did:**
- Added step-by-step "How to use this page" guide on the input page
- Added collapsible "How to read this report" guide on the report page explaining every metric and chart
- Added collapsible "What is rebalancing?" guide on the rebalance page explaining strategies
- Added subtitle descriptions to every metric card (e.g., "Sharpe: return per unit of risk. Above 1.0 is good.")
- Added section descriptions before every chart group
- Added a "Popular tickers to try" reference card with stocks organized by category
- Added a "Quick glossary" defining Ticker, Weight, Benchmark, Risk-free rate

---

## 6. Deployment and portfolio integration

**Prompt (paraphrased):**
> I want to add this to a new GitHub repo and showcase it on my portfolio website.

**What the AI did:**
- Created `.gitignore`, initialized git, made initial commit
- Created public GitHub repo `linbo271828-cell/quant-risk-snapshot` and pushed
- Added a project card to `github.io/index.html` in the projects section
- Added TypeScript and Next.js to the skills pill grid
- Committed and pushed portfolio site changes

---

## Tools used

- **Claude** (via Cursor IDE) — code generation, architecture, debugging, documentation
- **Cursor IDE** — editor with integrated AI agent mode
- **Next.js 14** — React framework with server-side API routes
- **Recharts** — charting library
- **Tailwind CSS** — utility-first CSS framework
- **Yahoo Finance API** — market data (free, no key)
