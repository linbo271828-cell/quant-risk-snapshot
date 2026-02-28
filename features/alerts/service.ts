import { db } from "@/lib/db";

export async function listAlertRules(portfolioId: string) {
  return db.alertRule.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAlertRule(portfolioId: string, type: string, threshold: number) {
  return db.alertRule.create({
    data: {
      portfolioId,
      type,
      threshold: Number(threshold),
    },
  });
}
