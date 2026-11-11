import "server-only";
import { Currency, ExpenseFrequency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAmount } from "./ledger";

export type RecurringExpenseData = {
  name: string;
  amount: number;
  currency: Currency;
  accountId: string;
  categoryId: string;
  frequency: ExpenseFrequency;
  dayOfMonth: number;
  month: number | null;
  autoRecord: boolean;
  startDate: Date;
  notes: string | null;
};

type Parsed = { ok: true; data: RecurringExpenseData } | { ok: false; error: string };

export async function parseRecurringExpense(body: Record<string, unknown>): Promise<Parsed> {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return { ok: false, error: "Indicá el nombre del gasto" };

  const amount = parseAmount(body.amount);
  if (!amount) return { ok: false, error: "El monto debe ser mayor a cero" };

  const frequency = body.frequency === ExpenseFrequency.YEARLY ? ExpenseFrequency.YEARLY : ExpenseFrequency.MONTHLY;
  const dayOfMonth = Number(body.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return { ok: false, error: "El día tiene que estar entre 1 y 31" };
  }
  const month = frequency === ExpenseFrequency.YEARLY ? Number(body.month) : null;
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return { ok: false, error: "Indicá el mes del gasto anual" };
  }

  const [account, category] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: String(body.accountId ?? ""), active: true } }),
    prisma.transactionCategory.findFirst({
      where: { id: String(body.categoryId ?? ""), type: TransactionType.EXPENSE, active: true },
    }),
  ]);
  if (!account) return { ok: false, error: "Cuenta no encontrada" };
  if (!category) return { ok: false, error: "Elegí una categoría de egreso" };

  const currency = body.currency === Currency.USD ? Currency.USD : Currency.ARS;
  if (currency !== account.currency) {
    return { ok: false, error: `La cuenta ${account.name} es en ${account.currency}; el gasto tiene que estar en la misma moneda` };
  }

  const startKey = typeof body.startDate === "string" && body.startDate ? body.startDate.slice(0, 10) : null;
  const startDate = startKey ? new Date(`${startKey}T00:00:00Z`) : new Date();
  if (Number.isNaN(startDate.getTime())) return { ok: false, error: "Fecha de inicio inválida" };

  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;

  return {
    ok: true,
    data: {
      name,
      amount,
      currency,
      accountId: account.id,
      categoryId: category.id,
      frequency,
      dayOfMonth,
      month,
      autoRecord: body.autoRecord === true,
      startDate,
      notes,
    },
  };
}
