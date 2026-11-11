import { NextRequest, NextResponse } from "next/server";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { parseAmount, parseDate } from "@/lib/finance/ledger";
import { OccurrenceError, recordOccurrence } from "@/lib/finance/recurring-expenses";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const amount = parseAmount(body.amount);
    if (!amount) return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
    const date = body.date ? parseDate(body.date) : new Date();
    if (!date) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    if (!body.accountId) return NextResponse.json({ error: "Indicá la cuenta" }, { status: 400 });

    const occurrence = await recordOccurrence(id, {
      amount,
      accountId: String(body.accountId),
      date,
      createdById: auth.session.userId,
    });
    return NextResponse.json(occurrence);
  } catch (error) {
    if (error instanceof OccurrenceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/expense-occurrences/:id/confirm]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
