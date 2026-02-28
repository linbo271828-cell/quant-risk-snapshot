import { NextResponse } from "next/server";
import { getDetectiveReportDetail } from "@/features/detective/service";
import { requireDetectiveReportOwnership, requireUserId } from "@/features/shared/access";
import { AppError, asErrorPayload } from "@/features/shared/errors";

export async function GET(_request: Request, { params }: { params: { reportId: string } }) {
  try {
    const userId = await requireUserId();
    const reportId = params.reportId;
    await requireDetectiveReportOwnership(reportId, userId);
    const report = await getDetectiveReportDetail(reportId);
    if (!report) throw new AppError("Report not found.", 404);
    return NextResponse.json(report);
  } catch (err) {
    const payload = asErrorPayload(err);
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }
}
