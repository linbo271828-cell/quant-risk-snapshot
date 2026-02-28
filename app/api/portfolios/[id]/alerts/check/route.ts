import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);
    const [rules, latest] = await Promise.all([
      db.alertRule.findMany({ where: { portfolioId }, orderBy: { createdAt: "desc" } }),
      db.snapshot.findFirst({
        where: { portfolioId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!latest) {
      return NextResponse.json({ error: "No snapshot found for this portfolio." }, { status: 400 });
    }

    const metrics = latest.metricsJson as Record<string, unknown>;
    const volAnn = toNumberOrNull(metrics.volAnn);
    const maxDD = toNumberOrNull(metrics.maxDD);
    const var95 = toNumberOrNull(metrics.var95);

    const triggered = rules
      .map((r) => {
        if (r.type === "vol_gt" && volAnn != null && volAnn > r.threshold) {
          return { ruleId: r.id, type: r.type, threshold: r.threshold, value: volAnn };
        }
        if (r.type === "maxdd_lt" && maxDD != null && maxDD < r.threshold) {
          return { ruleId: r.id, type: r.type, threshold: r.threshold, value: maxDD };
        }
        if (r.type === "var_gt" && var95 != null && var95 > r.threshold) {
          return { ruleId: r.id, type: r.type, threshold: r.threshold, value: var95 };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return NextResponse.json({
      snapshotId: latest.id,
      snapshotCreatedAt: latest.createdAt,
      triggered,
    });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
