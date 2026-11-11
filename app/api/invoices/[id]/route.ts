import { NextRequest, NextResponse } from "next/server";
import { Currency, PaymentStatus, TransactionSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { INVOICE_CATEGORY_NAME, buildLedgerEntry, parseAmount, parseDate } from "@/lib/finance/ledger";
import { RateUnavailableError, getRateToArs } from "@/lib/finance/rates";
import { buildPayouts, getSplitFor, parseShares } from "@/lib/finance/splits";

type PayInvoiceBody = {
  accountId?: string;
  paymentDate?: string;
  amountReceived?: number;
  shares?: unknown;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: PayInvoiceBody = await req.json().catch(() => ({}));

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    if (invoice.status !== PaymentStatus.PENDING) {
      return NextResponse.json(
        { error: invoice.status === PaymentStatus.PAID ? "La factura ya fue cobrada" : "La factura está cancelada" },
        { status: 400 }
      );
    }
    if (!body.accountId) {
      return NextResponse.json({ error: "Indicá la cuenta donde ingresó el cobro" }, { status: 400 });
    }

    let shares = await getSplitFor(invoice.contractId);
    if (body.shares !== undefined) {
      const parsed = await parseShares(body.shares);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      shares = parsed.shares;
    }

    const account = await prisma.financialAccount.findFirst({ where: { id: body.accountId, active: true } });
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    const paymentDate = body.paymentDate ? parseDate(body.paymentDate) : new Date();
    if (!paymentDate) return NextResponse.json({ error: "Fecha de cobro inválida" }, { status: 400 });

    const amount =
      account.currency === invoice.currency ? Number(invoice.amount) : parseAmount(body.amountReceived);
    if (!amount) {
      return NextResponse.json(
        { error: `Indicá el monto recibido en ${account.currency}` },
        { status: 400 }
      );
    }

    const [invoiceRate, category] = await Promise.all([
      invoice.currency === Currency.ARS ? null : getRateToArs(invoice.currency, paymentDate),
      prisma.transactionCategory.upsert({
        where: { name_type: { name: INVOICE_CATEGORY_NAME, type: TransactionType.INCOME } },
        create: { name: INVOICE_CATEGORY_NAME, type: TransactionType.INCOME },
        update: {},
      }),
    ]);

    const entry = await buildLedgerEntry({
      account,
      type: TransactionType.INCOME,
      amount,
      date: paymentDate,
      categoryId: category.id,
      description: `Factura #${id.slice(-6).toUpperCase()} — ${invoice.period}`,
      source: TransactionSource.INVOICE,
      invoiceId: id,
      createdById: auth.session.userId,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await tx.invoice.updateMany({
        where: { id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID, paymentDate, rateToArs: invoiceRate?.rate ?? null },
      });
      if (count === 0) throw new Error("ALREADY_PAID");
      await tx.transaction.create({ data: entry });
      await tx.payout.createMany({
        data: buildPayouts(
          id,
          { amount: Number(entry.amount), currency: entry.currency, rateToArs: Number(entry.rateToArs) },
          shares
        ),
      });
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: { payouts: true } });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof RateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message === "ALREADY_PAID") {
      return NextResponse.json({ error: "La factura ya fue cobrada" }, { status: 400 });
    }
    console.error("[PATCH /api/invoices/:id]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
