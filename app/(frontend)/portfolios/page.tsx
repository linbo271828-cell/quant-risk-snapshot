"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioListItem } from "../../../lib/types";
import EmptyStateCard from "../../../components/EmptyStateCard";
import DisclosureHelp from "../../../components/DisclosureHelp";

const pct = (v: number | null) => (v == null ? "-" : `${(v * 100).toFixed(2)}%`);

export default function PortfoliosPage() {
  const [rows, setRows] = useState<PortfolioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete.");
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete portfolio.");
    } finally {
      setDeletingId(null);
    }
  }

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

      <DisclosureHelp title="What can I do on this page?" className="mb-4">
        Use this page as your home base for persistent workflows. Open any portfolio to run snapshots, sync events,
        generate detective reports, and run backtests. If you are new, start by creating one sample portfolio.
      </DisclosureHelp>

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
                <th className="px-4 py-3 text-right text-slate-500">Actions</th>
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
                  <td className="px-4 py-3 text-right">
                    {confirmDeleteId === r.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          {deletingId === r.id ? "Deleting..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === r.id}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(r.id)}
                        className="text-sm font-medium text-slate-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <EmptyStateCard
                      title="No portfolios yet"
                      description="Create your first portfolio to unlock snapshots, detective reports, and backtests."
                      ctaLabel="Create Portfolio"
                      ctaHref="/portfolios/new"
                    />
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
