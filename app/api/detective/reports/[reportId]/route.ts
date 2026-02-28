import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";

export async function GET(_request: Request, { params }: { params: { reportId: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const reportId = params.reportId;
    const report = await db.detectiveReport.findUnique({
      where: { id: reportId },
      include: {
        portfolio: { select: { userId: true, id: true, name: true } },
        items: {
          orderBy: { score: "desc" },
          include: {
            event: {
              include: {
                impacts: true,
              },
            },
          },
        },
      },
    });
    if (!report || report.portfolio.userId !== session.user.id) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const summary = report.summaryJson as Record<string, unknown>;
    const benchmark = report.benchmark.toUpperCase();
    return NextResponse.json({
      id: report.id,
      portfolioId: report.portfolioId,
      portfolioName: report.portfolio.name,
      createdAt: report.createdAt,
      analyzeDate: report.analyzeDate,
      benchmark: report.benchmark,
      summary: {
        portfolioReturn: typeof summary.portfolioReturn === "number" ? summary.portfolioReturn : 0,
        benchmarkReturn: typeof summary.benchmarkReturn === "number" ? summary.benchmarkReturn : 0,
        abnormalReturn: typeof summary.abnormalReturn === "number" ? summary.abnormalReturn : 0,
        topDrivers: Array.isArray(summary.topDrivers) ? summary.topDrivers : [],
        contextWindow: typeof summary.contextWindow === "object" && summary.contextWindow != null ? summary.contextWindow : null,
      },
      items: report.items.map((item) => {
        const impact = item.event.impacts.find((i) => i.benchmark.toUpperCase() === benchmark);
        return {
          id: item.id,
          ticker: item.ticker,
          score: item.score,
          explanation: item.explanationJson,
          event: {
            id: item.event.id,
            type: item.event.type,
            eventTime: item.event.eventTime,
            title: item.event.title,
            url: item.event.url,
            source: item.event.source,
          },
          reaction: {
            post1dAbRet: impact?.post1dAbRet ?? null,
            post3dAbRet: impact?.post3dAbRet ?? null,
            post5dAbRet: impact?.post5dAbRet ?? null,
            computedAt: impact?.computedAt ?? null,
          },
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
