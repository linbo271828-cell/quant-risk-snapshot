import { db } from "@/lib/db";
import { runDetectiveReport } from "@/lib/detective";

export async function runPortfolioDetective(input: {
  portfolioId: string;
  analyzeDate?: string;
  benchmark?: string;
  eventWindowDays?: number;
  maxTickers?: number;
}) {
  return runDetectiveReport({
    portfolioId: input.portfolioId,
    analyzeDate: input.analyzeDate,
    benchmark: input.benchmark ?? "SPY",
    eventWindowDays: input.eventWindowDays ?? 5,
    maxTickers: input.maxTickers ?? 5,
  });
}

export async function listDetectiveReports(portfolioId: string) {
  const reports = await db.detectiveReport.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return reports.map((r) => {
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
  });
}

export async function getDetectiveReportDetail(reportId: string) {
  const report = await db.detectiveReport.findUnique({
    where: { id: reportId },
    include: {
      portfolio: { select: { userId: true, id: true, name: true } },
      items: {
        orderBy: { score: "desc" },
        include: { event: { include: { impacts: true } } },
      },
    },
  });
  if (!report) return null;

  const summary = report.summaryJson as Record<string, unknown>;
  const benchmark = report.benchmark.toUpperCase();
  return {
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
      contextWindow:
        typeof summary.contextWindow === "object" && summary.contextWindow != null ? summary.contextWindow : null,
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
  };
}
