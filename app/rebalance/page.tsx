"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Download } from "lucide-react";
import MetricCard from "../../components/MetricCard";
import {
  computeReturns,
  covarianceMatrix,
  normalizeWeights,
  shrinkCovariance,
} from "../../lib/math";
import {
  blendWeights,
  computeTrades,
  estimatedTurnover,
  minVarianceWeights,
  portfolioVol,
  riskParityWeights,
} from "../../lib/rebalance";
import { cn } from "../../lib/utils";
import type { HoldingsInput, PricesResponse, RebalanceObjective, ReturnsByTicker } from "../../lib/types";

const STORAGE_KEY = "quant-risk-input";
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className ?? "h-6 w-24"}`} />;
}

/* ---------- Guide ---------- */

function RebalanceGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-3 text-left">
        <span className="text-sm font-semibold text-slate-800">What is rebalancing? (click to {open ? "hide" : "learn more"})</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-blue-100 px-5 pb-5 pt-3 text-xs leading-relaxed text-slate-600 space-y-3">
          <p>
            <strong className="text-slate-700">Rebalancing</strong> means adjusting how much of each
            stock you hold to achieve a better mix. Over time, some stocks grow faster than others, so
            your original allocation drifts. Rebalancing brings it back to a target.
          </p>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Min-Variance</h3>
            <p>
              This strategy finds the mix of stocks that produces the <em>least possible volatility</em>
              (smallest price swings). It&apos;s ideal if your main goal is to reduce risk, even if
              that means slightly lower returns. Think of it as the &quot;smoothest ride&quot; strategy.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Risk Parity</h3>
            <p>
              This strategy makes every stock contribute <em>equally</em> to the portfolio&apos;s
              total risk. Instead of putting equal dollars in each stock, it puts equal <em>risk</em>
              in each stock. Volatile stocks get smaller allocations; stable stocks get larger ones.
              This is a popular approach at many hedge funds.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">The Turnover Slider (Gamma)</h3>
            <p>
              The slider controls how aggressively you rebalance. At <strong>0</strong>, you keep your
              current weights exactly (no trades). At <strong>1</strong>, you go fully to the
              target weights. Values in between blend the two &mdash; useful if you want to gradually
              shift rather than make big changes all at once (which can be costly due to trading fees).
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Max Weight (optional)</h3>
            <p>
              If you set this to, say, 0.4, no single stock will ever get more than 40% of your
              portfolio. This prevents over-concentration in a single name.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Reading the table</h3>
            <p>
              <strong>Current:</strong> your existing allocation. <strong>Target:</strong> the
              mathematically optimal allocation. <strong>Final:</strong> the blended result (after
              applying the gamma slider). If you entered shares, you&apos;ll also see the exact number
              of shares to buy/sell. Green = buy, red = sell.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RebalancePage() {
  const [input, setInput] = useState<HoldingsInput | null>(null);
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [objective, setObjective] = useState<RebalanceObjective>("min-variance");
  const [gamma, setGamma] = useState(1);
  const [maxWeight, setMaxWeight] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try { setInput(JSON.parse(stored) as HoldingsInput); } catch { setError("Failed to read saved input."); }
  }, []);

  useEffect(() => {
    if (!input) return;
    const tickers = Array.from(
      new Set([...input.items.map((i) => i.ticker.toUpperCase()), ...(input.benchmark ? [input.benchmark.toUpperCase()] : [])]),
    );
    setLoading(true);
    setError("");
    fetch(`/api/prices?tickers=${tickers.join(",")}&range=${input.range}`)
      .then(async (res) => { const d = await res.json(); if (!res.ok) throw new Error(d?.error ?? "Fetch failed."); return d as PricesResponse; })
      .then((d) => setPrices(d))
      .catch((err) => setError(err instanceof Error ? err.message : "Fetch failed."))
      .finally(() => setLoading(false));
  }, [input]);

  const result = useMemo(() => {
    if (!input || !prices) return null;
    const tickers = input.items.map((i) => i.ticker.toUpperCase());
    const dates = prices.dates;
    if (dates.length < 2) return { error: "Not enough data points." };
    for (const t of tickers) if (!prices.pricesByTicker[t]?.length) return { error: `Missing prices for ${t}.` };

    const lastPrices = tickers.map((t) => prices.pricesByTicker[t][prices.pricesByTicker[t].length - 1]);
    const currentWeightsRaw = input.mode === "shares"
      ? tickers.map((t, idx) => (input.items.find((i) => i.ticker.toUpperCase() === t)?.value ?? 0) * lastPrices[idx])
      : tickers.map((t) => input.items.find((i) => i.ticker.toUpperCase() === t)?.value ?? 0);
    const currentWeights = normalizeWeights(currentWeightsRaw);

    const returnsByTicker: ReturnsByTicker = {};
    for (const t of tickers) returnsByTicker[t] = computeReturns(prices.pricesByTicker[t]);
    let { matrix: cov } = covarianceMatrix(returnsByTicker);
    if (input.shrinkage != null) cov = shrinkCovariance(cov, input.shrinkage);

    const mw = maxWeight ? Number.parseFloat(maxWeight) : undefined;
    const validMw = mw != null && Number.isFinite(mw) && mw > 0 && mw <= 1 ? mw : undefined;
    const targetWeights = objective === "min-variance" ? minVarianceWeights(cov, validMw) : riskParityWeights(cov, validMw);
    const finalWeights = blendWeights(currentWeights, targetWeights, gamma);
    const turnover = estimatedTurnover(currentWeights, finalWeights);
    const currentVol = portfolioVol(currentWeights, cov) * Math.sqrt(252);
    const targetVol = portfolioVol(targetWeights, cov) * Math.sqrt(252);
    const finalVol = portfolioVol(finalWeights, cov) * Math.sqrt(252);

    const currentShares = input.mode === "shares" ? tickers.map((t) => input.items.find((i) => i.ticker.toUpperCase() === t)?.value ?? 0) : null;
    const tradesResult = currentShares ? computeTrades(tickers, currentShares, lastPrices, finalWeights) : null;

    const rows = tickers.map((t, i) => ({
      ticker: t, currentWeight: currentWeights[i], targetWeight: targetWeights[i], finalWeight: finalWeights[i],
      currentShares: currentShares?.[i], targetShares: tradesResult?.trades[i].targetShares,
      tradeShares: tradesResult?.trades[i].tradeShares, tradeValue: tradesResult?.trades[i].tradeValue,
    }));

    return { tickers, rows, turnover, currentVol, targetVol, finalVol, cashLeftover: tradesResult?.cashLeftover, isSharesMode: input.mode === "shares" };
  }, [input, prices, objective, gamma, maxWeight]);

  function downloadTradesCsv() {
    if (!result || "error" in result) return;
    const h = result.isSharesMode
      ? ["ticker", "current_weight", "target_weight", "final_weight", "current_shares", "target_shares", "trade_shares", "trade_value"]
      : ["ticker", "current_weight", "target_weight", "final_weight"];
    const rows = result.rows.map((r) =>
      result.isSharesMode
        ? [r.ticker, r.currentWeight, r.targetWeight, r.finalWeight, r.currentShares ?? "", r.targetShares ?? "", r.tradeShares ?? "", r.tradeValue ?? ""]
        : [r.ticker, r.currentWeight, r.targetWeight, r.finalWeight],
    );
    const csv = [h, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "rebalance-trades.csv" }).click();
    URL.revokeObjectURL(url);
  }

  /* Empty */
  if (!input) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-slate-100 p-4 mb-4"><ArrowLeft className="h-6 w-6 text-slate-400" /></div>
        <h2 className="text-lg font-semibold text-slate-700">No portfolio loaded</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">Enter your stocks on the Input page first, then come back here to see how you could optimize your allocations.</p>
        <Link href="/" className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="inline h-3.5 w-3.5" /> Go to Input</Link>
      </div>
    );
  }

  /* Loading */
  if (loading) {
    return (
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      </div>
    );
  }

  /* Error */
  if (error || !result || "error" in result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{error || (result && "error" in result ? result.error : "Unavailable.")}</div>
        <Link href="/" className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="inline h-3.5 w-3.5" /> Back to Input</Link>
      </div>
    );
  }

  /* Full page */
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rebalancer</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            See how you could redistribute your portfolio to reduce risk or balance it more evenly.
          </p>
        </div>
        <button onClick={downloadTradesCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
          <Download className="h-3.5 w-3.5" /> Export trades CSV
        </button>
      </div>

      {/* Guide */}
      <div className="mt-6">
        <RebalanceGuide />
      </div>

      {/* Controls */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Configuration</h2>
        <p className="text-xs text-slate-400 mb-4">
          Choose a strategy below, then adjust the slider to control how much you want to change.
          The table and metrics update automatically as you move the controls.
        </p>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Strategy</span>
            <select value={objective} onChange={(e) => setObjective(e.target.value as RebalanceObjective)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="min-variance">Min-Variance (lowest risk)</option>
              <option value="risk-parity">Risk Parity (equal risk per stock)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Min-Variance minimizes total portfolio volatility. Risk Parity spreads risk equally across all stocks.</p>
          </label>
          <div>
            <span className="text-xs font-medium text-slate-500">How much to rebalance: <span className="font-semibold text-slate-700">{(gamma * 100).toFixed(0)}%</span></span>
            <input type="range" min="0" max="1" step="0.01" value={gamma} onChange={(e) => setGamma(Number.parseFloat(e.target.value))} className="mt-2 block w-full accent-blue-600" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>0% (no change)</span><span>100% (full rebalance)</span></div>
            <p className="mt-1 text-[11px] text-slate-400">Slide right to rebalance more aggressively. Slide left to make smaller, more gradual changes.</p>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Max weight per stock (optional)</span>
            <input type="number" step="0.01" min="0" max="1" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder="e.g. 0.4 = 40% max" className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-slate-400">Caps any single stock at this percentage. Leave blank for no cap.</p>
          </label>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Impact summary</h2>
        <p className="text-xs text-slate-400 mb-3">
          Compare the volatility (risk) of your current portfolio vs. the optimized one. Lower
          volatility means a smoother, more predictable ride. Turnover shows how much trading is needed.
        </p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <MetricCard label="Current vol" value={fmtPct(result.currentVol)} subtitle="Your portfolio's current annualized volatility (risk level)." />
          <MetricCard label="Target vol" value={fmtPct(result.targetVol)} subtitle="The volatility if you fully adopted the target weights." />
          <MetricCard label="Final vol" value={fmtPct(result.finalVol)} subtitle="The volatility after applying your gamma (blend) setting." />
          <MetricCard label="Est. turnover" value={fmtPct(result.turnover)} subtitle="How much of your portfolio needs to change. 50% means half your money moves." />
          {result.cashLeftover != null && <MetricCard label="Cash leftover" value={`$${result.cashLeftover.toFixed(2)}`} subtitle="Remaining cash after rounding to whole shares." />}
        </div>
      </div>

      {/* Trades table */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Rebalance detail</h3>
        <p className="mb-4 text-xs text-slate-400">
          This table shows your current allocation, the mathematically optimal target, and the
          final result after blending. {result.isSharesMode ? "Since you entered shares, we also show the exact trades (shares to buy or sell)." : "Switch to Shares mode on the Input page to see exact trade quantities."}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="pb-2 text-right text-xs font-medium text-slate-400">Current</th>
              <th className="pb-2 text-right text-xs font-medium text-slate-400">Target</th>
              <th className="pb-2 text-right text-xs font-medium text-slate-400">Final</th>
              {result.isSharesMode && (
                <>
                  <th className="pb-2 text-right text-xs font-medium text-slate-400">Cur shares</th>
                  <th className="pb-2 text-right text-xs font-medium text-slate-400">Tgt shares</th>
                  <th className="pb-2 text-right text-xs font-medium text-slate-400">Trade</th>
                  <th className="pb-2 text-right text-xs font-medium text-slate-400">Trade $</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.ticker} className="border-b border-slate-50">
                <td className="py-2.5 font-medium text-slate-700">{row.ticker}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{fmtPct(row.currentWeight)}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{fmtPct(row.targetWeight)}</td>
                <td className="py-2.5 text-right tabular-nums font-medium text-slate-800">{fmtPct(row.finalWeight)}</td>
                {result.isSharesMode && (
                  <>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">{row.currentShares}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">{row.targetShares}</td>
                    <td className={cn("py-2.5 text-right tabular-nums font-medium", (row.tradeShares ?? 0) > 0 ? "text-emerald-600" : (row.tradeShares ?? 0) < 0 ? "text-red-600" : "text-slate-400")}>
                      {(row.tradeShares ?? 0) > 0 ? "+" : ""}{row.tradeShares}
                    </td>
                    <td className={cn("py-2.5 text-right tabular-nums font-medium", (row.tradeValue ?? 0) > 0 ? "text-emerald-600" : (row.tradeValue ?? 0) < 0 ? "text-red-600" : "text-slate-400")}>
                      {(row.tradeValue ?? 0) > 0 ? "+" : ""}${(row.tradeValue ?? 0).toFixed(2)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {objective === "min-variance"
          ? "Min-variance uses a long-only heuristic (negative weights are clipped to zero). A proper quadratic programming solver would be more precise."
          : "Risk parity uses an iterative algorithm (200 steps) to equalize risk contributions across all assets."}
        {" "}These are suggestions based on historical data and should not be taken as financial advice.
      </p>

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Edit input
        </Link>
        <Link href="/report" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> View report
        </Link>
      </div>
    </div>
  );
}
