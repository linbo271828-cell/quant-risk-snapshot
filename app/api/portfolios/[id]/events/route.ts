import { NextResponse } from "next/server";
import { listPortfolioEvents } from "@/features/events/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

function asPositiveInt(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const ticker = searchParams.get("ticker")?.toUpperCase() ?? undefined;
    const limit = asPositiveInt(searchParams.get("limit"), 25, 100);
    const cursor = searchParams.get("cursor");

    const result = await listPortfolioEvents({
      portfolioId,
      type: (type as "SEC_FILING" | "EARNINGS" | "NEWS" | null) ?? undefined,
      ticker,
      limit,
      cursor,
    });
    return NextResponse.json(result);
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
