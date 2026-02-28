import { alignByIntersection, CACHE_TTL_MS, fetchDailyPrices, getCache, type Series } from "./marketData";
import {
  annualizedVolatility,
  cagr,
  computeReturns,
  covarianceMatrix,
  drawdownSeries,
  normalizeWeights,
  sharpeRatio,
  shrinkCovariance,
  totalReturn,
} from "./math";
import { estimatedTurnover, minVarianceWeights, riskParityWeights } from "./rebalance";
import { db } from "./db";
import type { BacktestFrequency, BacktestStrategy, BacktestMetrics, BacktestSeries } from "./types";

export type RunBacktestInput = {
  portfolioId: string;
  start: string;
  end: string;
  benchmark?: string;
  frequency?: BacktestFrequency;
  strategy?: BacktestStrategy;
  costBps?: number;
  maxWeight?: number;
  shrinkage?: boolean;
};

type WeightsRecord = { date: string; weights: Record<string, number> };

function asIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchAlignedBetween(
  tickers: string[],
  start: string,
  end: string,
): Promise<{ dates: string[]; pricesByTicker: Record<string, number[]> }> {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));
  const cache = getCache();
  const seriesByTicker: Record<string, Series> = {};
  for (const t of unique) {
    const key = `${t}:${start}:${end}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      seriesByTicker[t] = cached.value;
      continue;
    }
    const fetched = await fetchDailyPrices(t, start, end);
    cache.set(key, { value: fetched, expiresAt: Date.now() + CACHE_TTL_MS });
    seriesByTicker[t] = fetched;
  }
  const aligned = alignByIntersection(seriesByTicker);
  if (aligned.dates.length < 2) throw new Error("Not enough overlapping data points for backtest.");
  return aligned;
}

function shouldRebalance(
  prevDate: Date,
  currentDate: Date,
  frequency: BacktestFrequency,
): boolean {
  if (frequency === "WEEKLY") {
    return currentDate.getUTCDay() < prevDate.getUTCDay();
  }
  return (
    currentDate.getUTCFullYear() !== prevDate.getUTCFullYear() ||
    currentDate.getUTCMonth() !== prevDate.getUTCMonth()
  );
}

function computeTargetWeights(
  strategy: BacktestStrategy,
  cov: number[][],
  currentWeights: number[],
  maxWeight?: number,
): number[] {
  if (strategy === "BUY_HOLD") return currentWeights;
  if (strategy === "RISK_PARITY") return riskParityWeights(cov, maxWeight);
  return minVarianceWeights(cov, maxWeight, true);
}

export async function runBacktest(input: RunBacktestInput): Promise<{ backtestId: string }> {
  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
    include: { holdings: true },
  });
  if (!portfolio) throw new Error("Portfolio not found.");
  if (portfolio.holdings.length === 0) throw new Error("Portfolio has no holdings.");

  const frequency = input.frequency ?? "MONTHLY";
  const strategy = input.strategy ?? "BUY_HOLD";
  const benchmark = (input.benchmark ?? "SPY").toUpperCase();
  const costRate = Math.max(0, Number(input.costBps ?? 0)) / 10000;
  const tickers = portfolio.holdings.map((h) => h.ticker.toUpperCase());
  const symbols = Array.from(new Set([...tickers, benchmark]));
  const aligned = await fetchAlignedBetween(symbols, input.start, input.end);
  const dates = aligned.dates;

  const startPrices = tickers.map((t) => aligned.pricesByTicker[t][0] ?? 0);
  const weightsRaw =
    portfolio.mode === "shares"
      ? portfolio.holdings.map((h, i) => h.value * (startPrices[i] ?? 0))
      : portfolio.holdings.map((h) => h.value);
  const initialWeights = normalizeWeights(weightsRaw);

  let shares = tickers.map((t, i) => {
    const px = aligned.pricesByTicker[t][0] ?? 0;
    return px > 0 ? (100 * (initialWeights[i] ?? 0)) / px : 0;
  });

  const returns: number[] = [];
  const equity: number[] = [];
  const rebalances: WeightsRecord[] = [];
  let totalTurnover = 0;
  let totalCost = 0;
  let rebalanceCount = 0;

  const initialEquity = shares.reduce((acc, s, i) => acc + s * (aligned.pricesByTicker[tickers[i]][0] ?? 0), 0);
  equity.push(initialEquity);
  rebalances.push({
    date: dates[0],
    weights: Object.fromEntries(tickers.map((t, i) => [t, initialWeights[i] ?? 0])),
  });

  for (let i = 0; i < dates.length - 1; i++) {
    const pricesNow = tickers.map((t) => aligned.pricesByTicker[t][i] ?? 0);
    const currentEquity = shares.reduce((acc, s, j) => acc + s * pricesNow[j], 0);
    let baseEquity = currentEquity;

    const prevDate = i === 0 ? new Date(`${dates[0]}T00:00:00Z`) : new Date(`${dates[i - 1]}T00:00:00Z`);
    const curDate = new Date(`${dates[i]}T00:00:00Z`);
    const rebalanceTrigger = i > 0 && strategy !== "BUY_HOLD" && shouldRebalance(prevDate, curDate, frequency);

    if (rebalanceTrigger) {
      const windowStart = Math.max(0, i - 63);
      const returnsByTicker: Record<string, number[]> = {};
      for (const ticker of tickers) {
        returnsByTicker[ticker] = computeReturns(aligned.pricesByTicker[ticker].slice(windowStart, i + 1));
      }
      const { matrix } = covarianceMatrix(returnsByTicker);
      const cov = input.shrinkage ? shrinkCovariance(matrix, 0.2) : matrix;
      const currentWeights = pricesNow.map((px, j) => (baseEquity > 0 ? (shares[j] * px) / baseEquity : 0));
      const target = computeTargetWeights(strategy, cov, currentWeights, input.maxWeight);
      const turnover = estimatedTurnover(currentWeights, target);
      const cost = baseEquity * turnover * costRate;
      baseEquity = Math.max(0, baseEquity - cost);

      shares = target.map((w, j) => {
        const px = pricesNow[j];
        return px > 0 ? (baseEquity * w) / px : 0;
      });
      totalTurnover += turnover;
      totalCost += cost;
      rebalanceCount += 1;
      rebalances.push({
        date: dates[i],
        weights: Object.fromEntries(tickers.map((t, j) => [t, target[j] ?? 0])),
      });
    }

    const pricesNext = tickers.map((t) => aligned.pricesByTicker[t][i + 1] ?? 0);
    const nextEquity = shares.reduce((acc, s, j) => acc + s * pricesNext[j], 0);
    const dayRet = baseEquity > 0 ? nextEquity / baseEquity - 1 : 0;
    returns.push(dayRet);
    equity.push(nextEquity);
  }

  const drawdown = drawdownSeries(equity);
  const metrics: BacktestMetrics = {
    totalReturn: totalReturn(returns),
    cagr: cagr(returns),
    volAnn: annualizedVolatility(returns),
    sharpe: sharpeRatio(returns, 0),
    maxDD: Math.min(...drawdown),
    turnover: rebalanceCount > 0 ? totalTurnover / rebalanceCount : 0,
    avgRebalanceCost: rebalanceCount > 0 ? totalCost / rebalanceCount : 0,
  };
  const series: BacktestSeries = {
    dates,
    equity,
    drawdown,
    returns: [null, ...returns],
  };

  const created = await db.backtestRun.create({
    data: {
      portfolioId: input.portfolioId,
      startDate: new Date(`${input.start}T00:00:00Z`),
      endDate: new Date(`${input.end}T00:00:00Z`),
      benchmark,
      frequency,
      strategy,
      paramsJson: {
        start: input.start,
        end: input.end,
        benchmark,
        frequency,
        strategy,
        costBps: input.costBps ?? 0,
        maxWeight: input.maxWeight ?? null,
        shrinkage: Boolean(input.shrinkage),
      },
      metricsJson: metrics,
      seriesJson: series,
      weightsJson: rebalances,
    },
    select: { id: true },
  });

  return { backtestId: created.id };
}

export function defaultBacktestRange(range: "1y" | "3y" = "1y"): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (range === "3y") start.setUTCFullYear(start.getUTCFullYear() - 3);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { start: asIsoDate(start), end: asIsoDate(end) };
}
