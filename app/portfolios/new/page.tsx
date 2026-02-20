"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { HoldingsItem } from "../../../lib/types";

const TICKER_RE = /^[A-Z.\-]{1,12}$/;

function parseHoldings(raw: string): HoldingsItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tickerRaw, valueRaw] = line.split(/[, \t]+/).filter(Boolean);
      const ticker = (tickerRaw ?? "").toUpperCase();
      const value = Number(valueRaw);
      if (!TICKER_RE.test(ticker) || !Number.isFinite(value) || value <= 0) return null;
      return { ticker, value };
    })
    .filter((x): x is HoldingsItem => x != null);
}

export default function NewPortfolioPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"shares" | "weights">("shares");
  const [holdingsText, setHoldingsText] = useState("AAPL 10\nMSFT 8\nSPY 5");
  const [range, setRange] = useState("1y");
  const [benchmark, setBenchmark] = useState("SPY");
  const [riskFreeRate, setRiskFreeRate] = useState("0");
  const [shrinkage, setShrinkage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const holdings = useMemo(() => parseHoldings(holdingsText), [holdingsText]);
  const canSubmit = name.trim().length > 0 && holdings.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mode,
          holdings,
          defaults: {
            range,
            benchmark: benchmark.toUpperCase().trim(),
            riskFreeRate: Number(riskFreeRate) || 0,
            shrinkage,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create portfolio.");
      router.push(`/portfolios/${data.portfolioId as string}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create portfolio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">New Portfolio</h1>
      <p className="mt-1 text-sm text-slate-500">Create a saved portfolio to run persistent risk snapshots.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Portfolio name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="My Portfolio"
          />
        </label>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Mode</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("shares")}
              className={`rounded-lg px-3 py-2 text-sm ${mode === "shares" ? "bg-blue-600 text-white" : "bg-slate-100"}`}
            >
              Shares
            </button>
            <button
              type="button"
              onClick={() => setMode("weights")}
              className={`rounded-lg px-3 py-2 text-sm ${mode === "weights" ? "bg-blue-600 text-white" : "bg-slate-100"}`}
            >
              Weights
            </button>
          </div>
        </div>

        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Holdings (one per line: TICKER value)</div>
          <textarea
            rows={6}
            value={holdingsText}
            onChange={(e) => setHoldingsText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm"
          />
          <div className="mt-1 text-xs text-slate-500">{holdings.length} valid holdings parsed</div>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Default range</div>
            <select value={range} onChange={(e) => setRange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option value="3m">3m</option>
              <option value="6m">6m</option>
              <option value="1y">1y</option>
              <option value="3y">3y</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Benchmark</div>
            <input value={benchmark} onChange={(e) => setBenchmark(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-slate-700">Risk-free rate</div>
            <input value={riskFreeRate} onChange={(e) => setRiskFreeRate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 pt-7 text-sm">
            <input type="checkbox" checked={shrinkage} onChange={(e) => setShrinkage(e.target.checked)} />
            Enable shrinkage
          </label>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        <button
          disabled={!canSubmit || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Saving..." : "Create Portfolio"}
        </button>
      </form>
    </main>
  );
}
