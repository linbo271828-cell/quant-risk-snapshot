import { db } from "@/lib/db";
import type { SnapshotDefaults } from "@/lib/types";

export const TICKER_RE = /^[A-Z.\-]{1,12}$/;

export function validateHoldings(holdings: Array<{ ticker: string; value: number }>): string | null {
  if (!Array.isArray(holdings) || holdings.length === 0) return "At least one holding is required.";
  for (const h of holdings) {
    const t = h.ticker?.toUpperCase().trim();
    if (!TICKER_RE.test(t)) return `Invalid ticker: ${h.ticker}`;
    if (!Number.isFinite(h.value) || h.value <= 0) return `Holding value must be > 0 for ${h.ticker}`;
  }
  return null;
}

export function safeDefaults(raw?: Partial<SnapshotDefaults>): SnapshotDefaults {
  return {
    range: raw?.range ?? "1y",
    benchmark: (raw?.benchmark ?? "SPY").toUpperCase(),
    riskFreeRate: Number.isFinite(raw?.riskFreeRate) ? Number(raw?.riskFreeRate) : 0,
    shrinkage: Boolean(raw?.shrinkage),
  };
}

export async function listUserPortfolios(userId: string) {
  const portfolios = await db.portfolio.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      holdings: true,
      snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return portfolios.map((p) => {
    const latest = p.snapshots[0] ?? null;
    const metrics = latest?.metricsJson as Record<string, unknown> | undefined;
    const lastVol = typeof metrics?.volAnn === "number" ? metrics.volAnn : null;
    return {
      id: p.id,
      name: p.name,
      mode: p.mode,
      holdingCount: p.holdings.length,
      lastSnapshotAt: latest?.createdAt ?? null,
      lastVolAnn: lastVol,
    };
  });
}
