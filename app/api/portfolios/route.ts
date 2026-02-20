import { NextResponse } from "next/server";
import { db } from "../../../lib/db";
import type { SnapshotDefaults } from "../../../lib/types";

const TICKER_RE = /^[A-Z.\-]{1,12}$/;

type CreatePortfolioBody = {
  name?: string;
  mode?: "shares" | "weights";
  holdings?: Array<{ ticker: string; value: number }>;
  defaults?: Partial<SnapshotDefaults>;
};

function validateHoldings(holdings: Array<{ ticker: string; value: number }>): string | null {
  if (!Array.isArray(holdings) || holdings.length === 0) return "At least one holding is required.";
  for (const h of holdings) {
    const t = h.ticker?.toUpperCase().trim();
    if (!TICKER_RE.test(t)) return `Invalid ticker: ${h.ticker}`;
    if (!Number.isFinite(h.value) || h.value <= 0) return `Holding value must be > 0 for ${h.ticker}`;
  }
  return null;
}

function safeDefaults(raw?: Partial<SnapshotDefaults>): SnapshotDefaults {
  return {
    range: raw?.range ?? "1y",
    benchmark: (raw?.benchmark ?? "SPY").toUpperCase(),
    riskFreeRate: Number.isFinite(raw?.riskFreeRate) ? Number(raw?.riskFreeRate) : 0,
    shrinkage: Boolean(raw?.shrinkage),
  };
}

export async function GET() {
  try {
    const portfolios = await db.portfolio.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        holdings: true,
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const list = portfolios.map((p) => {
      const latest = p.snapshots[0] ?? null;
      const metrics = latest?.metricsJson as Record<string, unknown> | undefined;
      const lastVol = typeof metrics?.volAnn === "number" ? metrics.volAnn : null;
      return {
        id: p.id,
        name: p.name,
        mode: p.mode,
        holdingCount: p.holdings.length,
        lastSnapshotAt: latest?.createdAt ?? null,
        lastVolAnn: lastVol,
      };
    });

    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePortfolioBody;
    const name = body.name?.trim();
    const mode = body.mode;
    const holdings = body.holdings ?? [];

    if (!name) return NextResponse.json({ error: "Portfolio name is required." }, { status: 400 });
    if (mode !== "shares" && mode !== "weights") {
      return NextResponse.json({ error: "Mode must be 'shares' or 'weights'." }, { status: 400 });
    }
    const validation = validateHoldings(holdings);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const defaults = safeDefaults(body.defaults);

    const created = await db.portfolio.create({
      data: {
        name,
        mode,
        defaultsRange: defaults.range,
        defaultsBenchmark: defaults.benchmark,
        defaultsRiskFreeRate: defaults.riskFreeRate,
        defaultsShrinkage: defaults.shrinkage,
        holdings: {
          create: holdings.map((h) => ({
            ticker: h.ticker.toUpperCase().trim(),
            value: Number(h.value),
          })),
        },
      },
    });

    return NextResponse.json({ portfolioId: created.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
