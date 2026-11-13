import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { preparePayment, registerPayment, type PaymentRequest } from "@/lib/billing/payments";
import { paymentErrorResponse } from "@/lib/billing/payment-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId") ?? undefined;
    const contractId = searchParams.get("contractId") ?? undefined;
    const includeReversed = searchParams.get("includeReversed") === "true";

    const payments = await prisma.payment.findMany({
      where: {
        ...(clientId && { clientId }),
        ...(contractId && { contractId }),
        ...(!includeReversed && { reversedAt: null }),
      },
      include: {
        account: { select: { id: true, name: true, currency: true } },
        contract: { select: { id: true, client: { select: { companyName: true } }, software: { select: { name: true } } } },
        allocations: { select: { amount: true, invoice: { select: { id: true, period: true } } } },
        createdBy: { select: { name: true } },
        reversedBy: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("[GET /api/payments]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const body: PaymentRequest = await req.json().catch(() => ({}));
    const prepared = await preparePayment(body, auth.session.userId);
    const payment = await prisma.$transaction((tx) => registerPayment(tx, prepared));
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return paymentErrorResponse(error, "POST /api/payments");
  }
}
