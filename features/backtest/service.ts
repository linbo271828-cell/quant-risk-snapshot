import { db } from "@/lib/db";
import { runBacktest } from "@/lib/backtest";
import type { BacktestFrequency, BacktestStrategy } from "@/lib/types";

export async function runPortfolioBacktest(input: {
  portfolioId: string;
  start: string;
  end: string;
  benchmark?: string;
  frequency?: BacktestFrequency;
  strategy?: BacktestStrategy;
  costBps?: number;
  maxWeight?: number;
  shrinkage?: boolean;
}) {
  return runBacktest({
    portfolioId: input.portfolioId,
    start: input.start,
    end: input.end,
    benchmark: input.benchmark ?? "SPY",
    frequency: input.frequency ?? "MONTHLY",
    strategy: input.strategy ?? "BUY_HOLD",
    costBps: input.costBps ?? 0,
    maxWeight: input.maxWeight,
    shrinkage: Boolean(input.shrinkage),
  });
}

export async function listBacktests(portfolioId: string) {
  const runs = await db.backtestRun.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return runs.map((r) => {
    const metrics = r.metricsJson as Record<string, unknown>;
    return {
      id: r.id,
      portfolioId: r.portfolioId,
      createdAt: r.createdAt,
      startDate: r.startDate,
      endDate: r.endDate,
      benchmark: r.benchmark,
      frequency: r.frequency,
      strategy: r.strategy,
      totalReturn: typeof metrics.totalReturn === "number" ? metrics.totalReturn : 0,
      cagr: typeof metrics.cagr === "number" ? metrics.cagr : 0,
      volAnn: typeof metrics.volAnn === "number" ? metrics.volAnn : 0,
      sharpe: typeof metrics.sharpe === "number" ? metrics.sharpe : 0,
      maxDD: typeof metrics.maxDD === "number" ? metrics.maxDD : 0,
    };
  });
}

export async function getBacktestDetail(backtestId: string) {
  const run = await db.backtestRun.findUnique({
    where: { id: backtestId },
    include: { portfolio: { select: { userId: true } } },
  });
  if (!run) return null;
  return {
    id: run.id,
    portfolioId: run.portfolioId,
    createdAt: run.createdAt,
    startDate: run.startDate,
    endDate: run.endDate,
    benchmark: run.benchmark,
    frequency: run.frequency,
    strategy: run.strategy,
    params: run.paramsJson,
    metrics: run.metricsJson,
    series: run.seriesJson,
    weights: run.weightsJson,
    ownerUserId: run.portfolio.userId,
  };
}
