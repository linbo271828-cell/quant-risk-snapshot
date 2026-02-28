import { db } from "@/lib/db";
import { syncSecFilingsForTickers } from "@/lib/events";
import { AppError } from "@/features/shared/errors";

export async function syncPortfolioEvents(portfolioId: string, sources: Array<"SEC" | "EARNINGS" | "NEWS"> = ["SEC"]) {
  const portfolio = await db.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true },
  });
  if (!portfolio) throw new AppError("Portfolio not found.", 404);
  if (portfolio.holdings.length === 0) throw new AppError("Portfolio has no holdings.", 400);

  const tickers = portfolio.holdings.map((h) => h.ticker.toUpperCase());
  const result = { inserted: 0, updated: 0, skipped: 0 };
  if (sources.includes("SEC")) {
    const sec = await syncSecFilingsForTickers(portfolioId, tickers);
    result.inserted += sec.inserted;
    result.updated += sec.updated;
    result.skipped += sec.skipped;
  }
  return { ok: true, sources, ...result };
}

export async function listPortfolioEvents(args: {
  portfolioId: string;
  type?: "SEC_FILING" | "EARNINGS" | "NEWS";
  ticker?: string;
  limit?: number;
  cursor?: string | null;
}) {
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? 25), 1), 100);
  const events = await db.event.findMany({
    where: {
      portfolioId: args.portfolioId,
      ...(args.type ? { type: args.type } : {}),
      ...(args.ticker ? { ticker: args.ticker.toUpperCase() } : {}),
    },
    orderBy: [{ eventTime: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  return {
    items: page.map((e) => ({
      id: e.id,
      ticker: e.ticker,
      type: e.type,
      eventTime: e.eventTime,
      title: e.title,
      url: e.url,
      source: e.source,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}
