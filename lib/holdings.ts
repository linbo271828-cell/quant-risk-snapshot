import type { HoldingsItem } from "./types";

const TICKER_RE = /^[A-Z.\-]{1,12}$/;

export function parseHoldingsText(raw: string, requirePositive = false): HoldingsItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tickerRaw, valueRaw] = line.split(/[, \t]+/).filter(Boolean);
      const ticker = (tickerRaw ?? "").toUpperCase();
      const value = Number(valueRaw);
      if (!TICKER_RE.test(ticker) || !Number.isFinite(value)) return null;
      if (requirePositive && value <= 0) return null;
      return { ticker, value };
    })
    .filter((x): x is HoldingsItem => x != null);
}
