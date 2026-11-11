import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { generateExpenseOccurrences } from "@/lib/finance/recurring-expenses";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await generateExpenseOccurrences();
    console.log(
      `[cron/expenses] ${result.today}: ${result.created.length} creados, ${result.skipped} omitidos, ${result.errors.length} errores`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/cron/expenses]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
