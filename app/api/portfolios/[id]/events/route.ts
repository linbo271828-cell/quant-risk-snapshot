import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";

function asPositiveInt(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const portfolioId = params.id;
    const portfolio = await db.portfolio.findUnique({ where: { id: portfolioId }, select: { userId: true } });
    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const ticker = searchParams.get("ticker")?.toUpperCase() ?? undefined;
    const limit = asPositiveInt(searchParams.get("limit"), 25, 100);
    const cursor = searchParams.get("cursor");

    const events = await db.event.findMany({
      where: {
        portfolioId,
        ...(type ? { type: type as "SEC_FILING" | "EARNINGS" | "NEWS" } : {}),
        ...(ticker ? { ticker } : {}),
      },
      orderBy: [{ eventTime: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;
    return NextResponse.json({
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
