"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LineChartCard from "../../../../../components/LineChartCard";
import MetricCard from "../../../../../components/MetricCard";
import type { DetectiveReportDetail } from "../../../../../lib/types";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function DetectiveReportPage({ params }: { params: { reportId: string } }) {
  const reportId = params.reportId;
  const [report, setReport] = useState<DetectiveReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/detective/reports/${reportId}`);
        const data = await res.json();
        if (res.status === 401) {
          window.location.href =
            "/auth/signin?callbackUrl=" + encodeURIComponent(`/detective/reports/${reportId}`);
          return;
        }
        if (!res.ok) throw new Error(data?.error ?? "Failed to load report.");
        setReport(data as DetectiveReportDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reportId]);

  const contextData = useMemo(() => {
    const context = report?.summary.contextWindow;
    if (!context) return [];
    return context.dates.map((d, i) => ({
      name: d,
      value: context.benchmarkPrices[i] ?? null,
    }));
  }, [report]);

  if (loading) return <div className="text-sm text-slate-500">Loading detective report...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!report) return <div className="text-sm text-slate-500">Report not found.</div>;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio Detective Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.portfolioName} • {new Date(report.analyzeDate).toLocaleDateString()} •{" "}
            {report.benchmark}
          </p>
        </div>
        <Link href={`/portfolios/${report.portfolioId}`} className="text-sm font-medium text-blue-600 hover:underline">
          Back to portfolio
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Portfolio Return" value={pct(report.summary.portfolioReturn)} />
        <MetricCard label="Benchmark Return" value={pct(report.summary.benchmarkReturn)} />
        <MetricCard label="Abnormal Return" value={pct(report.summary.abnormalReturn)} />
      </div>

      {contextData.length > 0 ? (
        <LineChartCard
          title="Benchmark context window around analyze date"
          data={contextData}
          valueFormatter={(v) => v.toFixed(2)}
        />
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Top Drivers</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-2 text-left">Ticker</th>
              <th className="py-2 text-left">Weight</th>
              <th className="py-2 text-left">Ticker Return</th>
              <th className="py-2 text-left">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {report.summary.topDrivers.map((d) => (
              <tr key={d.ticker} className="border-b border-slate-50">
                <td className="py-2">{d.ticker}</td>
                <td className="py-2">{pct(d.weight)}</td>
                <td className="py-2">{pct(d.tickerReturn)}</td>
                <td className="py-2">{pct(d.contribution)}</td>
              </tr>
            ))}
            {report.summary.topDrivers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-slate-500">
                  No driver rows available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Ranked Events</h2>
        <div className="mt-3 space-y-3">
          {report.items.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  {item.ticker} • {item.event.type}
                </div>
                <div className="text-xs text-slate-500">Score {item.score.toFixed(4)}</div>
              </div>
              <div className="mt-1 text-sm text-slate-700">
                <a href={item.event.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {item.event.title}
                </a>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {new Date(item.event.eventTime).toLocaleString()} • {item.event.source}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Why: recency {item.explanation.recencyDays}d, abret1d {pct(item.explanation.abret1d)},
                contribution {pct(item.explanation.contribution)}.
              </div>
              <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <div>Post 1d abnormal: {item.reaction.post1dAbRet == null ? "-" : pct(item.reaction.post1dAbRet)}</div>
                <div>Post 3d abnormal: {item.reaction.post3dAbRet == null ? "-" : pct(item.reaction.post3dAbRet)}</div>
                <div>Post 5d abnormal: {item.reaction.post5dAbRet == null ? "-" : pct(item.reaction.post5dAbRet)}</div>
              </div>
            </article>
          ))}
          {report.items.length === 0 ? (
            <div className="text-sm text-slate-500">No events were ranked for this run.</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
