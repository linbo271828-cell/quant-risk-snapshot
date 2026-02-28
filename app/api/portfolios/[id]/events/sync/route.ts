import { NextResponse } from "next/server";
import { syncPortfolioEvents } from "@/features/events/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

type SyncBody = {
  sources?: Array<"SEC" | "EARNINGS" | "NEWS">;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);

    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const sources: Array<"SEC" | "EARNINGS" | "NEWS"> = body.sources?.length
      ? body.sources
      : ["SEC"];
    const result = await syncPortfolioEvents(portfolioId, sources);
    return NextResponse.json(result);
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
