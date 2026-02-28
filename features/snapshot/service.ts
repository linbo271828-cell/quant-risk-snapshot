import { db } from "@/lib/db";
import { computeSnapshot, fetchAlignedCloses } from "@/lib/snapshot";
import type { SnapshotDefaults } from "@/lib/types";

export function mergeSnapshotDefaults(
  stored: {
    defaultsRange: string;
    defaultsBenchmark: string;
    defaultsRiskFreeRate: number;
    defaultsShrinkage: boolean;
  },
  override?: Partial<SnapshotDefaults>,
): SnapshotDefaults {
  return {
    range: override?.range ?? stored.defaultsRange,
    benchmark: (override?.benchmark ?? stored.defaultsBenchmark).toUpperCase(),
    riskFreeRate:
      override?.riskFreeRate != null ? Number(override.riskFreeRate) : Number(stored.defaultsRiskFreeRate),
    shrinkage: override?.shrinkage != null ? Boolean(override.shrinkage) : Boolean(stored.defaultsShrinkage),
  };
}

export async function runSnapshotForPortfolio(args: {
  portfolio: {
    id: string;
    mode: string;
    holdings: Array<{ ticker: string; value: number }>;
  };
  defaults: SnapshotDefaults;
}) {
  const holdTickers = args.portfolio.holdings.map((h) => h.ticker.toUpperCase());
  const tickers = Array.from(new Set([...holdTickers, args.defaults.benchmark]));
  const fetched = await fetchAlignedCloses(tickers, args.defaults.range);
  return computeSnapshot({
    portfolioId: args.portfolio.id,
    mode: args.portfolio.mode as "weights" | "shares",
    holdings: args.portfolio.holdings.map((h) => ({ ticker: h.ticker, value: h.value })),
    defaults: args.defaults,
    fetched,
  });
}

export async function createSnapshotRecord(args: {
  portfolioId: string;
  defaults: SnapshotDefaults;
  snapshot: ReturnType<typeof computeSnapshot>;
}) {
  return db.snapshot.create({
    data: {
      portfolioId: args.portfolioId,
      range: args.defaults.range,
      benchmark: args.defaults.benchmark,
      riskFreeRate: args.defaults.riskFreeRate,
      shrinkage: args.defaults.shrinkage,
      metricsJson: args.snapshot.metrics,
      seriesJson: args.snapshot.series,
      riskJson: args.snapshot.risk,
      holdingsJson: args.snapshot.holdingsUsed,
    },
  });
}
