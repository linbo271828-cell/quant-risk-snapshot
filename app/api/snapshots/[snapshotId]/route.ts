import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

export async function GET(_request: Request, { params }: { params: { snapshotId: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const snapshotId = params.snapshotId;
    const s = await db.snapshot.findUnique({
      where: { id: snapshotId },
      include: { portfolio: { select: { userId: true } } },
    });
    if (!s) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
    if (s.portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
    }

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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
