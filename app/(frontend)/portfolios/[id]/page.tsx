"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  AlertRule,
  BacktestRunSummary,
  DetectiveReportSummary,
  PortfolioDetail,
  SnapshotSummary,
} from "../../../../lib/types";
import MetricCard from "../../../../components/MetricCard";
import NextStepsPanel from "../../../../components/NextStepsPanel";
import DisclosureHelp from "../../../../components/DisclosureHelp";
import { getPortfolioNextSteps } from "../../../../lib/uxSuggestions";
import { trackEvent } from "../../../../lib/telemetry";
import { useUxMode } from "../../../../lib/useUxMode";

type SnapshotConfig = {
  range: string;
  benchmark: string;
  riskFreeRate: number;
  shrinkage: boolean;
};

type DetectiveConfig = {
  analyzeDate: string;
  benchmark: string;
  eventWindowDays: number;
  maxTickers: number;
};

type BacktestConfig = {
  start: string;
  end: string;
  benchmark: string;
  frequency: "WEEKLY" | "MONTHLY";
  strategy: "BUY_HOLD" | "RISK_PARITY" | "MINVAR_QP";
  costBps: number;
  maxWeight: string;
  shrinkage: boolean;
};

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const uxMode = useUxMode();
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [history, setHistory] = useState<SnapshotSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [detectiveReports, setDetectiveReports] = useState<DetectiveReportSummary[]>([]);
  const [backtests, setBacktests] = useState<BacktestRunSummary[]>([]);
  const [hasEvents, setHasEvents] = useState(false);
  const [config, setConfig] = useState<SnapshotConfig>({
    range: "1y",
    benchmark: "SPY",
    riskFreeRate: 0,
    shrinkage: false,
  });
  const [detectiveConfig, setDetectiveConfig] = useState<DetectiveConfig>({
    analyzeDate: new Date().toISOString().slice(0, 10),
    benchmark: "SPY",
    eventWindowDays: 5,
    maxTickers: 5,
  });
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    start: new Date(new Date().setUTCFullYear(new Date().getUTCFullYear() - 1)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
    benchmark: "SPY",
    frequency: "MONTHLY",
    strategy: "BUY_HOLD",
    costBps: 0,
    maxWeight: "",
    shrinkage: false,
  });
  const [alertType, setAlertType] = useState<"vol_gt" | "maxdd_lt" | "var_gt">("vol_gt");
  const [alertThreshold, setAlertThreshold] = useState("0.35");
  const [alertResult, setAlertResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [syncingEvents, setSyncingEvents] = useState(false);
  const [runningDetective, setRunningDetective] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [portfolioRes, snapshotsRes, alertsRes, detectiveRes, backtestsRes, eventsRes] = await Promise.all([
        fetch(`/api/portfolios/${id}`),
        fetch(`/api/portfolios/${id}/snapshots`),
        fetch(`/api/portfolios/${id}/alerts`),
        fetch(`/api/portfolios/${id}/detective/reports`),
        fetch(`/api/portfolios/${id}/backtests`),
        fetch(`/api/portfolios/${id}/events?limit=1`),
      ]);
      if (
        portfolioRes.status === 401 ||
        snapshotsRes.status === 401 ||
        alertsRes.status === 401 ||
        detectiveRes.status === 401 ||
        backtestsRes.status === 401 ||
        eventsRes.status === 401
      ) {
        window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent("/portfolios/" + id);
        return;
      }
      const portfolioData = await portfolioRes.json();
      const snapshotsData = await snapshotsRes.json();
      const alertsData = await alertsRes.json();
      const detectiveData = await detectiveRes.json();
      const backtestsData = await backtestsRes.json();
      const eventsData = await eventsRes.json();
      if (!portfolioRes.ok) throw new Error(portfolioData?.error ?? "Failed to load portfolio.");
      setPortfolio(portfolioData as PortfolioDetail);
      setConfig((portfolioData as PortfolioDetail).defaults);
      setHistory(snapshotsRes.ok && Array.isArray(snapshotsData) ? (snapshotsData as SnapshotSummary[]) : []);
      setAlerts(alertsRes.ok && Array.isArray(alertsData) ? (alertsData as AlertRule[]) : []);
      setDetectiveReports(detectiveRes.ok && Array.isArray(detectiveData) ? (detectiveData as DetectiveReportSummary[]) : []);
      setBacktests(backtestsRes.ok && Array.isArray(backtestsData) ? (backtestsData as BacktestRunSummary[]) : []);
      setHasEvents(Boolean(eventsRes.ok && Array.isArray(eventsData?.items) && eventsData.items.length > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function runSnapshot() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Snapshot run failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function createAlert() {
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: alertType, threshold: Number(alertThreshold) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create alert.");
      setAlerts((prev) => [data as AlertRule, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert.");
    }
  }

  async function syncEvents() {
    setSyncingEvents(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/events/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: ["SEC"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to sync events.");
      trackEvent("portfolio_sync_events", { portfolioId: id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync events.");
    } finally {
      setSyncingEvents(false);
    }
  }

  async function runDetective() {
    setRunningDetective(true);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}/detective/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detectiveConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Detective run failed.");
      trackEvent("portfolio_run_detective", { portfolioId: id, benchmark: detectiveConfig.benchmark });
      await load();
      if (data?.reportId) {
        window.location.href = `/detective/reports/${data.reportId}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detective run failed.");
    } finally {
      setRunningDetective(false);
    }
  }

  async function runBacktest() {
    setRunningBacktest(true);
    setError("");
    try {
      const maxWeightNum = Number(backtestConfig.maxWeight);
      const res = await fetch(`/api/portfolios/${id}/backtests/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: backtestConfig.start,
          end: backtestConfig.end,
          benchmark: backtestConfig.benchmark,
          frequency: backtestConfig.frequency,
          strategy: backtestConfig.strategy,
          costBps: backtestConfig.costBps,
          maxWeight: Number.isFinite(maxWeightNum) && maxWeightNum > 0 ? maxWeightNum : undefined,
          shrinkage: backtestConfig.shrinkage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Backtest run failed.");
      trackEvent("portfolio_run_backtest", {
        portfolioId: id,
        strategy: backtestConfig.strategy,
        frequency: backtestConfig.frequency,
      });
      await load();
      if (data?.backtestId) {
        window.location.href = `/backtests/${data.backtestId}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest run failed.");
    } finally {
      setRunningBacktest(false);
    }
  }

  async function checkAlerts() {
    setError("");
    setAlertResult("");
    try {
      const res = await fetch(`/api/portfolios/${id}/alerts/check`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to check alerts.");
      const triggered = (data?.triggered as Array<{ type: string; threshold: number; value: number }>) ?? [];
      setAlertResult(
        triggered.length === 0
          ? "No alerts triggered on the latest snapshot."
          : `Triggered: ${triggered
              .map((t) => `${t.type} (threshold=${t.threshold}, value=${t.value.toFixed(4)})`)
              .join("; ")}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check alerts.");
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;
  if (!portfolio) return <div className="text-sm text-red-700">Portfolio not found.</div>;

  const latest = portfolio.latestSnapshot;
  const nextSteps = getPortfolioNextSteps({
    hasSnapshot: Boolean(latest),
    hasEvents,
    hasDetectiveReports: detectiveReports.length > 0,
    hasBacktests: backtests.length > 0,
  });

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{portfolio.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mode: {portfolio.mode} • Created: {new Date(portfolio.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/assistant" className="text-sm font-medium text-blue-600 hover:underline">
            Guided assistant
          </Link>
          <Link href="/portfolios" className="text-sm font-medium text-blue-600 hover:underline">
            Back to portfolios
          </Link>
        </div>
      </div>

      {latest ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Vol Ann" value={`${(latest.volAnn * 100).toFixed(2)}%`} />
          <MetricCard label="Max DD" value={`${(latest.maxDD * 100).toFixed(2)}%`} />
          <MetricCard label="Beta" value={latest.beta == null ? "-" : latest.beta.toFixed(3)} />
          <MetricCard label="Range" value={latest.range} />
          <MetricCard label="Benchmark" value={latest.benchmark} />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          No snapshot yet. Run one below.
        </div>
      )}

      {uxMode === "guided" ? <NextStepsPanel steps={nextSteps} /> : null}

      {uxMode === "guided" ? (
        <DisclosureHelp title="How to use this page effectively" defaultOpen>
          Recommended order: 1) Run Snapshot for baseline risk, 2) Sync Events, 3) Run Detective Report for explainability,
          4) Run monthly backtests to compare strategies, 5) Add alerts for monitoring.
        </DisclosureHelp>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Holdings</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Ticker</th>
              <th className="py-2 text-left">Input Value</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.map((h) => (
              <tr key={h.ticker} className="border-b border-slate-50">
                <td className="py-2">{h.ticker}</td>
                <td className="py-2">{h.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Run Snapshot</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <select
            value={config.range}
            onChange={(e) => setConfig((c) => ({ ...c, range: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="3m">3m</option>
            <option value="6m">6m</option>
            <option value="1y">1y</option>
            <option value="3y">3y</option>
          </select>
          <input
            value={config.benchmark}
            onChange={(e) => setConfig((c) => ({ ...c, benchmark: e.target.value.toUpperCase() }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Benchmark"
          />
          <input
            value={String(config.riskFreeRate)}
            onChange={(e) => setConfig((c) => ({ ...c, riskFreeRate: Number(e.target.value) || 0 }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="RF"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.shrinkage}
              onChange={(e) => setConfig((c) => ({ ...c, shrinkage: e.target.checked }))}
            />
            Shrinkage
          </label>
        </div>
        {uxMode === "guided" ? (
          <p className="mt-2 text-xs text-slate-500">
            <strong>Benchmark tip:</strong> SPY is an ETF that tracks the S&amp;P 500 (broad US market) and is a good
            default comparison for beta and relative performance.
          </p>
        ) : null}
        <button
          onClick={runSnapshot}
          disabled={running}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {running ? "Running..." : "Run Snapshot"}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Snapshot History</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Created</th>
              <th className="py-2 text-left">Range</th>
              <th className="py-2 text-left">Vol</th>
              <th className="py-2 text-left">MaxDD</th>
              <th className="py-2 text-left">Beta</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="py-2">
                  <Link href={`/snapshots/${s.id}`} className="text-blue-600 hover:underline">
                    {new Date(s.createdAt).toLocaleString()}
                  </Link>
                </td>
                <td className="py-2">{s.range}</td>
                <td className="py-2">{(s.volAnn * 100).toFixed(2)}%</td>
                <td className="py-2">{(s.maxDD * 100).toFixed(2)}%</td>
                <td className="py-2">{s.beta == null ? "-" : s.beta.toFixed(3)}</td>
              </tr>
            ))}
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500">
                  No snapshots yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Detective</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            type="date"
            value={detectiveConfig.analyzeDate}
            onChange={(e) => setDetectiveConfig((c) => ({ ...c, analyzeDate: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
          <input
            value={detectiveConfig.benchmark}
            onChange={(e) =>
              setDetectiveConfig((c) => ({ ...c, benchmark: e.target.value.toUpperCase() }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Benchmark"
          />
          <input
            type="number"
            min={1}
            max={15}
            value={detectiveConfig.eventWindowDays}
            onChange={(e) =>
              setDetectiveConfig((c) => ({ ...c, eventWindowDays: Number(e.target.value) || 5 }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Event window days"
          />
          <input
            type="number"
            min={1}
            max={20}
            value={detectiveConfig.maxTickers}
            onChange={(e) =>
              setDetectiveConfig((c) => ({ ...c, maxTickers: Number(e.target.value) || 5 }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Max tickers"
          />
        </div>
        {uxMode === "guided" ? (
          <p className="mt-2 text-xs text-slate-500">
            <strong>Detective inputs:</strong> <em>eventWindowDays</em> controls how far back portfolio return is measured.
            <em> maxTickers</em> limits analysis to biggest contributors. SPY is the default market benchmark.
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            onClick={syncEvents}
            disabled={syncingEvents}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {syncingEvents ? "Syncing..." : "Sync Events"}
          </button>
          <button
            onClick={runDetective}
            disabled={runningDetective}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {runningDetective ? "Running..." : "Run Detective Report"}
          </button>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-700">Recent Detective Reports</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Analyze Date</th>
              <th className="py-2 text-left">Portfolio Return</th>
              <th className="py-2 text-left">Abnormal Return</th>
              <th className="py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {detectiveReports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="py-2">
                  <Link href={`/detective/reports/${r.id}`} className="text-blue-600 hover:underline">
                    {new Date(r.analyzeDate).toLocaleDateString()}
                  </Link>
                </td>
                <td className="py-2">{(r.portfolioReturn * 100).toFixed(2)}%</td>
                <td className="py-2">{(r.abnormalReturn * 100).toFixed(2)}%</td>
                <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {detectiveReports.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-slate-500">
                  No detective reports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Backtests</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            type="date"
            value={backtestConfig.start}
            onChange={(e) => setBacktestConfig((c) => ({ ...c, start: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={backtestConfig.end}
            onChange={(e) => setBacktestConfig((c) => ({ ...c, end: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
          <select
            value={backtestConfig.frequency}
            onChange={(e) =>
              setBacktestConfig((c) => ({
                ...c,
                frequency: e.target.value as "WEEKLY" | "MONTHLY",
              }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <select
            value={backtestConfig.strategy}
            onChange={(e) =>
              setBacktestConfig((c) => ({
                ...c,
                strategy: e.target.value as "BUY_HOLD" | "RISK_PARITY" | "MINVAR_QP",
              }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="BUY_HOLD">Buy &amp; Hold</option>
            <option value="RISK_PARITY">Risk Parity</option>
            <option value="MINVAR_QP">Min-Variance (QP)</option>
          </select>
          <input
            value={backtestConfig.benchmark}
            onChange={(e) =>
              setBacktestConfig((c) => ({ ...c, benchmark: e.target.value.toUpperCase() }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Benchmark"
          />
          <input
            type="number"
            value={String(backtestConfig.costBps)}
            onChange={(e) =>
              setBacktestConfig((c) => ({ ...c, costBps: Number(e.target.value) || 0 }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Transaction cost bps"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={backtestConfig.maxWeight}
            onChange={(e) => setBacktestConfig((c) => ({ ...c, maxWeight: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Max weight (optional)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={backtestConfig.shrinkage}
              onChange={(e) => setBacktestConfig((c) => ({ ...c, shrinkage: e.target.checked }))}
            />
            Covariance shrinkage
          </label>
        </div>
        {uxMode === "guided" ? (
          <p className="mt-2 text-xs text-slate-500">
            <strong>Backtest benchmark:</strong> SPY gives you a simple market baseline. If your strategy underperforms SPY
            after costs, reconsider allocation or rebalance frequency.
          </p>
        ) : null}
        <button
          onClick={runBacktest}
          disabled={runningBacktest}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {runningBacktest ? "Running..." : "Run Backtest"}
        </button>
        <h3 className="mt-4 text-sm font-semibold text-slate-700">Backtest Runs</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Created</th>
              <th className="py-2 text-left">Range</th>
              <th className="py-2 text-left">Strategy</th>
              <th className="py-2 text-left">Total Return</th>
              <th className="py-2 text-left">CAGR</th>
              <th className="py-2 text-left">MaxDD</th>
            </tr>
          </thead>
          <tbody>
            {backtests.map((b) => (
              <tr key={b.id} className="border-b border-slate-50">
                <td className="py-2">
                  <Link href={`/backtests/${b.id}`} className="text-blue-600 hover:underline">
                    {new Date(b.createdAt).toLocaleString()}
                  </Link>
                </td>
                <td className="py-2">
                  {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                </td>
                <td className="py-2">{b.strategy}</td>
                <td className="py-2">{(b.totalReturn * 100).toFixed(2)}%</td>
                <td className="py-2">{(b.cagr * 100).toFixed(2)}%</td>
                <td className="py-2">{(b.maxDD * 100).toFixed(2)}%</td>
              </tr>
            ))}
            {backtests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-slate-500">
                  No backtests yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Alerts (bonus)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as typeof alertType)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="vol_gt">vol_gt</option>
            <option value="maxdd_lt">maxdd_lt</option>
            <option value="var_gt">var_gt</option>
          </select>
          <input
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="threshold"
          />
          <button onClick={createAlert} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Add Alert
          </button>
          <button onClick={checkAlerts} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
            Check Alerts
          </button>
        </div>
        {alertResult ? <div className="mt-3 rounded-lg bg-slate-50 p-2 text-sm">{alertResult}</div> : null}
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
          {alerts.map((a) => (
            <li key={a.id}>
              {a.type} @ {a.threshold}
            </li>
          ))}
          {alerts.length === 0 ? <li>No alert rules yet.</li> : null}
        </ul>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    </main>
  );
}
