"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BarChartCard from "../../../../components/BarChartCard";
import CorrHeatmap from "../../../../components/CorrHeatmap";
import LineChartCard from "../../../../components/LineChartCard";
import MetricCard from "../../../../components/MetricCard";
import type { SnapshotDetail } from "../../../../lib/types";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default function SnapshotDetailPage({ params }: { params: { snapshotId: string } }) {
  const snapshotId = params.snapshotId;
  const [snapshot, setSnapshot] = useState<SnapshotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/snapshots/${snapshotId}`);
        const data = await res.json();
        if (res.status === 401) {
          window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent("/snapshots/" + snapshotId);
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Failed to load snapshot.");
        setSnapshot(data as SnapshotDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load snapshot.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [snapshotId]);

  if (loading) return <div className="text-sm text-slate-500">Loading snapshot...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!snapshot) return <div className="text-sm text-slate-500">Snapshot not found.</div>;

  const eqData = snapshot.series.dates.map((d, i) => ({ name: d, value: snapshot.series.equity[i] ?? null }));
  const ddData = snapshot.series.dates.map((d, i) => ({ name: d, value: snapshot.series.drawdown[i] ?? null }));
  const rvData = snapshot.series.dates.map((d, i) => ({ name: d, value: snapshot.series.rollingVol[i] ?? null }));

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Snapshot Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(snapshot.createdAt).toLocaleString()} • {snapshot.range} • {snapshot.benchmark}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/snapshots/${snapshot.id}/export?fmt=json`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            Export JSON
          </Link>
          <Link href={`/api/snapshots/${snapshot.id}/export?fmt=csv`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            Export CSV
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Return" value={pct(snapshot.metrics.totalReturn)} />
        <MetricCard label="CAGR" value={pct(snapshot.metrics.cagr)} />
        <MetricCard label="Vol Ann" value={pct(snapshot.metrics.volAnn)} />
        <MetricCard label="Sharpe" value={snapshot.metrics.sharpe.toFixed(3)} />
        <MetricCard label="Max DD" value={pct(snapshot.metrics.maxDD)} />
        <MetricCard label="Beta" value={snapshot.metrics.beta == null ? "-" : snapshot.metrics.beta.toFixed(3)} />
        <MetricCard label="VaR95" value={pct(snapshot.metrics.var95)} />
        <MetricCard label="CVaR95" value={pct(snapshot.metrics.cvar95)} />
        <MetricCard label="HHI" value={snapshot.metrics.hhi.toFixed(3)} />
        <MetricCard label="Neff" value={snapshot.metrics.neff.toFixed(2)} />
      </div>

      <LineChartCard title="Equity Curve (indexed 100)" data={eqData} valueFormatter={(v) => v.toFixed(2)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChartCard title="Drawdown" data={ddData} valueFormatter={pct} />
        <LineChartCard title="Rolling Volatility (21d)" data={rvData} valueFormatter={pct} />
      </div>

      <BarChartCard
        title="Risk Contributions"
        data={snapshot.risk.tickers.map((t) => ({ name: t, value: snapshot.risk.riskContribPct[t] ?? 0 }))}
        valueFormatter={pct}
      />

      <CorrHeatmap tickers={snapshot.risk.tickers} matrix={snapshot.risk.corrMatrix} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Holdings Used</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Ticker</th>
              <th className="py-2 text-left">Input</th>
              <th className="py-2 text-left">Last Price</th>
              <th className="py-2 text-left">Weight</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.holdingsUsed.map((h) => (
              <tr key={h.ticker} className="border-b border-slate-50">
                <td className="py-2">{h.ticker}</td>
                <td className="py-2">{h.inputValue}</td>
                <td className="py-2">{h.lastPrice.toFixed(2)}</td>
                <td className="py-2">{pct(h.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link href={`/portfolios/${snapshot.portfolioId}`} className="text-sm font-medium text-blue-600 hover:underline">
        Back to portfolio
      </Link>
    </main>
  );
}
