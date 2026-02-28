import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

export async function GET(_request: Request, { params }: { params: { backtestId: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const backtestId = params.backtestId;
    const run = await db.backtestRun.findUnique({
      where: { id: backtestId },
      include: { portfolio: { select: { userId: true } } },
    });
    if (!run || run.portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Backtest not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: run.id,
      portfolioId: run.portfolioId,
      createdAt: run.createdAt,
      startDate: run.startDate,
      endDate: run.endDate,
      benchmark: run.benchmark,
      frequency: run.frequency,
      strategy: run.strategy,
      params: run.paramsJson,
      metrics: run.metricsJson,
      series: run.seriesJson,
      weights: run.weightsJson,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
