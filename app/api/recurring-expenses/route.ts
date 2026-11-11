import { NextRequest, NextResponse } from "next/server";
import { OccurrenceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { parseRecurringExpense } from "@/lib/finance/recurring-expense-input";
import { nextDueDate } from "@/lib/finance/recurring-expenses";

export async function GET() {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const [expenses, pending] = await Promise.all([
      prisma.recurringExpense.findMany({
        where: { active: true },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfMonth: "asc" }, { name: "asc" }],
      }),
      prisma.expenseOccurrence.findMany({
        where: { status: OccurrenceStatus.PENDING },
        include: {
          recurringExpense: {
            select: { id: true, name: true, currency: true, accountId: true, account: { select: { name: true } } },
          },
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    return NextResponse.json({
      expenses: expenses.map((e) => ({ ...e, nextDueDate: nextDueDate(e) })),
      pending,
    });
  } catch (error) {
    console.error("[GET /api/recurring-expenses]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseRecurringExpense(await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const expense = await prisma.recurringExpense.create({ data: parsed.data });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("[POST /api/recurring-expenses]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
