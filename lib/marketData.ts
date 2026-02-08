/**
 * Market data fetching, caching, and normalization helpers.
 * Uses Yahoo Finance (no API key required).
 * Designed for server-side use only.
 */

export type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

export type Series = { dates: string[]; closes: number[] };
export type CacheEntry = { expiresAt: number; value: Series };

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/* ---------- Cache ---------- */

export function getCache(): Map<string, CacheEntry> {
  const g = globalThis as unknown as { __PRICE_CACHE__?: Map<string, CacheEntry> };
  if (!g.__PRICE_CACHE__) g.__PRICE_CACHE__ = new Map();
  return g.__PRICE_CACHE__;
}

/* ---------- Parsing helpers ---------- */

export function parseTickers(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z.\-]{1,12}$/.test(s));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

function unixToIsoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export function rangeToDates(range: string): { start: string; end: string } {
  const now = new Date();
  const end = toIsoDate(now);

  const d = new Date(now);
  const r = range.toLowerCase();

  if (r === "3m") d.setMonth(d.getMonth() - 3);
  else if (r === "6m") d.setMonth(d.getMonth() - 6);
  else if (r === "1y") d.setFullYear(d.getFullYear() - 1);
  else if (r === "3y") d.setFullYear(d.getFullYear() - 3);
  else d.setFullYear(d.getFullYear() - 1);

  return { start: toIsoDate(d), end };
}

export function isRateLimitMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("rate limit") || m.includes("too many") || m.includes("429");
}

/* ---------- Fetch with exponential backoff ---------- */

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDailyPrices(
  symbol: string,
  start: string,
  end: string,
  maxRetries = 3,
): Promise<Series> {
  const period1 = dateToUnix(start);
  const period2 = dateToUnix(end) + 86400; // include end date

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(500 * Math.pow(2, attempt));
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (res.status === 429) {
      lastError = new Error(`Yahoo Finance rate limit for ${symbol}`);
      continue;
    }

    if (!res.ok) {
      lastError = new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
      continue;
    }

    const data = (await res.json()) as YahooChartResponse;

    if (data.chart?.error) {
      throw new Error(
        `Invalid symbol ${symbol}: ${data.chart.error.description ?? data.chart.error.code ?? "unknown error"}`,
      );
    }

    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp) {
      throw new Error(`No data returned for ${symbol}. Check if the ticker is valid.`);
    }

    const timestamps = result.timestamp;
    // Prefer adjusted close, fall back to regular close
    const rawCloses =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close;

    if (!rawCloses) throw new Error(`No close prices for ${symbol}`);

    // Build date -> close map, skipping nulls and deduplicating by date
    const dateMap = new Map<string, number>();
    for (let i = 0; i < timestamps.length; i++) {
      const close = rawCloses[i];
      if (close == null || !Number.isFinite(close)) continue;
      const d = unixToIsoDate(timestamps[i]);
      dateMap.set(d, close);
    }

    const dates = Array.from(dateMap.keys()).sort();
    const closes = dates.map((d) => dateMap.get(d)!);

    if (dates.length === 0) throw new Error(`No usable data for ${symbol}`);
    return { dates, closes };
  }

  throw lastError ?? new Error(`Failed to fetch ${symbol} after ${maxRetries} retries`);
}

/* ---------- Alignment ---------- */

export function alignByIntersection(
  all: Record<string, Series>,
): { dates: string[]; pricesByTicker: Record<string, number[]> } {
  const tickers = Object.keys(all);
  if (tickers.length === 0) return { dates: [], pricesByTicker: {} };

  const sets = tickers.map((sym) => new Set(all[sym].dates));
  let inter = sets[0];

  for (let i = 1; i < sets.length; i++) {
    const next = new Set<string>();
    for (const x of inter) if (sets[i].has(x)) next.add(x);
    inter = next;
  }

  const dates = Array.from(inter).sort();
  const pricesByTicker: Record<string, number[]> = {};

  for (const sym of tickers) {
    const idx = new Map<string, number>();
    all[sym].dates.forEach((d, i) => idx.set(d, i));
    pricesByTicker[sym] = dates.map((d) => all[sym].closes[idx.get(d)!]);
  }

  return { dates, pricesByTicker };
}
