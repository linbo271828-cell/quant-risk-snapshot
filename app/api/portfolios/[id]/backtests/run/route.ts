import { NextResponse } from "next/server";
import { runPortfolioBacktest } from "@/features/backtest/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";
import type { BacktestFrequency, BacktestStrategy } from "@/lib/types";

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
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);

    const body = (await request.json().catch(() => ({}))) as RunBacktestBody;
    if (!isIsoDate(body.start) || !isIsoDate(body.end)) {
      return NextResponse.json({ error: "start and end must be YYYY-MM-DD." }, { status: 400 });
    }
    const frequency: BacktestFrequency = body.frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY";
    const strategy: BacktestStrategy =
      body.strategy === "RISK_PARITY" || body.strategy === "MINVAR_QP" ? body.strategy : "BUY_HOLD";
    const result = await runPortfolioBacktest({
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
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
