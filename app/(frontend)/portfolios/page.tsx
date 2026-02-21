"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioListItem } from "../../../lib/types";

const pct = (v: number | null) => (v == null ? "-" : `${(v * 100).toFixed(2)}%`);

export default function PortfoliosPage() {
  const [rows, setRows] = useState<PortfolioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portfolios");
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent("/portfolios");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to load portfolios.");
      setRows(data as PortfolioListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saved Portfolios</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create portfolios, run snapshots, and track risk history over time.
          </p>
        </div>
        <Link
          href="/portfolios/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New Portfolio
        </Link>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-slate-500">Mode</th>
                <th className="px-4 py-3 text-left text-slate-500">Holdings</th>
                <th className="px-4 py-3 text-left text-slate-500">Last Snapshot</th>
                <th className="px-4 py-3 text-left text-slate-500">Last Vol</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-blue-600 hover:underline" href={`/portfolios/${r.id}`}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.mode}</td>
                  <td className="px-4 py-3">{r.holdingCount}</td>
                  <td className="px-4 py-3">
                    {r.lastSnapshotAt ? new Date(r.lastSnapshotAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">{pct(r.lastVolAnn)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No portfolios yet. Create your first one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
