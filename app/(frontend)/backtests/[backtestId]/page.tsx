"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LineChartCard from "../../../../components/LineChartCard";
import MetricCard from "../../../../components/MetricCard";
import type { BacktestRunDetail } from "../../../../lib/types";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function BacktestDetailPage({ params }: { params: { backtestId: string } }) {
  const backtestId = params.backtestId;
  const [backtest, setBacktest] = useState<BacktestRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/backtests/${backtestId}`);
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent(`/backtests/${backtestId}`);
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Failed to load backtest.");
        setBacktest(data as BacktestRunDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load backtest.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [backtestId]);

  const equityData = useMemo(() => {
    if (!backtest) return [];
    return backtest.series.dates.map((d, i) => ({ name: d, value: backtest.series.equity[i] ?? null }));
  }, [backtest]);
  const drawdownData = useMemo(() => {
    if (!backtest) return [];
    return backtest.series.dates.map((d, i) => ({ name: d, value: backtest.series.drawdown[i] ?? null }));
  }, [backtest]);

  if (loading) return <div className="text-sm text-slate-500">Loading backtest...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!backtest) return <div className="text-sm text-slate-500">Backtest not found.</div>;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backtest Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            {backtest.strategy} • {backtest.frequency} • {new Date(backtest.createdAt).toLocaleString()}
          </p>
        </div>
        <Link href={`/portfolios/${backtest.portfolioId}`} className="text-sm font-medium text-blue-600 hover:underline">
          Back to portfolio
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <MetricCard label="Total Return" value={pct(backtest.metrics.totalReturn)} />
        <MetricCard label="CAGR" value={pct(backtest.metrics.cagr)} />
        <MetricCard label="Vol Ann" value={pct(backtest.metrics.volAnn)} />
        <MetricCard label="Sharpe" value={backtest.metrics.sharpe.toFixed(3)} />
        <MetricCard label="Max DD" value={pct(backtest.metrics.maxDD)} />
        <MetricCard label="Turnover" value={pct(backtest.metrics.turnover)} />
        <MetricCard label="Avg Cost" value={backtest.metrics.avgRebalanceCost.toFixed(4)} />
      </div>

      <LineChartCard title="Equity Curve (indexed 100)" data={equityData} valueFormatter={(v) => v.toFixed(2)} />
      <LineChartCard title="Drawdown" data={drawdownData} valueFormatter={pct} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Rebalance Weights</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Weights</th>
            </tr>
          </thead>
          <tbody>
            {backtest.weights.map((w) => (
              <tr key={w.date} className="border-b border-slate-50">
                <td className="py-2">{new Date(w.date).toLocaleDateString()}</td>
                <td className="py-2">{Object.entries(w.weights).map(([k, v]) => `${k} ${pct(v)}`).join(" | ")}</td>
              </tr>
            ))}
            {backtest.weights.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-3 text-slate-500">
                  No rebalance records.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
