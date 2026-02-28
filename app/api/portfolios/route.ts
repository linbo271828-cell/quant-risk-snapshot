import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SnapshotDefaults } from "@/lib/types";
import { listUserPortfolios, safeDefaults, validateHoldings } from "@/features/portfolio/service";
import { requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

type CreatePortfolioBody = {
  name?: string;
  mode?: "shares" | "weights";
  holdings?: Array<{ ticker: string; value: number }>;
  defaults?: Partial<SnapshotDefaults>;
};

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await listUserPortfolios(userId));
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
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
        userId,
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
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
