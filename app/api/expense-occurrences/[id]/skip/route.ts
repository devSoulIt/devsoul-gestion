import { NextRequest, NextResponse } from "next/server";
import { FINANCIAL_ROLES, requireRole } from "@/lib/auth/session";
import { OccurrenceError, skipOccurrence } from "@/lib/finance/recurring-expenses";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!reason) return NextResponse.json({ error: "Indicá el motivo" }, { status: 400 });

    return NextResponse.json(await skipOccurrence(id, reason));
  } catch (error) {
    if (error instanceof OccurrenceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/expense-occurrences/:id/skip]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
