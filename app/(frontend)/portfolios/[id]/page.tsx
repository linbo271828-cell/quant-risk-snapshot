"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePortfolioDetailData } from "./hooks/usePortfolioDetailData";
import MetricCard from "../../../../components/MetricCard";
import NextStepsPanel from "../../../../components/NextStepsPanel";
import DisclosureHelp from "../../../../components/DisclosureHelp";
import { getPortfolioNextSteps } from "../../../../lib/uxSuggestions";
import { useUxMode } from "../../../../lib/useUxMode";

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const uxMode = useUxMode();
  const {
    portfolio,
    history,
    alerts,
    detectiveReports,
    backtests,
    hasEvents,
    config,
    setConfig,
    detectiveConfig,
    setDetectiveConfig,
    backtestConfig,
    setBacktestConfig,
    alertType,
    setAlertType,
    alertThreshold,
    setAlertThreshold,
    alertResult,
    loading,
    running,
    syncingEvents,
    runningDetective,
    runningBacktest,
    error,
    runSnapshot,
    createAlert,
    syncEvents,
    runDetective,
    runBacktest,
    checkAlerts,
    renamePortfolio,
    deletePortfolio,
    savingRename,
    deleting,
  } = usePortfolioDetailData(id);

  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;
  if (!portfolio) return <div className="text-sm text-red-700">Portfolio not found.</div>;

  const latest = portfolio.latestSnapshot;
  const nextSteps = getPortfolioNextSteps({
    hasSnapshot: Boolean(latest),
    hasEvents,
    hasDetectiveReports: detectiveReports.length > 0,
    hasBacktests: backtests.length > 0,
  });

  async function handleDeleteConfirm() {
    const ok = await deletePortfolio();
    if (ok) router.push("/portfolios");
  }

  function startEditingName() {
    setEditNameValue(portfolio.name);
    setIsEditingName(true);
  }

  function cancelEditingName() {
    setIsEditingName(false);
    setEditNameValue("");
  }

  function saveRename() {
    if (editNameValue.trim() && editNameValue.trim() !== portfolio.name) {
      renamePortfolio(editNameValue.trim());
    }
    setIsEditingName(false);
    setEditNameValue("");
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") cancelEditingName();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xl font-bold text-slate-900"
                placeholder="Portfolio name"
                autoFocus
              />
              <button
                type="button"
                onClick={saveRename}
                disabled={savingRename || !editNameValue.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-300"
              >
                {savingRename ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditingName}
                disabled={savingRename}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{portfolio.name}</h1>
              <button
                type="button"
                onClick={startEditingName}
                className="text-sm font-medium text-slate-500 underline hover:text-slate-700"
              >
                Rename
              </button>
            </div>
          )}
          <p className="mt-1 text-sm text-slate-500">
            Mode: {portfolio.mode} • Created: {new Date(portfolio.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/assistant" className="text-sm font-medium text-blue-600 hover:underline">
            Guided assistant
          </Link>
          <Link href="/portfolios" className="text-sm font-medium text-blue-600 hover:underline">
            Back to portfolios
          </Link>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {deleting ? "Deleting..." : "Delete portfolio"}
          </button>
        </div>
      </div>

      {showDeleteConfirm ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">Delete this portfolio? This cannot be undone. All snapshots, reports, and backtests for this portfolio will be removed.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-slate-300"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
