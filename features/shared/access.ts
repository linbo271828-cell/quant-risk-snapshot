import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AppError } from "./errors";

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError("Sign in required.", 401);
  return userId;
}

export async function requirePortfolioOwnership(portfolioId: string, userId: string) {
  const portfolio = await db.portfolio.findUnique({
    where: { id: portfolioId },
    select: { id: true, userId: true },
  });
  if (!portfolio || portfolio.userId !== userId) throw new AppError("Portfolio not found.", 404);
  return portfolio;
}

export async function requireSnapshotOwnership(snapshotId: string, userId: string) {
  const snapshot = await db.snapshot.findUnique({
    where: { id: snapshotId },
    include: { portfolio: { select: { userId: true } } },
  });
  if (!snapshot || snapshot.portfolio.userId !== userId) throw new AppError("Snapshot not found.", 404);
  return snapshot;
}

export async function requireBacktestOwnership(backtestId: string, userId: string) {
  const run = await db.backtestRun.findUnique({
    where: { id: backtestId },
    include: { portfolio: { select: { userId: true } } },
  });
  if (!run || run.portfolio.userId !== userId) throw new AppError("Backtest not found.", 404);
  return run;
}

export async function requireDetectiveReportOwnership(reportId: string, userId: string) {
  const report = await db.detectiveReport.findUnique({
    where: { id: reportId },
    include: { portfolio: { select: { userId: true } } },
  });
  if (!report || report.portfolio.userId !== userId) throw new AppError("Report not found.", 404);
  return report;
}
