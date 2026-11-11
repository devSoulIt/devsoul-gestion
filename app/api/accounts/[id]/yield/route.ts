import { NextRequest, NextResponse } from "next/server";
import { TransactionSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { ensureCategory, YIELD_CATEGORY_NAME } from "@/lib/finance/adjustments";
import { buildLedgerEntry } from "@/lib/finance/ledger";
import { RateUnavailableError } from "@/lib/finance/rates";
import { dateFromKey, isDateKey, yieldExternalId } from "@/lib/finance/yield";
import { businessDateKey } from "@/lib/dates";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (body.amount === undefined || body.amount === "" || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Indicá un monto válido" }, { status: 400 });
    }
    const dateKey: unknown = body.date || businessDateKey();
    if (!isDateKey(dateKey) || dateKey > businessDateKey()) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const account = await prisma.financialAccount.findFirst({ where: { id, active: true } });
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    const externalId = yieldExternalId(id, dateKey);

    if (amount === 0) {
      await prisma.transaction.deleteMany({ where: { externalId } });
      return NextResponse.json({ date: dateKey, amount: 0, transaction: null });
    }

    const category = await ensureCategory(prisma, YIELD_CATEGORY_NAME, TransactionType.INCOME);
    const entry = await buildLedgerEntry({
      account,
      type: TransactionType.INCOME,
      amount,
      date: dateFromKey(dateKey),
      categoryId: category.id,
      description: "Rendimiento diario",
      source: TransactionSource.YIELD,
      createdById: auth.session.userId,
    });

    const transaction = await prisma.transaction.upsert({
      where: { externalId },
      create: { ...entry, externalId },
      update: { amount: entry.amount, rateToArs: entry.rateToArs, amountArs: entry.amountArs },
    });

    return NextResponse.json({ date: dateKey, amount, transaction });
  } catch (error) {
    if (error instanceof RateUnavailableError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[PUT /api/accounts/[id]/yield]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
