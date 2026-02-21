import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";
import type { AlertRuleType } from "../../../../../lib/types";

const ALERT_TYPES: AlertRuleType[] = ["vol_gt", "maxdd_lt", "var_gt"];

type CreateAlertBody = {
  type?: AlertRuleType;
  threshold?: number;
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
    const rules = await db.alertRule.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rules);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const portfolioId = params.id;
    const body = (await request.json()) as CreateAlertBody;

    if (!body.type || !ALERT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid alert type." }, { status: 400 });
    }
    if (!Number.isFinite(body.threshold)) {
      return NextResponse.json({ error: "Threshold must be a finite number." }, { status: 400 });
    }

    const exists = await db.portfolio.findUnique({ where: { id: portfolioId } });
    if (!exists) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    if (exists.userId !== session.user.id) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }

    const created = await db.alertRule.create({
      data: {
        portfolioId,
        type: body.type,
        threshold: Number(body.threshold),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
