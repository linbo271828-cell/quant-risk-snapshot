import { alignByIntersection, CACHE_TTL_MS, fetchDailyPrices, getCache, type Series } from "./marketData";
import { normalizeWeights } from "./math";
import { db } from "./db";

export type RunDetectiveInput = {
  portfolioId: string;
  analyzeDate?: string;
  benchmark?: string;
  maxTickers?: number;
  eventWindowDays?: number;
};

type DriverRow = {
  ticker: string;
  weight: number;
  tickerReturn: number;
  contribution: number;
};

function asIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseAnalyzeDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function fetchAlignedClosesBetween(
  tickers: string[],
  start: string,
  end: string,
): Promise<{ dates: string[]; pricesByTicker: Record<string, number[]> }> {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase().trim())));
  const cache = getCache();
  const seriesByTicker: Record<string, Series> = {};

  for (const sym of unique) {
    const key = `${sym}:${start}:${end}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      seriesByTicker[sym] = cached.value;
      continue;
    }
    const value = await fetchDailyPrices(sym, start, end);
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    seriesByTicker[sym] = value;
  }

  const aligned = alignByIntersection(seriesByTicker);
  if (aligned.dates.length < 2) {
    throw new Error("Not enough overlapping data points for detective analysis.");
  }
  return aligned;
}

function findIndexOnOrBeforeDate(dates: string[], targetDateIso: string): number {
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= targetDateIso) return i;
  }
  return -1;
}

function findIndexOnOrAfterDate(dates: string[], targetDateIso: string): number {
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= targetDateIso) return i;
  }
  return -1;
}

function horizonAbnormal(
  pricesTicker: number[],
  pricesBenchmark: number[],
  startIdx: number,
  horizonDays: number,
): number | null {
  const endIdx = startIdx + horizonDays;
  if (startIdx < 0 || endIdx >= pricesTicker.length || endIdx >= pricesBenchmark.length) return null;
  const t0 = pricesTicker[startIdx];
  const t1 = pricesTicker[endIdx];
  const b0 = pricesBenchmark[startIdx];
  const b1 = pricesBenchmark[endIdx];
  if (t0 <= 0 || b0 <= 0) return null;
  return t1 / t0 - 1 - (b1 / b0 - 1);
}

function eventTypeWeight(type: "SEC_FILING" | "EARNINGS" | "NEWS"): number {
  if (type === "EARNINGS") return 1.2;
  if (type === "NEWS") return 0.9;
  return 1;
}

export async function runDetectiveReport(input: RunDetectiveInput): Promise<{ reportId: string }> {
  const portfolio = await db.portfolio.findUnique({
    where: { id: input.portfolioId },
    include: { holdings: true },
  });
  if (!portfolio) throw new Error("Portfolio not found.");
  if (portfolio.holdings.length === 0) throw new Error("Portfolio has no holdings.");

  const analyzeDate = parseAnalyzeDate(input.analyzeDate);
  const analyzeDateIso = asIsoDate(analyzeDate);
  const benchmark = (input.benchmark ?? "SPY").toUpperCase();
  const eventWindowDays = Math.max(1, Math.min(15, Math.trunc(input.eventWindowDays ?? 5)));
  const maxTickers = Math.max(1, Math.min(20, Math.trunc(input.maxTickers ?? 5)));

  const holdTickers = portfolio.holdings.map((h) => h.ticker.toUpperCase());
  const symbols = Array.from(new Set([...holdTickers, benchmark]));
  const startIso = asIsoDate(addDays(analyzeDate, -Math.max(20, eventWindowDays + 10)));
  const endIso = asIsoDate(addDays(analyzeDate, 7));
  const aligned = await fetchAlignedClosesBetween(symbols, startIso, endIso);

  const analyzeIdx = findIndexOnOrBeforeDate(aligned.dates, analyzeDateIso);
  if (analyzeIdx < 1) throw new Error("Analyze date is outside available price history.");
  const windowStartIdx = Math.max(0, analyzeIdx - eventWindowDays);

  const latestPrices = holdTickers.map((t) => aligned.pricesByTicker[t][analyzeIdx] ?? 0);
  const weightsRaw =
    portfolio.mode === "shares"
      ? portfolio.holdings.map((h, i) => h.value * (latestPrices[i] ?? 0))
      : portfolio.holdings.map((h) => h.value);
  const weights = normalizeWeights(weightsRaw);

  const drivers: DriverRow[] = holdTickers.map((ticker, i) => {
    const series = aligned.pricesByTicker[ticker];
    const startPrice = series[windowStartIdx];
    const endPrice = series[analyzeIdx];
    const tickerReturn = startPrice > 0 ? endPrice / startPrice - 1 : 0;
    const contribution = tickerReturn * (weights[i] ?? 0);
    return {
      ticker,
      weight: weights[i] ?? 0,
      tickerReturn,
      contribution,
    };
  });

  const topDrivers = [...drivers]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, maxTickers);
  const topTickerSet = new Set(topDrivers.map((d) => d.ticker));

  const benchmarkSeries = aligned.pricesByTicker[benchmark];
  const benchmarkStart = benchmarkSeries[windowStartIdx];
  const benchmarkEnd = benchmarkSeries[analyzeIdx];
  const benchmarkReturn = benchmarkStart > 0 ? benchmarkEnd / benchmarkStart - 1 : 0;
  const portfolioReturn = drivers.reduce((acc, d) => acc + d.contribution, 0);
  const abnormalReturn = portfolioReturn - benchmarkReturn;

  const lookbackStart = addDays(analyzeDate, -eventWindowDays);
  const events = await db.event.findMany({
    where: {
      portfolioId: input.portfolioId,
      ticker: { in: Array.from(topTickerSet) },
      eventTime: {
        gte: lookbackStart,
        lte: addDays(analyzeDate, 1),
      },
    },
    orderBy: { eventTime: "desc" },
    include: { impacts: true },
  });

  const contributionByTicker = Object.fromEntries(topDrivers.map((d) => [d.ticker, d.contribution]));
  const scored = [];
  for (const event of events) {
    const eventDateIso = asIsoDate(event.eventTime);
    const startIdx = findIndexOnOrAfterDate(aligned.dates, eventDateIso);
    const existingImpact = event.impacts.find((i) => i.benchmark === benchmark);
    const post1dAbRet =
      existingImpact?.post1dAbRet ??
      horizonAbnormal(aligned.pricesByTicker[event.ticker], benchmarkSeries, startIdx, 1);
    const post3dAbRet =
      existingImpact?.post3dAbRet ??
      horizonAbnormal(aligned.pricesByTicker[event.ticker], benchmarkSeries, startIdx, 3);
    const post5dAbRet =
      existingImpact?.post5dAbRet ??
      horizonAbnormal(aligned.pricesByTicker[event.ticker], benchmarkSeries, startIdx, 5);

    await db.eventImpact.upsert({
      where: { eventId_benchmark: { eventId: event.id, benchmark } },
      update: {
        post1dAbRet,
        post3dAbRet,
        post5dAbRet,
        computedAt: new Date(),
      },
      create: {
        eventId: event.id,
        benchmark,
        post1dAbRet,
        post3dAbRet,
        post5dAbRet,
      },
    });

    const recencyDays = Math.max(0, Math.round((analyzeDate.getTime() - event.eventTime.getTime()) / 86400000));
    const recencyScore = 1 / (1 + recencyDays);
    const contributionMagnitude = Math.abs(contributionByTicker[event.ticker] ?? 0);
    const abRetMagnitude = Math.abs(post1dAbRet ?? 0);
    const typeBoost = eventTypeWeight(event.type);
    const score = 0.35 * recencyScore + 0.3 * abRetMagnitude + 0.25 * contributionMagnitude + 0.1 * typeBoost;

    scored.push({
      ticker: event.ticker,
      eventId: event.id,
      score,
      explanationJson: {
        recencyDays,
        abret1d: post1dAbRet ?? 0,
        contribution: contributionByTicker[event.ticker] ?? 0,
        eventType: event.type,
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const focusStart = Math.max(0, analyzeIdx - 10);
  const focusEnd = Math.min(aligned.dates.length - 1, analyzeIdx + 10);
  const contextDates = aligned.dates.slice(focusStart, focusEnd + 1);
  const benchmarkContext = benchmarkSeries.slice(focusStart, focusEnd + 1);
  const summaryJson = {
    analyzeDate: analyzeDateIso,
    benchmark,
    eventWindowDays,
    maxTickers,
    portfolioReturn,
    benchmarkReturn,
    abnormalReturn,
    topDrivers,
    contextWindow: {
      dates: contextDates,
      benchmarkPrices: benchmarkContext,
    },
  };

  const created = await db.detectiveReport.create({
    data: {
      portfolioId: input.portfolioId,
      analyzeDate: new Date(`${analyzeDateIso}T00:00:00Z`),
      benchmark,
      summaryJson,
      items: {
        create: scored.map((s) => ({
          ticker: s.ticker,
          eventId: s.eventId,
          score: s.score,
          explanationJson: s.explanationJson,
        })),
      },
    },
    select: { id: true },
  });

  return { reportId: created.id };
}
