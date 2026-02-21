# Quant Risk Snapshot

A small, self-contained portfolio risk analytics web app built with **Next.js 14 (App Router) + TypeScript + Recharts**.

Enter a portfolio (tickers + shares or weights), pull daily price history from Yahoo Finance (no API key needed), and get a professional risk report with optional rebalancing. Saved portfolios are **private per user**: sign in with username/password (built-in), and optionally with GitHub/Google if configured.

---

## Assignment alignment

This project was built to satisfy a backend-focused assignment (server-side logic, deployment, frontend integration, documentation). Here’s how it maps:

- **Backend** — Implemented as Next.js API routes (App Router). The backend:
  - **Accepts data and returns meaningful responses**: portfolio CRUD, snapshot creation, price fetching, alert rules; all return JSON.
  - **Uses server-side logic**: authentication (NextAuth + GitHub), snapshot computation (returns, vol, drawdown, VaR, etc.), secure price fetching (no keys in the frontend), and persistence (PostgreSQL via Prisma).
  - **Stores secrets in the environment**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET` are read from env only; no secrets in the repo or frontend.
  - **Returns JSON** (or CSV for export) for the frontend to consume.
- **Deployment** — Deployed to **Vercel** (not Render). The app gets a public URL (e.g. `https://quant-risk-snapshot.vercel.app`). Database is hosted PostgreSQL (e.g. Neon); migrations run on deploy.
- **Frontend** — Next.js pages use `fetch()` to call the backend, render results (tables, charts, forms), and handle errors (e.g. 401 redirect to sign-in, 4xx/5xx messages).
- **Documentation** — This README describes what the backend does, how to run locally, how the frontend calls it, and where secrets live.

---

## Privacy & authentication

- **Portfolios are private.** Each portfolio is stored with a `userId` (your GitHub id). The API only lists, returns, updates, or deletes portfolios that belong to the currently signed-in user. No one else can see or change your portfolios.
- **Sign in is required** to use the Portfolios feature (`/portfolios`, `/portfolios/new`, `/portfolios/[id]`, `/snapshots/[snapshotId]`). Username/password is always available; GitHub/Google are optional providers. Unauthenticated requests to those APIs return 401; the UI redirects to a sign-in page and back after auth.
- The rest of the app (Input, Report, Rebalance) does not require sign-in and does not store user-specific data.

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

**All of these require an authenticated session (sign in with GitHub).** Responses are scoped to the signed-in user’s portfolios only.

#### Portfolios
- `POST /api/portfolios` create a portfolio with holdings/defaults (owned by current user)
- `GET /api/portfolios` list the current user’s portfolios with derived summary fields
- `GET /api/portfolios/:id` get detail, holdings, defaults, latest snapshot (404 if not owner)
- `PATCH /api/portfolios/:id` update name/defaults/holdings (404 if not owner)
- `DELETE /api/portfolios/:id` delete portfolio (404 if not owner; cascade deletes related records)

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

**→ Step-by-step instructions:** See **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** for what you need to do (`.env` values, Vercel env vars, optional OAuth setup). The sections below repeat the same in more detail.

### Local development

1. **Database** — The app uses **PostgreSQL** (required for Vercel; SQLite is not supported in serverless). Use a free [Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/storage/postgres) database, or local Postgres.

2. **Environment & secrets** — Create `.env` in the project root (do not commit this file). All secrets are read from the environment:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
   NEXTAUTH_SECRET="a-random-string-at-least-32-chars"
   NEXTAUTH_URL="http://localhost:3000"
   GITHUB_ID="your-github-oauth-app-client-id"
   GITHUB_SECRET="your-github-oauth-app-client-secret"
   ```
   - `DATABASE_URL`: from your Neon/Vercel Postgres dashboard.
   - `NEXTAUTH_SECRET`: generate with `openssl rand -base64 32` or similar.
   - `NEXTAUTH_URL`: use `http://localhost:3000` locally.
   - GitHub OAuth: create a [GitHub OAuth App](https://github.com/settings/developers) (Authorization callback URL e.g. `http://localhost:3000/api/auth/callback/github` for local).

3. **Install and migrate**:
   ```bash
   npm install
   npm run prisma:migrate
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Use “Sign in” to access Portfolios.

### Deploy to Vercel

1. In the Vercel project, add **Environment Variables**:
   - `DATABASE_URL` — Postgres connection string (Neon or Vercel Postgres).
   - `NEXTAUTH_SECRET` — A strong random string (e.g. from `openssl rand -base64 32`).
   - `NEXTAUTH_URL` — Your production URL, e.g. `https://quant-risk-snapshot.vercel.app`.
   - `GITHUB_ID` and `GITHUB_SECRET` — Optional, for GitHub login.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — Optional, for Google login.
2. Redeploy. The build runs `prisma generate` and `next build` (no DB migration during build).
3. Run migrations separately when needed:
   ```bash
   npm run prisma:migrate:deploy
   ```
4. The `/portfolios` page will work once `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set. Users sign in with username/password (or optional OAuth providers) and see only their own portfolios.

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
  api/auth/[...nextauth]/route.ts  # NextAuth session providers
  api/auth/signup/route.ts         # Username/password sign-up endpoint
  api/prices/route.ts        # Server-side price API
  api/portfolios/...         # Portfolio monitor APIs (auth required, scoped by user)
prisma/
  schema.prisma              # PostgreSQL schema for portfolios/snapshots/alerts
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
  auth.ts                    # NextAuth config and getSession()
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
