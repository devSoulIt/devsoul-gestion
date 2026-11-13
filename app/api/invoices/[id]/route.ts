import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { PaymentError, preparePayment, registerPayment } from "@/lib/billing/payments";
import { paymentErrorResponse } from "@/lib/billing/payment-response";

type PayInvoiceBody = {
  accountId?: string;
  paymentDate?: string;
  amount?: number;
  amountReceived?: number;
  appliedAmount?: number;
  confirmDate?: boolean;
  notes?: string;
  shares?: unknown;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: PayInvoiceBody = await req.json().catch(() => ({}));

    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { contract: { select: { currency: true } } } });
    if (!invoice) throw new PaymentError("Factura no encontrada", 404);
    if (invoice.status !== PaymentStatus.PENDING) {
      throw new PaymentError(
        invoice.status === PaymentStatus.PAID ? "La factura ya fue cobrada" : "La factura está cancelada"
      );
    }

    const pending = Math.round((Number(invoice.amount) - Number(invoice.paidAmount)) * 100) / 100;
    const prepared = await preparePayment(
      {
        contractId: invoice.contractId,
        accountId: body.accountId,
        amount: body.amount ?? body.amountReceived ?? pending,
        appliedAmount: body.appliedAmount,
        date: body.paymentDate,
        confirmDate: body.confirmDate,
        notes: body.notes,
        invoiceIds: [id],
        shares: body.shares,
      },
      auth.session.userId
    );

    await prisma.$transaction((tx) => registerPayment(tx, prepared));
    return NextResponse.json(await prisma.invoice.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    return paymentErrorResponse(error, "PATCH /api/invoices/:id");
  }
}
