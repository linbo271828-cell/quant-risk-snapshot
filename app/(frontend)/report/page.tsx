"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Download, FileJson } from "lucide-react";
import BarChartCard from "../../../components/BarChartCard";
import CorrHeatmap from "../../../components/CorrHeatmap";
import LineChartCard from "../../../components/LineChartCard";
import MetricCard from "../../../components/MetricCard";
import {
  annualizedReturn,
  annualizedVolatility,
  betaToBenchmark,
  cagr,
  computeReturns,
  concentrationHhi,
  correlationMatrix,
  covarianceMatrix,
  drawdownSeries,
  effectiveN,
  equityCurveFromReturns,
  normalizeWeights,
  portfolioReturns as calcPortfolioReturns,
  riskContributions,
  rollingVolatility,
  sharpeRatio,
  shrinkCovariance,
  totalReturn,
  varCvar,
} from "../../../lib/math";
import type { HoldingsInput, PricesResponse, ReturnsByTicker } from "../../../lib/types";

const STORAGE_KEY = "quant-risk-input";

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtNum = (v: number) => v.toFixed(4);

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className ?? "h-6 w-24"}`} />;
}
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}
function SkeletonChart() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

/* ---------- Guide component ---------- */

function ReportGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">
          How to read this report (click to {open ? "hide" : "expand"})
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-blue-100 px-5 pb-5 pt-3 text-xs leading-relaxed text-slate-600 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">The metric cards at the top</h3>
            <p>
              These are the headline numbers for your portfolio. Think of them as a &quot;scorecard&quot;
              for how your portfolio has performed and how risky it is.
              Green/positive numbers are generally good; large negative numbers (especially Max Drawdown)
              indicate higher risk.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">The charts</h3>
            <p>
              <strong>Equity curve:</strong> Imagine you invested $100 at the start of the period.
              This line shows what that $100 would be worth over time. Going up = making money.
              Going down = losing money.
            </p>
            <p className="mt-1">
              <strong>Drawdown:</strong> This shows the &quot;dips&quot; from the highest point.
              A value of -10% means your portfolio dropped 10% from its peak. The deeper the dip,
              the more painful it would have been to hold on.
            </p>
            <p className="mt-1">
              <strong>Rolling volatility:</strong> This shows how &quot;bumpy&quot; the ride is over
              time. Higher values mean more unpredictable price swings. A calm market will show low
              volatility; a turbulent one shows spikes.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Risk contributions</h3>
            <p>
              This bar chart answers: &quot;Which of my stocks is causing the most risk?&quot;
              A stock with a large bar is contributing the most to your portfolio&apos;s overall
              volatility. This can happen because the stock is volatile, because you hold a lot of it,
              or both.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Correlation heatmap</h3>
            <p>
              This colored grid shows how your stocks move relative to each other. Values range from
              -1 to +1. <strong>+1 (deep red)</strong> means the two stocks move in perfect lockstep.
              <strong> 0 (white)</strong> means they move independently. <strong>-1 (deep blue)</strong> means they move in
              opposite directions. For diversification, you want low or negative correlations
              between your stocks.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">What should I do with this?</h3>
            <p>
              If your Sharpe ratio is below 0.5, your returns may not justify the risk. If one stock
              dominates the risk contribution chart, you&apos;re not well diversified. If all correlations
              are high, your stocks all move together and you may want to add some variety. Head to
              the <strong>Rebalancer</strong> tab to explore how to optimize your allocations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Section description helper ---------- */

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-xs leading-relaxed text-slate-400">{children}</p>;
}

export default function ReportPage() {
  const [input, setInput] = useState<HoldingsInput | null>(null);
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      .then(async (res) => { const d = await res.json(); if (!res.ok) throw new Error(d?.error ?? "Failed to fetch."); return d as PricesResponse; })
      .then((data) => {
        setPrices(data);
        if (data.errors) setError(`Some tickers failed: ${Object.entries(data.errors).map(([t, m]) => `${t}: ${m}`).join("; ")}`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to fetch prices."))
      .finally(() => setLoading(false));
  }, [input]);

  const report = useMemo(() => {
    if (!input || !prices) return null;
    const tickers = input.items.map((i) => i.ticker.toUpperCase());
    const benchmark = input.benchmark?.toUpperCase();
    const dates = prices.dates;
    if (dates.length < 2) return { error: "Not enough data points returned." };

    const latestPrices: Record<string, number> = {};
    for (const t of tickers) {
      const series = prices.pricesByTicker[t];
      if (!series || series.length === 0) return { error: `Missing prices for ${t}.` };
      latestPrices[t] = series[series.length - 1];
    }

    const weightsRaw = input.mode === "shares"
      ? tickers.map((t) => (input.items.find((i) => i.ticker.toUpperCase() === t)?.value ?? 0) * (latestPrices[t] ?? 0))
      : tickers.map((t) => input.items.find((i) => i.ticker.toUpperCase() === t)?.value ?? 0);

    const weights = normalizeWeights(weightsRaw);
    const weightsByTicker = Object.fromEntries(tickers.map((t, i) => [t, weights[i]]));
    const returnsByTicker: ReturnsByTicker = {};
    for (const t of tickers) returnsByTicker[t] = computeReturns(prices.pricesByTicker[t]);

    const portReturns = calcPortfolioReturns(returnsByTicker, weightsByTicker);
    const equityCurve = equityCurveFromReturns(portReturns, 100);
    const drawdown = drawdownSeries(equityCurve);
    const rollingVol = rollingVolatility(portReturns, 21);
    const benchmarkReturns = benchmark && prices.pricesByTicker[benchmark] ? computeReturns(prices.pricesByTicker[benchmark]) : undefined;

    const rf = input.riskFreeRate ?? 0;
    const { var95, cvar95 } = varCvar(portReturns, 0.05);
    let { tickers: covTickers, matrix: cov } = covarianceMatrix(returnsByTicker);
    if (input.shrinkage != null) cov = shrinkCovariance(cov, input.shrinkage);
    const corr = correlationMatrix(cov);
    const rc = riskContributions(weights, cov);
    const rcByTicker = Object.fromEntries(covTickers.map((t, i) => [t, rc[i] ?? 0]));

    return {
      tickers, dates, weights, weightsByTicker, portfolioReturns: portReturns,
      equityCurve, drawdown, rollingVol, benchmark, corr, covTickers,
      metrics: {
        totalReturn: totalReturn(portReturns), cagr: cagr(portReturns),
        annualReturn: annualizedReturn(portReturns), annualVol: annualizedVolatility(portReturns),
        sharpe: sharpeRatio(portReturns, rf), maxDrawdown: Math.min(...drawdown),
        beta: benchmarkReturns ? betaToBenchmark(portReturns, benchmarkReturns) : undefined,
        var95, cvar95, concentrationHhi: concentrationHhi(weights), effectiveN: effectiveN(weights),
        riskContributions: rcByTicker,
      },
      charts: {
        equityData: dates.map((d, i) => ({ name: d, value: equityCurve[i] ?? null })),
        drawdownData: dates.map((d, i) => ({ name: d, value: drawdown[i] ?? null })),
        rollingVolData: dates.slice(1).map((d, i) => ({ name: d, value: rollingVol[i] ?? null })),
      },
    };
  }, [input, prices]);

  function downloadJson() {
    if (!input || !report || "error" in report) return;
    const blob = new Blob([JSON.stringify({ input, metrics: report.metrics, dates: report.dates, weights: report.weightsByTicker, equityCurve: report.equityCurve, drawdown: report.drawdown }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "quant-risk-report.json" }).click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    if (!report || "error" in report) return;
    const header = ["date", "equity", "portfolio_return"];
    const rows = report.dates.map((date, i) => [date, report.equityCurve[i] ?? "", i === 0 ? "" : (report.portfolioReturns[i - 1] ?? "")]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "quant-risk-report.csv" }).click();
    URL.revokeObjectURL(url);
  }

  /* Empty */
  if (!input) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-slate-100 p-4 mb-4"><ArrowLeft className="h-6 w-6 text-slate-400" /></div>
        <h2 className="text-lg font-semibold text-slate-700">No portfolio loaded</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">You need to enter your stocks on the Input page first, then click &quot;Generate Report&quot; to see your analysis here.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="h-3.5 w-3.5" /> Go to Input</Link>
      </div>
    );
  }

  /* Loading */
  if (loading) {
    return (
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-80 mb-1" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        <div className="mt-6 space-y-4"><SkeletonChart /><SkeletonChart /></div>
      </div>
    );
  }

  /* Error */
  if (!prices && error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{error}</div>
        <p className="mt-2 max-w-sm text-xs text-slate-400">This usually means a ticker symbol was not recognized, or there was a network issue. Go back and check your input.</p>
        <Link href="/" className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="inline h-3.5 w-3.5" /> Back to Input</Link>
      </div>
    );
  }

  if (!report || "error" in report) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{report?.error ?? "Report unavailable."}</div>
        <Link href="/" className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="inline h-3.5 w-3.5" /> Back to Input</Link>
      </div>
    );
  }

  /* ---------- Full report ---------- */
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Report</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {report.tickers.join(", ")} &middot; {input.range}
            {report.benchmark ? ` \u00B7 Benchmark: ${report.benchmark}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadJson} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
          <button onClick={downloadCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Partial-success warning */}
      {error && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}

      {/* Guide */}
      <div className="mt-6">
        <ReportGuide />
      </div>

      {/* Metrics */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Key metrics</h2>
        <SectionDesc>
          These numbers summarize your portfolio&apos;s performance and risk. Hover over
          any card&apos;s label to understand what it means.
        </SectionDesc>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <MetricCard label="Total return" value={fmtPct(report.metrics.totalReturn)} subtitle="How much your portfolio gained or lost over the entire period." />
          <MetricCard label="CAGR" value={fmtPct(report.metrics.cagr)} subtitle="Compound Annual Growth Rate: your average yearly return, accounting for compounding." />
          <MetricCard label="Volatility" value={fmtPct(report.metrics.annualVol)} subtitle="How much your portfolio's value swings up and down in a year. Higher = bumpier ride." />
          <MetricCard label="Sharpe" value={fmtNum(report.metrics.sharpe)} subtitle={`Return per unit of risk (rf = ${((input.riskFreeRate ?? 0) * 100).toFixed(1)}%). Above 1.0 is good; above 2.0 is excellent.`} />
          <MetricCard label="Max drawdown" value={fmtPct(report.metrics.maxDrawdown)} subtitle="The worst peak-to-trough drop. -20% means you lost 20% from the highest point." />
          {report.metrics.beta != null && (
            <MetricCard label="Beta" value={fmtNum(report.metrics.beta)} subtitle={`Sensitivity to ${report.benchmark}. 1.0 = moves with market; >1 = more volatile; <1 = less volatile.`} />
          )}
          <MetricCard label="VaR 95%" value={fmtPct(report.metrics.var95)} subtitle="Value at Risk: on 95% of days, your daily loss won't exceed this amount." />
          <MetricCard label="CVaR 95%" value={fmtPct(report.metrics.cvar95)} subtitle="Conditional VaR: on the worst 5% of days, the average loss is this much." />
          <MetricCard label="HHI" value={fmtNum(report.metrics.concentrationHhi)} subtitle={`Concentration index. Neff = ${report.metrics.effectiveN.toFixed(1)} (effective # of stocks). Lower HHI = better diversified.`} />
        </div>
      </div>

      {/* Equity curve */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Portfolio growth</h2>
        <SectionDesc>
          This chart shows the growth of a hypothetical $100 investment in your portfolio.
          If the line ends above 100, you made money; below 100, you lost money.
        </SectionDesc>
        <LineChartCard title="Equity curve (indexed to $100)" data={report.charts.equityData} valueFormatter={(v) => `$${v.toFixed(1)}`} />
      </div>

      {/* Drawdown + Rolling vol */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Risk over time</h2>
        <SectionDesc>
          <strong>Drawdown</strong> shows how far your portfolio fell from its peak at each point
          in time (bigger dips = more pain). <strong>Rolling volatility</strong> shows how
          &quot;choppy&quot; the daily returns were over a moving 21-day window &mdash; spikes mean
          the market was turbulent.
        </SectionDesc>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineChartCard title="Drawdown (% from peak)" data={report.charts.drawdownData} valueFormatter={fmtPct} color="#dc2626" />
          <LineChartCard title="Rolling 21-day volatility" data={report.charts.rollingVolData} valueFormatter={fmtPct} color="#8b5cf6" />
        </div>
      </div>

      {/* Risk contributions */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Risk contributions</h2>
        <SectionDesc>
          Each bar shows what percentage of your portfolio&apos;s total risk comes from that stock.
          If one stock dominates, your portfolio is heavily dependent on that single stock&apos;s
          performance. A well-diversified portfolio has more evenly distributed bars.
        </SectionDesc>
        <BarChartCard
          title="Risk contribution per asset"
          data={report.covTickers.map((t) => ({ name: t, value: report.metrics.riskContributions[t] ?? 0 }))}
          valueFormatter={fmtPct}
        />
      </div>

      {/* Heatmap + Holdings */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Correlation &amp; holdings</h2>
        <SectionDesc>
          The <strong>heatmap</strong> shows how closely each pair of stocks moves together.
          Deep red (+1) = they always move in the same direction. White (0) = no relationship.
          Deep blue (-1) = they move in opposite directions. For good diversification, you want
          low correlations. The <strong>holdings table</strong> shows how your money is split.
        </SectionDesc>
        <div className="grid gap-4 lg:grid-cols-2">
          <CorrHeatmap tickers={report.covTickers} matrix={report.corr} />
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Holdings weights</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                  <th className="pb-2 text-right text-xs font-medium text-slate-400">Weight</th>
                </tr>
              </thead>
              <tbody>
                {report.tickers.map((t, i) => (
                  <tr key={t} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-700">{t}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{fmtPct(report.weights[i] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-400">
              Weights show what fraction of your total portfolio is in each stock.
              If you entered weights, these are your normalized inputs. If you entered shares,
              these were calculated from current prices.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Edit input
        </Link>
        <Link href="/rebalance" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          Optimize portfolio <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
