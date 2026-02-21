"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, HelpCircle, Info, Loader2, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HoldingsInput, HoldingsItem } from "../../lib/types";

const STORAGE_KEY = "quant-risk-input";

function parseHoldings(text: string): HoldingsItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[, \t]+/).filter(Boolean);
      const ticker = (parts[0] ?? "").toUpperCase();
      const value = Number.parseFloat(parts[1] ?? "");
      if (!/^[A-Z.\-]{1,12}$/.test(ticker) || !Number.isFinite(value)) return null;
      return { ticker, value };
    })
    .filter((x): x is HoldingsItem => Boolean(x));
}

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<HoldingsInput["mode"]>("weights");
  const [rawHoldings, setRawHoldings] = useState("AAPL, 0.5\nMSFT, 0.3\nGOOGL, 0.2");
  const [range, setRange] = useState("1y");
  const [benchmark, setBenchmark] = useState("SPY");
  const [riskFreeRate, setRiskFreeRate] = useState("0.02");
  const [shrinkageEnabled, setShrinkageEnabled] = useState(false);
  const [shrinkage, setShrinkage] = useState("0.1");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as HoldingsInput;
      setMode(parsed.mode);
      setRawHoldings(parsed.items.map((i) => `${i.ticker}, ${i.value}`).join("\n"));
      setRange(parsed.range);
      setBenchmark(parsed.benchmark ?? "");
      setRiskFreeRate(parsed.riskFreeRate != null ? String(parsed.riskFreeRate) : "0.02");
      setShrinkageEnabled(parsed.shrinkage != null);
      setShrinkage(parsed.shrinkage != null ? String(parsed.shrinkage) : "0.1");
    } catch {
      /* ignore */
    }
  }, []);

  const parsedHoldings = useMemo(() => parseHoldings(rawHoldings), [rawHoldings]);
  const isValid = parsedHoldings.length > 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValid) {
      setError("Add at least one valid ticker and value.");
      return;
    }
    const payload: HoldingsInput = {
      mode,
      items: parsedHoldings,
      range,
      benchmark: benchmark.trim() ? benchmark.trim().toUpperCase() : undefined,
      riskFreeRate: Number.parseFloat(riskFreeRate) || 0,
      shrinkage: shrinkageEnabled ? Number.parseFloat(shrinkage) || 0 : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSubmitting(true);
    router.push("/report");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Portfolio Input</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Tell us what stocks you own (or want to analyze), and we&apos;ll generate a detailed risk
          report showing how risky your portfolio is, how it has performed, and how your
          stocks relate to each other.
        </p>
        <span className="mt-3 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          Data source: Yahoo Finance (free, no API key needed)
        </span>
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ---- Left column: Portfolio + Settings ---- */}
          <div className="space-y-6 lg:col-span-2">
            {/* Portfolio card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">Step 1: Enter your holdings</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                A &quot;holding&quot; is a stock you own. Enter one stock per line with its ticker
                symbol (the short code used on stock exchanges, like AAPL for Apple) and how much
                of it you hold.
              </p>

              {/* Mode toggle */}
              <div className="mt-4 flex gap-3">
                {(["weights", "shares"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      mode === m
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {m === "weights" ? "Weights" : "Shares"}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                {mode === "weights" ? (
                  <>
                    <strong className="text-slate-700">Weights mode:</strong> Enter what fraction of
                    your portfolio each stock represents. For example, <code className="font-mono text-slate-600">0.5</code> means
                    50% of your money is in that stock. Don&apos;t worry if the numbers don&apos;t
                    add up to exactly 1 &mdash; we&apos;ll normalize them automatically.
                  </>
                ) : (
                  <>
                    <strong className="text-slate-700">Shares mode:</strong> Enter the actual number
                    of shares you own for each stock. For example, if you own 10 shares of Apple,
                    enter <code className="font-mono text-slate-600">AAPL, 10</code>. We&apos;ll
                    use current prices to figure out what percentage of your portfolio each stock is.
                  </>
                )}
              </div>

              {/* Textarea */}
              <textarea
                rows={6}
                value={rawHoldings}
                onChange={(e) => setRawHoldings(e.target.value)}
                placeholder={"AAPL, 0.5\nMSFT, 0.3\nGOOGL, 0.2"}
                className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />

              {/* Parsed preview */}
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-400">
                  Parsed preview (these are the stocks we detected):
                </p>
                {parsedHoldings.length === 0 ? (
                  <p className="text-xs text-slate-400">No valid holdings detected yet. Type a ticker and value above.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedHoldings.map((h) => (
                      <span
                        key={h.ticker}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {h.ticker}
                        <span className="ml-1 text-slate-400">{h.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Settings card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">Step 2: Configure settings</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                These settings control how the analysis is performed. The defaults work well for
                most people &mdash; you can skip this section if you&apos;re unsure.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                {/* Range */}
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Lookback period</span>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="3m">3 months</option>
                    <option value="6m">6 months</option>
                    <option value="1y">1 year</option>
                    <option value="3y">3 years</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">How far back in time to look at prices. Longer = more data but includes older market conditions.</p>
                </label>

                {/* Benchmark */}
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Benchmark</span>
                  <input
                    value={benchmark}
                    onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
                    placeholder="SPY"
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm uppercase text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">A stock/index to compare against. SPY tracks the overall US stock market (S&amp;P 500).</p>
                </label>

                {/* Risk-free rate */}
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Risk-free rate</span>
                  <input
                    type="number"
                    step="0.001"
                    value={riskFreeRate}
                    onChange={(e) => setRiskFreeRate(e.target.value)}
                    placeholder="0.02"
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">The return you&apos;d get with zero risk (e.g. a savings account). 0.02 = 2% per year. Used to calculate Sharpe ratio.</p>
                </label>
              </div>

              {/* Shrinkage */}
              <div className="mt-5 flex items-start gap-3">
                <input
                  id="shrinkage"
                  type="checkbox"
                  checked={shrinkageEnabled}
                  onChange={(e) => setShrinkageEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="shrinkage" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Apply covariance shrinkage
                  </label>
                  <p className="text-xs leading-relaxed text-slate-400">
                    <strong>Advanced.</strong> When you have many stocks but limited historical data,
                    the statistical estimates of how stocks move together can be unreliable. Shrinkage
                    makes these estimates more stable. Leave this off unless you have 10+ stocks.
                  </p>
                  {shrinkageEnabled && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={shrinkage}
                        onChange={(e) => setShrinkage(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <span className="text-xs text-slate-400">0 = no effect, 1 = maximum</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors sm:w-auto",
                isValid && !submitting
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-400",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  Generate Report <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* ---- Right column: Help ---- */}
          <div className="space-y-6">
            {/* How to use */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <BookOpen className="h-4 w-4 text-blue-500" /> How to use this page
              </h2>
              <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-500">
                <li>
                  <strong className="text-slate-700">1. Pick a mode.</strong> Choose &quot;Weights&quot;
                  if you want to say &quot;50% Apple, 30% Microsoft&quot; etc. Choose &quot;Shares&quot;
                  if you know exactly how many shares you own.
                </li>
                <li>
                  <strong className="text-slate-700">2. Enter your stocks.</strong> One per line.
                  The ticker is the short code (AAPL = Apple, MSFT = Microsoft, GOOGL = Google,
                  AMZN = Amazon, TSLA = Tesla, SPY = S&amp;P 500 index fund).
                </li>
                <li>
                  <strong className="text-slate-700">3. Check the preview.</strong> Make sure the
                  badges below the text box show the stocks you intended.
                </li>
                <li>
                  <strong className="text-slate-700">4. Click Generate Report.</strong> This
                  fetches real price data and runs the analysis. It may take a few seconds.
                </li>
              </ol>
            </div>

            {/* Formatting tips */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Info className="h-4 w-4 text-blue-500" /> Formatting tips
              </h2>
              <ul className="mt-3 space-y-2 text-xs text-slate-500">
                <li className="flex gap-2">
                  <span className="text-slate-300">&bull;</span>
                  Format: <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">TICKER, value</code>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-300">&bull;</span>
                  Comma, space, or tab all work as separators
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-300">&bull;</span>
                  Weights don&apos;t have to add up to 1 (we normalize them)
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-300">&bull;</span>
                  Use US stock tickers only (e.g. AAPL, not Apple Inc.)
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-300">&bull;</span>
                  Maximum 20 stocks per portfolio
                </li>
              </ul>
            </div>

            {/* What you'll get */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-blue-500" /> What the report will show
              </h2>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                <li><strong>Equity curve</strong> &mdash; a chart showing how your portfolio&apos;s value would have changed over time</li>
                <li><strong>Drawdown</strong> &mdash; how much your portfolio dropped from its highest point (the &quot;worst dip&quot;)</li>
                <li><strong>Sharpe ratio &amp; CAGR</strong> &mdash; how good your returns are relative to the risk you took</li>
                <li><strong>VaR &amp; CVaR</strong> &mdash; how much you could lose on a bad day</li>
                <li><strong>Correlation heatmap</strong> &mdash; whether your stocks move together or independently</li>
                <li><strong>Risk contributions</strong> &mdash; which stocks are adding the most risk to your portfolio</li>
              </ul>
            </div>

            {/* Popular tickers */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-blue-500" /> Popular tickers to try
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Don&apos;t know which stocks to enter? Here are some well-known ones, grouped by category.
                Copy any combination into the text box on the left.
              </p>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Big Tech</p>
                  <p className="text-slate-500">AAPL (Apple), MSFT (Microsoft), GOOGL (Google), AMZN (Amazon), META (Meta/Facebook), NVDA (Nvidia), TSLA (Tesla)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Index Funds &amp; ETFs</p>
                  <p className="text-slate-500">SPY (S&amp;P 500), QQQ (Nasdaq 100), DIA (Dow Jones), IWM (Small-cap), VTI (Total US market)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Finance</p>
                  <p className="text-slate-500">JPM (JPMorgan), BAC (Bank of America), GS (Goldman Sachs), V (Visa), MA (Mastercard)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Healthcare</p>
                  <p className="text-slate-500">JNJ (Johnson &amp; Johnson), UNH (UnitedHealth), PFE (Pfizer), ABBV (AbbVie), MRK (Merck)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Energy &amp; Commodities</p>
                  <p className="text-slate-500">XOM (ExxonMobil), CVX (Chevron), GLD (Gold ETF), USO (Oil ETF)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Bonds (for diversification)</p>
                  <p className="text-slate-500">TLT (Long-term US bonds), AGG (Total bond market), BND (Vanguard bonds)</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-slate-500">
                  <strong className="text-slate-700">Example portfolio:</strong> Try a balanced mix
                  like <code className="font-mono text-slate-600">AAPL, 0.2 / MSFT, 0.2 / SPY, 0.3 / TLT, 0.2 / GLD, 0.1</code> (one per line) to see how diversification works.
                </div>
              </div>
            </div>

            {/* Glossary */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <HelpCircle className="h-4 w-4 text-blue-500" /> Quick glossary
              </h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-semibold text-slate-700">Ticker</dt>
                  <dd className="text-slate-500">A short code that identifies a stock on the exchange (e.g. AAPL = Apple).</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Weight</dt>
                  <dd className="text-slate-500">The fraction of your total portfolio in a given stock. 0.5 = 50%.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Benchmark</dt>
                  <dd className="text-slate-500">A reference point to compare your portfolio against. SPY represents the overall US stock market.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Risk-free rate</dt>
                  <dd className="text-slate-500">The return you&apos;d earn with zero risk (like a government bond). Used to judge if your returns justify the risk.</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
