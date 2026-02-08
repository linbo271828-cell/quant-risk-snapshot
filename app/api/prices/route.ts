import { NextResponse } from "next/server";
import {
  alignByIntersection,
  CACHE_TTL_MS,
  fetchDailyPrices,
  getCache,
  isRateLimitMessage,
  parseTickers,
  rangeToDates,
  type Series,
} from "../../../lib/marketData";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tickers = parseTickers(searchParams.get("tickers"));
    const range = searchParams.get("range") ?? "1y";

    if (tickers.length === 0)
      return NextResponse.json({ error: "Provide tickers=AAPL,MSFT,SPY" }, { status: 400 });
    if (tickers.length > 20)
      return NextResponse.json({ error: "Max 20 tickers" }, { status: 400 });

    const { start, end } = rangeToDates(range);
    const cache = getCache();

    const seriesByTicker: Record<string, Series> = {};
    const tickerErrors: Record<string, string> = {};

    for (const sym of tickers) {
      const key = `${sym}:${start}:${end}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        seriesByTicker[sym] = cached.value;
      } else {
        try {
          const value = await fetchDailyPrices(sym, start, end);
          cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
          seriesByTicker[sym] = value;
        } catch (err) {
          tickerErrors[sym] = err instanceof Error ? err.message : `Failed to fetch ${sym}`;
        }
      }
    }

    // If every ticker failed, return error
    if (Object.keys(seriesByTicker).length === 0) {
      const msg = Object.values(tickerErrors).join("; ");
      const status = isRateLimitMessage(msg) ? 429 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const aligned = alignByIntersection(seriesByTicker);
    return NextResponse.json({
      range,
      start,
      end,
      dates: aligned.dates,
      pricesByTicker: aligned.pricesByTicker,
      ...(Object.keys(tickerErrors).length > 0 ? { errors: tickerErrors } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = isRateLimitMessage(msg) ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
