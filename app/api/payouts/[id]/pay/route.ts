import { NextRequest, NextResponse } from "next/server";
import { PayoutStatus, TransactionSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { buildLedgerEntry, parseAmount, parseDate } from "@/lib/finance/ledger";
import { RateUnavailableError } from "@/lib/finance/rates";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { user: { select: { name: true } }, invoice: { select: { period: true } } },
    });
    if (!payout || !payout.userId) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    if (payout.status !== PayoutStatus.PENDING) {
      return NextResponse.json({ error: "Este pago ya fue registrado" }, { status: 409 });
    }

    const account = await prisma.financialAccount.findFirst({ where: { id: String(body.accountId ?? ""), active: true } });
    if (!account) return NextResponse.json({ error: "Indicá la cuenta desde la que se pagó" }, { status: 400 });

    const date = body.date ? parseDate(body.date) : new Date();
    if (!date) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

    const amount = account.currency === payout.currency ? Number(payout.amount) : parseAmount(body.amountPaid);
    if (!amount) {
      return NextResponse.json({ error: `Indicá el monto pagado en ${account.currency}` }, { status: 400 });
    }

    const entry = await buildLedgerEntry({
      account,
      type: TransactionType.PARTNER_PAYOUT,
      amount,
      date,
      description: `Pago a ${payout.user?.name ?? "socio"} — ${payout.invoice.period}`,
      source: TransactionSource.PAYOUT,
      createdById: auth.session.userId,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({ data: entry });
      const { count } = await tx.payout.updateMany({
        where: { id, status: PayoutStatus.PENDING },
        data: { status: PayoutStatus.PAID, paidAt: date, transactionId: transaction.id },
      });
      if (count === 0) throw new Error("ALREADY_PAID");
      return tx.payout.findUniqueOrThrow({ where: { id } });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof RateUnavailableError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Error && error.message === "ALREADY_PAID") {
      return NextResponse.json({ error: "Este pago ya fue registrado" }, { status: 409 });
    }
    console.error("[POST /api/payouts/:id/pay]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
