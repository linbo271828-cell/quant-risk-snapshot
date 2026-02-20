import {
  annualizedVolatility,
  betaToBenchmark,
  cagr,
  computeReturns,
  concentrationHhi,
  correlationMatrix,
  covarianceMatrix,
  drawdownSeries,
  effectiveN,
  equityCurveFromReturns,
  normalizeWeights,
  portfolioReturns,
  riskContributions,
  rollingVolatility,
  sharpeRatio,
  shrinkCovariance,
  totalReturn,
  varCvar,
} from "./math";
import {
  alignByIntersection,
  CACHE_TTL_MS,
  fetchDailyPrices,
  getCache,
  rangeToDates,
  type Series,
} from "./marketData";
import type {
  HoldingsItem,
  HoldingsUsedRow,
  SnapshotDefaults,
  SnapshotDetail,
  SnapshotMetrics,
  SnapshotRisk,
  SnapshotSeries,
} from "./types";

type FetchAlignedClosesResult = {
  range: string;
  start: string;
  end: string;
  dates: string[];
  pricesByTicker: Record<string, number[]>;
};

export async function fetchAlignedCloses(tickers: string[], range: string): Promise<FetchAlignedClosesResult> {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));
  const { start, end } = rangeToDates(range);
  const cache = getCache();
  const seriesByTicker: Record<string, Series> = {};
  const errors: Record<string, string> = {};

  for (const sym of unique) {
    const key = `${sym}:${start}:${end}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      seriesByTicker[sym] = cached.value;
      continue;
    }
    try {
      const value = await fetchDailyPrices(sym, start, end);
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      seriesByTicker[sym] = value;
    } catch (err) {
      errors[sym] = err instanceof Error ? err.message : `Failed to fetch ${sym}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    const details = Object.entries(errors)
      .map(([sym, msg]) => `${sym}: ${msg}`)
      .join("; ");
    throw new Error(`Snapshot failed due to ticker fetch errors: ${details}`);
  }

  const aligned = alignByIntersection(seriesByTicker);
  if (aligned.dates.length < 2) {
    throw new Error("Not enough overlapping data points across tickers to compute snapshot.");
  }

  return { range, start, end, dates: aligned.dates, pricesByTicker: aligned.pricesByTicker };
}

type ComputeSnapshotInput = {
  portfolioId: string;
  mode: "weights" | "shares";
  holdings: HoldingsItem[];
  defaults: SnapshotDefaults;
  fetched: FetchAlignedClosesResult;
};

export function computeSnapshot(input: ComputeSnapshotInput): Omit<SnapshotDetail, "id" | "createdAt"> {
  const { portfolioId, mode, holdings, defaults, fetched } = input;
  const { dates, pricesByTicker } = fetched;
  const benchmark = defaults.benchmark.toUpperCase();
  const holdTickers = holdings.map((h) => h.ticker.toUpperCase());

  const latestPrices: Record<string, number> = {};
  for (const t of holdTickers) {
    const series = pricesByTicker[t];
    if (!series || series.length === 0) throw new Error(`Missing prices for ${t}`);
    latestPrices[t] = series[series.length - 1];
  }

  const weightsRaw =
    mode === "shares"
      ? holdTickers.map((t) => {
          const shares = holdings.find((h) => h.ticker.toUpperCase() === t)?.value ?? 0;
          return shares * latestPrices[t];
        })
      : holdTickers.map((t) => holdings.find((h) => h.ticker.toUpperCase() === t)?.value ?? 0);
  const weights = normalizeWeights(weightsRaw);
  const weightsByTicker = Object.fromEntries(holdTickers.map((t, i) => [t, weights[i]]));

  const returnsByTicker: Record<string, number[]> = {};
  for (const t of holdTickers) returnsByTicker[t] = computeReturns(pricesByTicker[t]);

  const pReturns = portfolioReturns(returnsByTicker, weightsByTicker);
  const equity = equityCurveFromReturns(pReturns, 100);
  const drawdown = drawdownSeries(equity);
  const rollingVol = rollingVolatility(pReturns, 21);
  const pReturnsWithHeadNull = [null, ...pReturns] as Array<number | null>;

  const benchmarkReturns = pricesByTicker[benchmark] ? computeReturns(pricesByTicker[benchmark]) : [];
  const beta = benchmarkReturns.length === pReturns.length ? betaToBenchmark(pReturns, benchmarkReturns) ?? null : null;

  let { tickers, matrix } = covarianceMatrix(returnsByTicker);
  if (defaults.shrinkage) matrix = shrinkCovariance(matrix, 0.2);
  const corr = correlationMatrix(matrix);
  const rc = riskContributions(weights, matrix);
  const riskContribPct = Object.fromEntries(tickers.map((t, i) => [t, rc[i] ?? 0]));

  const { var95, cvar95 } = varCvar(pReturns, 0.05);
  const hhi = concentrationHhi(weights);
  const neff = effectiveN(weights);

  const metrics: SnapshotMetrics = {
    totalReturn: totalReturn(pReturns),
    cagr: cagr(pReturns),
    volAnn: annualizedVolatility(pReturns),
    sharpe: sharpeRatio(pReturns, defaults.riskFreeRate),
    maxDD: Math.min(...drawdown),
    beta,
    var95,
    cvar95,
    hhi,
    neff,
  };

  const holdingsUsed: HoldingsUsedRow[] = holdTickers.map((t, i) => ({
    ticker: t,
    inputValue: holdings.find((h) => h.ticker.toUpperCase() === t)?.value ?? 0,
    lastPrice: latestPrices[t],
    weight: weights[i],
  }));

  const series: SnapshotSeries = {
    dates,
    equity,
    drawdown,
    rollingVol,
    portfolioReturns: pReturnsWithHeadNull,
  };

  const risk: SnapshotRisk = {
    tickers,
    corrMatrix: corr,
    riskContribPct,
  };

  return {
    portfolioId,
    range: defaults.range,
    benchmark,
    riskFreeRate: defaults.riskFreeRate,
    shrinkage: defaults.shrinkage,
    holdingsUsed,
    metrics,
    series,
    risk,
  };
}
