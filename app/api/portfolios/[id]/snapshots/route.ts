import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SnapshotDefaults } from "@/lib/types";
import {
  createSnapshotRecord,
  mergeSnapshotDefaults,
  runSnapshotForPortfolio,
} from "@/features/snapshot/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

type SnapshotOverrideBody = Partial<SnapshotDefaults>;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);
    const snapshots = await db.snapshot.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
    });

    const list = snapshots.map((s) => {
      const metrics = s.metricsJson as Record<string, unknown>;
      return {
        id: s.id,
        createdAt: s.createdAt,
        range: s.range,
        benchmark: s.benchmark,
        volAnn: typeof metrics.volAnn === "number" ? metrics.volAnn : 0,
        maxDD: typeof metrics.maxDD === "number" ? metrics.maxDD : 0,
        beta: typeof metrics.beta === "number" ? metrics.beta : null,
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    const override = (await request.json().catch(() => ({}))) as SnapshotOverrideBody;
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      include: { holdings: true },
    });
    if (!portfolio) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    if (portfolio.userId !== userId) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    if (portfolio.holdings.length === 0) {
      return NextResponse.json({ error: "Portfolio has no holdings." }, { status: 400 });
    }

    const defaults = mergeSnapshotDefaults(portfolio, override);
    const snapshot = await runSnapshotForPortfolio({ portfolio, defaults });
    const created = await createSnapshotRecord({ portfolioId, defaults, snapshot });

    return NextResponse.json({ snapshotId: created.id }, { status: 201 });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
