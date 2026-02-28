import { NextResponse } from "next/server";
import { getSession } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { runDetectiveReport } from "../../../../../../lib/detective";

type RunBody = {
  analyzeDate?: string;
  benchmark?: string;
  eventWindowDays?: number;
  maxTickers?: number;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    const body = (await request.json().catch(() => ({}))) as RunBody;
    const result = await runDetectiveReport({
      portfolioId,
      analyzeDate: body.analyzeDate,
      benchmark: body.benchmark ?? "SPY",
      eventWindowDays: body.eventWindowDays ?? 5,
      maxTickers: body.maxTickers ?? 5,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
