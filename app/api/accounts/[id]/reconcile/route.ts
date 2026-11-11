import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { getAccountBalance } from "@/lib/finance/balances";
import {
  AdjustmentError,
  adjustmentDiff,
  adjustmentEntry,
  parseTreatment,
  validateTreatment,
} from "@/lib/finance/adjustments";
import { RateUnavailableError } from "@/lib/finance/rates";
import { dateFromKey, isDateKey } from "@/lib/finance/yield";
import { businessDateKey } from "@/lib/dates";

function parseBalance(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const current = await getAccountBalance(prisma, id);
    if (!current) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    const realBalance = parseBalance(req.nextUrl.searchParams.get("realBalance"));
    return NextResponse.json({
      systemBalance: current.balance,
      realBalance,
      diff: realBalance === null ? null : adjustmentDiff(current.balance, realBalance),
    });
  } catch (error) {
    console.error("[GET /api/accounts/[id]/reconcile]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const realBalance = parseBalance(body.realBalance);
    if (realBalance === null) return NextResponse.json({ error: "Indicá el saldo real" }, { status: 400 });

    const treatment = parseTreatment(body.treatment ?? "ADJUSTMENT");
    if (!treatment) return NextResponse.json({ error: "Tratamiento inválido" }, { status: 400 });

    const dateKey: unknown = body.date || businessDateKey();
    if (!isDateKey(dateKey) || dateKey > businessDateKey()) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const date = dateFromKey(dateKey);

    const result = await prisma.$transaction(async (tx) => {
      const current = await getAccountBalance(tx, id);
      if (!current || !current.account.active) throw new AdjustmentError("Cuenta no encontrada", 404);

      const diff = adjustmentDiff(current.balance, realBalance);
      const invalid = diff !== 0 ? validateTreatment(diff, treatment) : null;
      if (invalid) throw new AdjustmentError(invalid);

      const transaction =
        diff === 0
          ? null
          : await tx.transaction.create({
              data: {
                ...(await adjustmentEntry(tx, {
                  account: current.account,
                  diff,
                  treatment,
                  categoryId: body.categoryId ? String(body.categoryId) : null,
                  date,
                  userId: auth.session.userId,
                })),
                reconciled: true,
              },
            });

      await tx.transaction.updateMany({
        where: { accountId: id, date: { lte: date }, reconciled: false },
        data: { reconciled: true },
      });
      await tx.financialAccount.update({
        where: { id },
        data: { reconciledAt: new Date(), reconciledBalance: realBalance },
      });

      return { systemBalance: current.balance, realBalance, diff, transaction };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdjustmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RateUnavailableError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[POST /api/accounts/[id]/reconcile]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
