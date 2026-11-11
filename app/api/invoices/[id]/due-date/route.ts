import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const value = typeof body.dueDate === "string" ? body.dueDate.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const { count } = await prisma.invoice.updateMany({
      where: { id, status: PaymentStatus.PENDING },
      data: { dueDate: new Date(`${value}T00:00:00Z`) },
    });
    if (count === 0) {
      const exists = await prisma.invoice.count({ where: { id } });
      return exists
        ? NextResponse.json({ error: "Solo se puede cambiar la fecha de una factura pendiente" }, { status: 409 })
        : NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    return NextResponse.json(await prisma.invoice.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    console.error("[PATCH /api/invoices/:id/due-date]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
