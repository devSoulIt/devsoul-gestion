import { NextRequest, NextResponse } from "next/server";
import { TransactionSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { businessDateKey, currentPeriod, isValidPeriod, periodBounds } from "@/lib/dates";
import { yieldExternalId } from "@/lib/finance/yield";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const monthParam = req.nextUrl.searchParams.get("month");
    const month = monthParam && isValidPeriod(monthParam) ? monthParam : currentPeriod();
    const { start, end } = periodBounds(month);
    const today = businessDateKey();

    const yieldAccounts = await prisma.financialAccount.findMany({
      where: { active: true, earnsYield: true },
      select: { id: true, name: true, currency: true },
      orderBy: { createdAt: "asc" },
    });

    const [rows, todayRows] = await Promise.all([
      prisma.transaction.findMany({
        where: { source: TransactionSource.YIELD, date: { gte: start, lt: end } },
        select: { id: true, accountId: true, amount: true, amountArs: true, currency: true, date: true, externalId: true },
        orderBy: { date: "desc" },
      }),
      prisma.transaction.findMany({
        where: { externalId: { in: yieldAccounts.map((a) => yieldExternalId(a.id, today)) } },
        select: { accountId: true, amount: true },
      }),
    ]);

    const todayByAccount = new Map(todayRows.map((t) => [t.accountId, Number(t.amount)]));
    const totalArs = Math.round(rows.reduce((acc, r) => acc + Number(r.amountArs), 0) * 100) / 100;

    return NextResponse.json({
      month,
      today,
      totalArs,
      days: rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        date: r.date.toISOString().slice(0, 10),
        amount: Number(r.amount),
        amountArs: Number(r.amountArs),
        currency: r.currency,
        daily: r.externalId !== null,
      })),
      accounts: yieldAccounts.map((a) => ({ ...a, todayAmount: todayByAccount.get(a.id) ?? null })),
    });
  } catch (error) {
    console.error("[GET /api/accounts/yield]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
