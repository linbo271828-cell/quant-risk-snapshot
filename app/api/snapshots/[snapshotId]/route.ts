import { NextResponse } from "next/server";
import { requireSnapshotOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

export async function GET(_request: Request, { params }: { params: { snapshotId: string } }) {
  try {
    const userId = await requireUserId();
    const snapshotId = params.snapshotId;
    const s = await requireSnapshotOwnership(snapshotId, userId);

    return NextResponse.json({
      id: s.id,
      portfolioId: s.portfolioId,
      createdAt: s.createdAt,
      range: s.range,
      benchmark: s.benchmark,
      riskFreeRate: s.riskFreeRate,
      shrinkage: s.shrinkage,
      holdingsUsed: s.holdingsJson,
      metrics: s.metricsJson,
      series: s.seriesJson,
      risk: s.riskJson,
    });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
