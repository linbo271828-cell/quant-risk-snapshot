import { NextResponse } from "next/server";
import { getSession } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";

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

    const reports = await db.detectiveReport.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      reports.map((r) => {
        const summary = r.summaryJson as Record<string, unknown>;
        return {
          id: r.id,
          portfolioId: r.portfolioId,
          createdAt: r.createdAt,
          analyzeDate: r.analyzeDate,
          benchmark: r.benchmark,
          portfolioReturn: typeof summary.portfolioReturn === "number" ? summary.portfolioReturn : 0,
          abnormalReturn: typeof summary.abnormalReturn === "number" ? summary.abnormalReturn : 0,
        };
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
