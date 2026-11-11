import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";

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

    const { count } = await prisma.invoice.updateMany({
      where: { id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelReason: reason,
        cancelledAt: new Date(),
        cancelledById: auth.session.userId,
      },
    });
    if (count === 0) {
      return NextResponse.json(
        { error: invoice.status === PaymentStatus.PAID ? "La factura ya fue cobrada" : "La factura ya está cancelada" },
        { status: 409 }
      );
    }

    return NextResponse.json(await prisma.invoice.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    console.error("[POST /api/invoices/:id/cancel]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
