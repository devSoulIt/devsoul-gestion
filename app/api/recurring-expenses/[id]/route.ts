import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { parseRecurringExpense } from "@/lib/finance/recurring-expense-input";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const existing = await prisma.recurringExpense.findFirst({ where: { id, active: true } });
    if (!existing) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

    const parsed = await parseRecurringExpense(await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    return NextResponse.json(await prisma.recurringExpense.update({ where: { id }, data: parsed.data }));
  } catch (error) {
    console.error("[PUT /api/recurring-expenses/:id]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { count } = await prisma.recurringExpense.updateMany({ where: { id, active: true }, data: { active: false } });
    if (count === 0) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/recurring-expenses/:id]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
