import { db } from "./db";

const SEC_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const SEC_SOURCE = "SEC";
const SEC_DEFAULT_FORMS = new Set(["8-K", "10-Q", "10-K", "6-K", "20-F"]);

type SecTickerMapEntry = {
  cik_str?: number;
  ticker?: string;
  title?: string;
};

type SecTickerMapResponse = Record<string, SecTickerMapEntry>;

type SecRecentFilings = {
  form?: string[];
  filingDate?: string[];
  acceptanceDateTime?: string[];
  accessionNumber?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: string[];
};

type SecSubmissionsResponse = {
  filings?: {
    recent?: SecRecentFilings;
  };
};

type SyncEventsResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

function secUserAgent(): string {
  return process.env.SEC_USER_AGENT ?? "QuantRiskSnapshot/1.0 (contact: dev@example.com)";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(url: string, retries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(400 * Math.pow(2, attempt));
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": secUserAgent(),
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`SEC HTTP ${res.status}`);
          continue;
        }
        throw new Error(`SEC HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown SEC fetch error");
    }
  }
  throw lastError ?? new Error("SEC fetch failed");
}

function getTickerMapCache(): Map<string, string> | null {
  const g = globalThis as unknown as { __SEC_TICKER_CIK_MAP__?: Map<string, string> };
  return g.__SEC_TICKER_CIK_MAP__ ?? null;
}

function setTickerMapCache(value: Map<string, string>) {
  const g = globalThis as unknown as { __SEC_TICKER_CIK_MAP__?: Map<string, string> };
  g.__SEC_TICKER_CIK_MAP__ = value;
}

async function getSecTickerToCikMap(): Promise<Map<string, string>> {
  const cached = getTickerMapCache();
  if (cached) return cached;

  const raw = await fetchJsonWithRetry<SecTickerMapResponse>(SEC_TICKER_MAP_URL);
  const map = new Map<string, string>();
  for (const key of Object.keys(raw)) {
    const entry = raw[key];
    const ticker = entry.ticker?.toUpperCase().trim();
    const cik = entry.cik_str != null ? String(entry.cik_str).padStart(10, "0") : null;
    if (!ticker || !cik) continue;
    map.set(ticker, cik);
  }
  setTickerMapCache(map);
  return map;
}

function filingTime(acceptanceDateTime?: string, filingDate?: string): Date | null {
  if (acceptanceDateTime && acceptanceDateTime.length >= 8) {
    const normalized = acceptanceDateTime.replace(/[^\d]/g, "");
    if (normalized.length >= 14) {
      const iso = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T${normalized.slice(8, 10)}:${normalized.slice(10, 12)}:${normalized.slice(12, 14)}Z`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  if (filingDate) {
    const d = new Date(`${filingDate}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function filingUrl(cikPadded: string, accessionNumber?: string, primaryDocument?: string): string {
  if (!accessionNumber || !primaryDocument) return "";
  const cik = String(Number(cikPadded));
  const accession = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${primaryDocument}`;
}

export async function syncSecFilingsForTickers(
  portfolioId: string,
  tickers: string[],
  maxPerTicker = 20,
): Promise<SyncEventsResult> {
  const tickerMap = await getSecTickerToCikMap();
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase().trim())));
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const ticker of unique) {
    const cik = tickerMap.get(ticker);
    if (!cik) {
      skipped += 1;
      continue;
    }

    // SEC asks clients to avoid bursts; keep a small inter-request gap.
    await sleep(200);
    const url = `${SEC_SUBMISSIONS_URL}/CIK${cik}.json`;
    const submissions = await fetchJsonWithRetry<SecSubmissionsResponse>(url);
    const recent = submissions.filings?.recent;
    if (!recent?.form?.length) {
      skipped += 1;
      continue;
    }

    const limit = Math.min(maxPerTicker, recent.form.length);
    for (let i = 0; i < limit; i++) {
      const form = recent.form[i] ?? "";
      if (!SEC_DEFAULT_FORMS.has(form)) continue;
      const eventTime = filingTime(recent.acceptanceDateTime?.[i], recent.filingDate?.[i]);
      if (!eventTime) continue;

      const primaryDocument = recent.primaryDocument?.[i] ?? "";
      const title = `${form}${recent.primaryDocDescription?.[i] ? ` - ${recent.primaryDocDescription[i]}` : ""}`;
      const payload = {
        cik,
        form,
        filingDate: recent.filingDate?.[i] ?? null,
        acceptanceDateTime: recent.acceptanceDateTime?.[i] ?? null,
        accessionNumber: recent.accessionNumber?.[i] ?? null,
        primaryDocument: primaryDocument || null,
        description: recent.primaryDocDescription?.[i] ?? null,
      };
      const upserted = await db.event.upsert({
        where: {
          portfolioId_ticker_type_eventTime_title: {
            portfolioId,
            ticker,
            type: "SEC_FILING",
            eventTime,
            title,
          },
        },
        update: {
          url: filingUrl(cik, recent.accessionNumber?.[i], primaryDocument),
          payloadJson: payload,
          source: SEC_SOURCE,
        },
        create: {
          portfolioId,
          ticker,
          type: "SEC_FILING",
          eventTime,
          title,
          url: filingUrl(cik, recent.accessionNumber?.[i], primaryDocument),
          source: SEC_SOURCE,
          payloadJson: payload,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) inserted += 1;
      else updated += 1;
    }
  }

  return { inserted, updated, skipped };
}
