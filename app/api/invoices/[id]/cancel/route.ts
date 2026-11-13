import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { applyContractCredit, releaseInvoiceAllocations } from "@/lib/billing/payments";
import { formatAmount } from "@/lib/format";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!reason) return NextResponse.json({ error: "Indicá el motivo de la cancelación" }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const { count } = await tx.invoice.updateMany({
        where: { id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelReason: reason,
          cancelledAt: new Date(),
          cancelledById: auth.session.userId,
        },
      });
      if (count === 0) return null;

      const cancelled = await tx.invoice.findUniqueOrThrow({ where: { id } });
      const released = await releaseInvoiceAllocations(tx, id);
      if (released) await applyContractCredit(tx, cancelled.contractId);
      await audit(tx, {
        userId: auth.session.userId,
        action: "invoice.cancel",
        entity: "Invoice",
        entityId: id,
        summary: `Factura ${cancelled.period} de ${formatAmount(Number(cancelled.amount), cancelled.currency)} cancelada: ${reason}`,
        diff: { reason, releasedPaid: Number(cancelled.paidAmount) },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });

    if (!result) {
      return NextResponse.json(
        { error: invoice.status === PaymentStatus.PAID ? "La factura ya fue cobrada: revertí el cobro primero" : "La factura ya está cancelada" },
        { status: 409 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/invoices/:id/cancel]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
