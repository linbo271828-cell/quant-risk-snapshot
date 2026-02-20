import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import type { SnapshotDefaults } from "../../../../lib/types";

const TICKER_RE = /^[A-Z.\-]{1,12}$/;

type PatchPortfolioBody = {
  name?: string;
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

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const p = await db.portfolio.findUnique({
      where: { id },
      include: {
        holdings: { orderBy: { ticker: "asc" } },
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!p) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });

    const latest = p.snapshots[0] ?? null;
    const metrics = latest?.metricsJson as Record<string, unknown> | undefined;
    const latestSnapshot =
      latest == null
        ? null
        : {
            id: latest.id,
            createdAt: latest.createdAt,
            range: latest.range,
            benchmark: latest.benchmark,
            volAnn: typeof metrics?.volAnn === "number" ? metrics.volAnn : 0,
            maxDD: typeof metrics?.maxDD === "number" ? metrics.maxDD : 0,
            beta: typeof metrics?.beta === "number" ? metrics.beta : null,
          };

    return NextResponse.json({
      id: p.id,
      name: p.name,
      mode: p.mode,
      createdAt: p.createdAt,
      holdings: p.holdings.map((h) => ({ id: h.id, ticker: h.ticker, value: h.value })),
      defaults: {
        range: p.defaultsRange,
        benchmark: p.defaultsBenchmark,
        riskFreeRate: p.defaultsRiskFreeRate,
        shrinkage: p.defaultsShrinkage,
      },
      latestSnapshot,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = (await request.json()) as PatchPortfolioBody;
    const updateData: Record<string, unknown> = {};

    if (body.name != null) {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      updateData.name = name;
    }
    if (body.defaults != null) {
      if (body.defaults.range != null) updateData.defaultsRange = body.defaults.range;
      if (body.defaults.benchmark != null) updateData.defaultsBenchmark = body.defaults.benchmark.toUpperCase();
      if (body.defaults.riskFreeRate != null) updateData.defaultsRiskFreeRate = Number(body.defaults.riskFreeRate);
      if (body.defaults.shrinkage != null) updateData.defaultsShrinkage = Boolean(body.defaults.shrinkage);
    }

    await db.$transaction(async (tx) => {
      const exists = await tx.portfolio.findUnique({ where: { id } });
      if (!exists) throw new Error("Portfolio not found.");
      await tx.portfolio.update({ where: { id }, data: updateData });

      if (body.holdings != null) {
        const validation = validateHoldings(body.holdings);
        if (validation) throw new Error(validation);
        await tx.holding.deleteMany({ where: { portfolioId: id } });
        await tx.holding.createMany({
          data: body.holdings.map((h) => ({
            portfolioId: id,
            ticker: h.ticker.toUpperCase().trim(),
            value: Number(h.value),
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    await db.portfolio.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg.includes("Record to delete does not exist") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
