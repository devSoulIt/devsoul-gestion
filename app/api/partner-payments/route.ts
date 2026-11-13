import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import {
  getPartnerBalances,
  preparePartnerPayment,
  registerPartnerPayment,
  type PartnerPaymentRequest,
} from "@/lib/finance/partner-payments";
import { paymentErrorResponse } from "@/lib/billing/payment-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const [payments, balances] = await Promise.all([
      prisma.partnerPayment.findMany({
        where: { ...(userId && { userId }) },
        include: {
          user: { select: { id: true, name: true } },
          account: { select: { id: true, name: true, currency: true } },
          createdBy: { select: { name: true } },
          reversedBy: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      getPartnerBalances(),
    ]);

    return NextResponse.json({ payments, balances });
  } catch (error) {
    console.error("[GET /api/partner-payments]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const body: PartnerPaymentRequest = await req.json().catch(() => ({}));
    const prepared = await preparePartnerPayment(body, auth.session.userId);
    const payment = await prisma.$transaction((tx) => registerPartnerPayment(tx, prepared));
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return paymentErrorResponse(error, "POST /api/partner-payments");
  }
}
