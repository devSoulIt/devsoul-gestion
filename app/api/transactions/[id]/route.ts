import { NextRequest, NextResponse } from "next/server";
import { TransactionSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";

const DELETABLE_SOURCES: TransactionSource[] = [
  TransactionSource.MANUAL,
  TransactionSource.TRANSFER,
  TransactionSource.ADJUSTMENT,
  TransactionSource.YIELD,
];

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }
    if (!DELETABLE_SOURCES.includes(transaction.source)) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar movimientos manuales, transferencias, ajustes o rendimientos" },
        { status: 409 }
      );
    }

    await prisma.transaction.deleteMany({
      where: transaction.transferGroupId ? { transferGroupId: transaction.transferGroupId } : { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/transactions/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
