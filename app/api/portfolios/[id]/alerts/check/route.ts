import { NextResponse } from "next/server";
import { getSession } from "../../../../../../lib/auth";
import { db } from "../../../../../../lib/db";

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
