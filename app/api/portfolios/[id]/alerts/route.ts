import { NextResponse } from "next/server";
import type { AlertRuleType } from "@/lib/types";
import { createAlertRule, listAlertRules } from "@/features/alerts/service";
import { requirePortfolioOwnership, requireUserId } from "@/features/shared/access";
import { asErrorPayload } from "@/features/shared/errors";

const ALERT_TYPES: AlertRuleType[] = ["vol_gt", "maxdd_lt", "var_gt"];

type CreateAlertBody = {
  type?: AlertRuleType;
  threshold?: number;
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    await requirePortfolioOwnership(portfolioId, userId);
    return NextResponse.json(await listAlertRules(portfolioId));
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const portfolioId = params.id;
    const body = (await request.json()) as CreateAlertBody;

    if (!body.type || !ALERT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid alert type." }, { status: 400 });
    }
    if (!Number.isFinite(body.threshold)) {
      return NextResponse.json({ error: "Threshold must be a finite number." }, { status: 400 });
    }

    await requirePortfolioOwnership(portfolioId, userId);
    const created = await createAlertRule(portfolioId, body.type, Number(body.threshold));

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
