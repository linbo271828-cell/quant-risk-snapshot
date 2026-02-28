import { NextResponse } from "next/server";
import { getSession } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";
import { runBacktest } from "../../../../../../lib/backtest";
import type { BacktestFrequency, BacktestStrategy } from "../../../../../../lib/types";

type RunBacktestBody = {
  start?: string;
  end?: string;
  benchmark?: string;
  frequency?: BacktestFrequency;
  strategy?: BacktestStrategy;
  costBps?: number;
  maxWeight?: number;
  shrinkage?: boolean;
};

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

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

    const body = (await request.json().catch(() => ({}))) as RunBacktestBody;
    if (!isIsoDate(body.start) || !isIsoDate(body.end)) {
      return NextResponse.json({ error: "start and end must be YYYY-MM-DD." }, { status: 400 });
    }
    const frequency: BacktestFrequency = body.frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY";
    const strategy: BacktestStrategy =
      body.strategy === "RISK_PARITY" || body.strategy === "MINVAR_QP" ? body.strategy : "BUY_HOLD";
    const result = await runBacktest({
      portfolioId,
      start: body.start,
      end: body.end,
      benchmark: body.benchmark ?? "SPY",
      frequency,
      strategy,
      costBps: body.costBps ?? 0,
      maxWeight: body.maxWeight,
      shrinkage: Boolean(body.shrinkage),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
