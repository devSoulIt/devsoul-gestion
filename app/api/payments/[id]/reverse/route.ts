import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { reversePayment } from "@/lib/billing/payments";
import { parseReason, paymentErrorResponse } from "@/lib/billing/payment-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = parseReason(body.reason);
    if (!reason) return NextResponse.json({ error: "Indicá el motivo" }, { status: 400 });

    await prisma.$transaction((tx) => reversePayment(tx, id, reason, auth.session.userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return paymentErrorResponse(error, "POST /api/payments/:id/reverse");
  }
}
