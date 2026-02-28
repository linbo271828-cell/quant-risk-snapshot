import { NextResponse } from "next/server";
import { runPortfolioDetective } from "@/features/detective/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

type RunBody = {
  analyzeDate?: string;
  benchmark?: string;
  eventWindowDays?: number;
  maxTickers?: number;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);

    const body = (await request.json().catch(() => ({}))) as RunBody;
    const result = await runPortfolioDetective({
      portfolioId,
      analyzeDate: body.analyzeDate,
      benchmark: body.benchmark ?? "SPY",
      eventWindowDays: body.eventWindowDays ?? 5,
      maxTickers: body.maxTickers ?? 5,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
