import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db";

export async function GET(request: Request, { params }: { params: { snapshotId: string } }) {
  try {
    const snapshotId = params.snapshotId;
    const fmt = new URL(request.url).searchParams.get("fmt") ?? "json";
    const s = await db.snapshot.findUnique({ where: { id: snapshotId } });
    if (!s) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });

    const detail = {
      id: s.id,
      portfolioId: s.portfolioId,
      createdAt: s.createdAt,
      range: s.range,
      benchmark: s.benchmark,
      riskFreeRate: s.riskFreeRate,
      shrinkage: s.shrinkage,
      holdingsUsed: s.holdingsJson,
      metrics: s.metricsJson,
      series: s.seriesJson,
      risk: s.riskJson,
    };

    if (fmt === "json") return NextResponse.json(detail);
    if (fmt !== "csv") {
      return NextResponse.json({ error: "fmt must be json or csv" }, { status: 400 });
    }

    const series = s.seriesJson as {
      dates: string[];
      equity: number[];
      drawdown: number[];
      rollingVol: Array<number | null>;
      portfolioReturns: Array<number | null>;
    };

    const header = ["date", "equity", "drawdown", "rollingVol", "portfolioReturn"];
    const rows = series.dates.map((date, i) => [
      date,
      series.equity[i] ?? "",
      series.drawdown[i] ?? "",
      series.rollingVol[i] ?? "",
      series.portfolioReturns[i] ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="snapshot-${snapshotId}.csv"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
