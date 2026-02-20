# Quant Risk Snapshot

A small, self-contained portfolio risk analytics web app built with **Next.js 14 (App Router) + TypeScript + Recharts**.

Enter a portfolio (tickers + shares or weights), pull daily price history from Yahoo Finance (no API key needed), and get a professional risk report with optional rebalancing.

---

## Pages

| Route | Description |
|---|---|
| `/` | Portfolio input form (tickers, weights/shares, range, benchmark, shrinkage) |
| `/report` | Risk snapshot dashboard with charts and exports |
| `/rebalance` | Min-variance or risk-parity rebalancer with turnover slider |
| `/portfolios` | Persistent portfolio monitor list (database-backed) |
| `/portfolios/new` | Create saved portfolio with defaults |
| `/portfolios/[id]` | Portfolio detail, run snapshot, history, alerts |
| `/snapshots/[snapshotId]` | Snapshot report loaded from database |

---

## API

### `GET /api/prices`

Server-side route that fetches daily adjusted close prices from Yahoo Finance (free, no key), caches them, and aligns dates.

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `tickers` | string | (required) | Comma-separated tickers, e.g. `AAPL,MSFT,SPY` |
| `range` | string | `1y` | One of `3m`, `6m`, `1y`, `3y` |

**Response**

```json
{
  "range": "1y",
  "start": "2025-02-07",
  "end": "2026-02-07",
  "dates": ["2025-02-07", "2025-02-10", "..."],
  "pricesByTicker": {
    "AAPL": [185.23, 186.01, "..."],
    "MSFT": [410.50, 411.20, "..."]
  },
  "errors": { "BAD": "Invalid symbol BAD: ..." }
}
```

- The `errors` field is only present when some tickers failed (partial success).
- All market data requests are server-side to keep the API key hidden.
- In-memory cache with 6-hour TTL per `ticker:start:end` key.
- Exponential backoff (up to 3 retries) on rate-limit / transient errors.
- Uses Yahoo Finance (no API key required, adjusted close available).

### Portfolio Monitor APIs

#### Portfolios
- `POST /api/portfolios` create a portfolio with holdings/defaults
- `GET /api/portfolios` list all portfolios with derived summary fields
- `GET /api/portfolios/:id` get detail, holdings, defaults, latest snapshot
- `PATCH /api/portfolios/:id` update name/defaults/holdings
- `DELETE /api/portfolios/:id` delete portfolio (cascade delete related records)

#### Snapshots
- `POST /api/portfolios/:id/snapshots` run server-side snapshot and persist results
- `GET /api/portfolios/:id/snapshots` list snapshot history
- `GET /api/snapshots/:snapshotId` full snapshot detail payload
- `GET /api/snapshots/:snapshotId/export?fmt=json|csv` export endpoint

#### Alerts (bonus)
- `POST /api/portfolios/:id/alerts` create alert rule (`vol_gt`, `maxdd_lt`, `var_gt`)
- `GET /api/portfolios/:id/alerts` list alert rules
- `POST /api/portfolios/:id/alerts/check` evaluate rules against latest snapshot

---

## Risk Metrics — Methodology

### Returns

Daily simple returns: `r_i[t] = P_i[t] / P_i[t-1] - 1`

Portfolio returns: `r_p[t] = sum(w_i * r_i[t])` with weights fixed at last-day values.

### Performance

| Metric | Formula |
|---|---|
| Total Return | `prod(1 + r_p[t]) - 1` |
| CAGR | `(1 + totalReturn)^(252/n) - 1` |
| Annualized Vol | `std(r_p) * sqrt(252)` |
| Sharpe | `(mean(r_p)*252 - rf) / vol` |
| Max Drawdown | `max(1 - E[t]/peak[t])` where `E` is equity curve |

### Beta

`beta = Cov(r_p, r_b) / Var(r_b)` using the selected benchmark.

### Covariance / Correlation

Sample covariance matrix with optional shrinkage:

`covShrink[i][j] = (1-lambda) * cov[i][j]` for off-diagonal entries (diagonal unchanged).

### VaR / CVaR (Historical)

- **VaR 95%** = negated 5th percentile of daily returns
- **CVaR 95%** = negated mean of returns at or below VaR

### Concentration

- **HHI** = `sum(w_i^2)`
- **Effective N** = `1 / HHI`

### Risk Contributions

Marginal contribution: `m = (Sigma * w) / sigma_p`

Risk contribution: `RC_i = w_i * m_i`

Percent: `RC_i / sigma_p` (displayed as bar chart)

---

## Rebalancer

### Min-Variance (Long-Only)

Unconstrained solution: `w* proportional to Sigma^{-1} * 1`, normalized.

Long-only enforced via clipping negative weights to 0 and renormalizing (heuristic; a proper QP solver would be the next step).

### Risk Parity (Iterative)

Target: equal risk contributions across all assets.

Algorithm (200 iterations):
1. Initialize `w = equal weights`
2. Compute `RC_i`
3. Update `w_i = w_i * (targetRC / RC_i)^eta` with `eta = 0.5`
4. Clamp and normalize

### Turnover Control

`wFinal = (1 - gamma) * wCurrent + gamma * wTarget`

Gamma slider ranges from 0 (keep current) to 1 (full rebalance).

### Trades (shares mode only)

- `totalValue = sum(q_i * P_i_last)`
- `targetShares_i = floor(totalValue * wFinal_i / P_i_last)`
- `tradeShares = targetShares - currentShares`
- Cash leftover shown

---

## Limitations

- **Daily bars only** — no intraday data
- **Survivorship bias** — only currently listed tickers
- **Static weights** — portfolio returns use last-day weights, not daily rebalanced
- **No slippage/transaction cost model** (turnover is informational only)
- **Covariance instability** — sample covariance can be noisy for small windows; shrinkage toggle helps
- **Corporate actions** — uses Yahoo Finance adjusted close (accounts for splits/dividends)
- **Rate limits** — Yahoo Finance is unofficial; caching and retries handle transient issues
- **Min-variance heuristic** — clipping negatives is approximate; a QP solver would be more accurate

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run DB migrations (creates prisma/dev.db)
npm run prisma:migrate -- --name init

# 3. Run development server (no API key needed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  page.tsx                   # Input form
  report/page.tsx            # Risk dashboard
  rebalance/page.tsx         # Rebalancer
  portfolios/page.tsx        # Portfolio monitor list
  portfolios/new/page.tsx    # Portfolio creation page
  portfolios/[id]/page.tsx   # Portfolio detail + snapshot runner
  snapshots/[snapshotId]/page.tsx # Stored snapshot report
  layout.tsx                 # Root layout with nav
  api/prices/route.ts        # Server-side price API
  api/portfolios/...         # Portfolio monitor APIs
prisma/
  schema.prisma              # SQLite schema for portfolios/snapshots/alerts
components/
  MetricCard.tsx             # Metric display card
  LineChartCard.tsx          # Recharts line chart wrapper
  BarChartCard.tsx           # Recharts bar chart wrapper
  CorrHeatmap.tsx            # Color-coded correlation heatmap
lib/
  math.ts                   # Returns, vol, drawdown, beta, cov, VaR/CVaR, RC
  marketData.ts              # Yahoo Finance fetch, cache, alignment
  snapshot.ts                # Server-side snapshot computation engine
  rebalance.ts               # Min-var, risk parity, turnover, trades
  db.ts                      # Prisma client singleton
  types.ts                   # Shared TypeScript types
```

---

## Future Work

- Factor model exposures (Fama-French)
- Proper QP solver for constrained optimization
- Live alerts / watchlist
- Intraday data support
- Portfolio backtesting with periodic rebalancing
- Persistent storage (database) for saved portfolios
