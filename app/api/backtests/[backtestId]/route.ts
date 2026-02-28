import { NextResponse } from "next/server";
import { getBacktestDetail } from "@/features/backtest/service";
import { requireBacktestOwnership, requireUserId } from "@/features/shared/access";
import { AppError, asErrorPayload } from "@/features/shared/errors";

export async function GET(_request: Request, { params }: { params: { backtestId: string } }) {
  try {
    const userId = await requireUserId();
    const backtestId = params.backtestId;
    await requireBacktestOwnership(backtestId, userId);
    const run = await getBacktestDetail(backtestId);
    if (!run) throw new AppError("Backtest not found.", 404);
    return NextResponse.json({
      id: run.id,
      portfolioId: run.portfolioId,
      createdAt: run.createdAt,
      startDate: run.startDate,
      endDate: run.endDate,
      benchmark: run.benchmark,
      frequency: run.frequency,
      strategy: run.strategy,
      params: run.params,
      metrics: run.metrics,
      series: run.series,
      weights: run.weights,
    });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
