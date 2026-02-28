import { NextResponse } from "next/server";
import { getSession } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { syncSecFilingsForTickers } from "../../../../../../lib/events";

type SyncBody = {
  sources?: Array<"SEC" | "EARNINGS" | "NEWS">;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const portfolioId = params.id;
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      include: { holdings: true },
    });
    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }
    if (portfolio.holdings.length === 0) {
      return NextResponse.json({ error: "Portfolio has no holdings." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const sources = body.sources?.length ? body.sources : ["SEC"];
    const tickers = portfolio.holdings.map((h) => h.ticker.toUpperCase());
    const result = { inserted: 0, updated: 0, skipped: 0 };

    if (sources.includes("SEC")) {
      const sec = await syncSecFilingsForTickers(portfolioId, tickers);
      result.inserted += sec.inserted;
      result.updated += sec.updated;
      result.skipped += sec.skipped;
    }

    return NextResponse.json({ ok: true, sources, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
