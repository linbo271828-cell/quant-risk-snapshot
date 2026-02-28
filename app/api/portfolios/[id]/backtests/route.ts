import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";

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

    const runs = await db.backtestRun.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      runs.map((r) => {
        const metrics = r.metricsJson as Record<string, unknown>;
        return {
          id: r.id,
          portfolioId: r.portfolioId,
          createdAt: r.createdAt,
          startDate: r.startDate,
          endDate: r.endDate,
          benchmark: r.benchmark,
          frequency: r.frequency,
          strategy: r.strategy,
          totalReturn: typeof metrics.totalReturn === "number" ? metrics.totalReturn : 0,
          cagr: typeof metrics.cagr === "number" ? metrics.cagr : 0,
          volAnn: typeof metrics.volAnn === "number" ? metrics.volAnn : 0,
          sharpe: typeof metrics.sharpe === "number" ? metrics.sharpe : 0,
          maxDD: typeof metrics.maxDD === "number" ? metrics.maxDD : 0,
        };
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
