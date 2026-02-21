"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AlertRule, PortfolioDetail, SnapshotSummary } from "../../../../lib/types";
import MetricCard from "../../../../components/MetricCard";

type SnapshotConfig = {
  range: string;
  benchmark: string;
  riskFreeRate: number;
  shrinkage: boolean;
};

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [history, setHistory] = useState<SnapshotSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [config, setConfig] = useState<SnapshotConfig>({
    range: "1y",
    benchmark: "SPY",
    riskFreeRate: 0,
    shrinkage: false,
  });
  const [alertType, setAlertType] = useState<"vol_gt" | "maxdd_lt" | "var_gt">("vol_gt");
  const [alertThreshold, setAlertThreshold] = useState("0.35");
  const [alertResult, setAlertResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [portfolioRes, snapshotsRes, alertsRes] = await Promise.all([
        fetch(`/api/portfolios/${id}`),
        fetch(`/api/portfolios/${id}/snapshots`),
        fetch(`/api/portfolios/${id}/alerts`),
      ]);
      if (portfolioRes.status === 401 || snapshotsRes.status === 401 || alertsRes.status === 401) {
        window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent("/portfolios/" + id);
        return;
      }
      const portfolioData = await portfolioRes.json();
      const snapshotsData = await snapshotsRes.json();
      const alertsData = await alertsRes.json();
      if (!portfolioRes.ok) throw new Error(portfolioData?.error ?? "Failed to load portfolio.");
      setPortfolio(portfolioData as PortfolioDetail);
      setConfig((portfolioData as PortfolioDetail).defaults);
      setHistory((snapshotsData as SnapshotSummary[]) ?? []);
      setAlerts((alertsData as AlertRule[]) ?? []);
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

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{portfolio.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mode: {portfolio.mode} • Created: {new Date(portfolio.createdAt).toLocaleString()}
          </p>
        </div>
        <Link href="/portfolios" className="text-sm font-medium text-blue-600 hover:underline">
          Back to portfolios
        </Link>
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
