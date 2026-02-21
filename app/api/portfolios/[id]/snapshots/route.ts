import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";
import { computeSnapshot, fetchAlignedCloses } from "../../../../../lib/snapshot";
import type { SnapshotDefaults } from "../../../../../lib/types";

type SnapshotOverrideBody = Partial<SnapshotDefaults>;

function mergedDefaults(
  stored: {
    defaultsRange: string;
    defaultsBenchmark: string;
    defaultsRiskFreeRate: number;
    defaultsShrinkage: boolean;
  },
  override?: SnapshotOverrideBody
): SnapshotDefaults {
  return {
    range: override?.range ?? stored.defaultsRange,
    benchmark: (override?.benchmark ?? stored.defaultsBenchmark).toUpperCase(),
    riskFreeRate:
      override?.riskFreeRate != null ? Number(override.riskFreeRate) : Number(stored.defaultsRiskFreeRate),
    shrinkage: override?.shrinkage != null ? Boolean(override.shrinkage) : Boolean(stored.defaultsShrinkage),
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const portfolioId = params.id;
    const override = (await request.json().catch(() => ({}))) as SnapshotOverrideBody;
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      include: { holdings: true },
    });
    if (!portfolio) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    if (portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }
    if (portfolio.holdings.length === 0) {
      return NextResponse.json({ error: "Portfolio has no holdings." }, { status: 400 });
    }

    const defaults = mergedDefaults(portfolio, override);
    const holdTickers = portfolio.holdings.map((h) => h.ticker.toUpperCase());
    const tickers = Array.from(new Set([...holdTickers, defaults.benchmark]));

    const fetched = await fetchAlignedCloses(tickers, defaults.range);
    const snapshot = computeSnapshot({
      portfolioId,
      mode: portfolio.mode as "weights" | "shares",
      holdings: portfolio.holdings.map((h) => ({ ticker: h.ticker, value: h.value })),
      defaults,
      fetched,
    });

    const created = await db.snapshot.create({
      data: {
        portfolioId,
        range: defaults.range,
        benchmark: defaults.benchmark,
        riskFreeRate: defaults.riskFreeRate,
        shrinkage: defaults.shrinkage,
        metricsJson: snapshot.metrics,
        seriesJson: snapshot.series,
        riskJson: snapshot.risk,
        holdingsJson: snapshot.holdingsUsed,
      },
    });

    return NextResponse.json({ snapshotId: created.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
