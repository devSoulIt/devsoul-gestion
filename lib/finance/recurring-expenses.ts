import "server-only";
import {
  ExpenseFrequency,
  OccurrenceStatus,
  Prisma,
  TransactionSource,
  TransactionType,
  type RecurringExpense,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKey, dueDateKey, periodDueDate } from "@/lib/dates";
import { buildLedgerEntry } from "./ledger";
import { RateUnavailableError } from "./rates";

type Schedule = Pick<RecurringExpense, "frequency" | "dayOfMonth" | "month">;

export function occurrenceFor(expense: Schedule, todayKey: string) {
  const year = todayKey.slice(0, 4);
  if (expense.frequency === ExpenseFrequency.YEARLY) {
    const month = String(expense.month ?? 1).padStart(2, "0");
    return { period: year, dueDate: periodDueDate(`${year}-${month}`, expense.dayOfMonth) };
  }
  const period = todayKey.slice(0, 7);
  return { period, dueDate: periodDueDate(period, expense.dayOfMonth) };
}

export function nextDueDate(expense: Schedule, todayKey: string = businessDateKey()) {
  const current = occurrenceFor(expense, todayKey).dueDate;
  if (dueDateKey(current) >= todayKey) return current;
  const d = new Date(`${todayKey}T00:00:00Z`);
  if (expense.frequency === ExpenseFrequency.YEARLY) d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return occurrenceFor(expense, dueDateKey(d)).dueDate;
}

export type ExpenseRunResult = {
  today: string;
  created: { id: string; name: string; autoRecorded: boolean }[];
  skipped: number;
  errors: { name: string; error: string }[];
};

export async function generateExpenseOccurrences(todayKey: string = businessDateKey()): Promise<ExpenseRunResult> {
  const expenses = await prisma.recurringExpense.findMany({
    where: { active: true, startDate: { lte: new Date(`${todayKey}T23:59:59Z`) } },
    include: { account: true },
  });

  const result: ExpenseRunResult = { today: todayKey, created: [], skipped: 0, errors: [] };

  for (const expense of expenses) {
    const { period, dueDate } = occurrenceFor(expense, todayKey);
    const dueKey = dueDateKey(dueDate);
    if (dueKey > todayKey || dueKey < dueDateKey(expense.startDate)) {
      result.skipped++;
      continue;
    }

    try {
      const occurrence = await prisma.expenseOccurrence.create({
        data: { recurringExpenseId: expense.id, period, dueDate, expectedAmount: expense.amount },
      });

      let autoRecorded = false;
      if (expense.autoRecord) {
        try {
          await recordOccurrence(occurrence.id, {
            amount: Number(expense.amount),
            accountId: expense.accountId,
            date: dueDate,
          });
          autoRecorded = true;
        } catch (error) {
          result.errors.push({ name: expense.name, error: error instanceof Error ? error.message : String(error) });
        }
      }
      result.created.push({ id: occurrence.id, name: expense.name, autoRecorded });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        result.skipped++;
        continue;
      }
      throw error;
    }
  }

  return result;
}

export class OccurrenceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function recordOccurrence(
  id: string,
  input: { amount: number; accountId: string; date: Date; createdById?: string }
) {
  const occurrence = await prisma.expenseOccurrence.findUnique({
    where: { id },
    include: { recurringExpense: true },
  });
  if (!occurrence) throw new OccurrenceError("Gasto no encontrado", 404);
  if (occurrence.status !== OccurrenceStatus.PENDING) throw new OccurrenceError("Este gasto ya fue resuelto", 409);

  const account = await prisma.financialAccount.findFirst({ where: { id: input.accountId, active: true } });
  if (!account) throw new OccurrenceError("Cuenta no encontrada", 404);

  const expense = occurrence.recurringExpense;
  let entry;
  try {
    entry = await buildLedgerEntry({
      account,
      type: TransactionType.EXPENSE,
      amount: input.amount,
      date: input.date,
      categoryId: expense.categoryId,
      description: `${expense.name} — ${occurrence.period}`,
      source: TransactionSource.RECURRING_EXPENSE,
      createdById: input.createdById,
    });
  } catch (error) {
    if (error instanceof RateUnavailableError) throw new OccurrenceError(error.message, 422);
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({ data: entry });
    const { count } = await tx.expenseOccurrence.updateMany({
      where: { id, status: OccurrenceStatus.PENDING },
      data: { status: OccurrenceStatus.PAID, paidAt: input.date, transactionId: transaction.id },
    });
    if (count === 0) throw new OccurrenceError("Este gasto ya fue resuelto", 409);
    return tx.expenseOccurrence.findUniqueOrThrow({ where: { id } });
  });
}

export async function skipOccurrence(id: string, reason: string) {
  const { count } = await prisma.expenseOccurrence.updateMany({
    where: { id, status: OccurrenceStatus.PENDING },
    data: { status: OccurrenceStatus.SKIPPED, skipReason: reason },
  });
  if (count === 0) {
    const exists = await prisma.expenseOccurrence.count({ where: { id } });
    throw new OccurrenceError(exists ? "Este gasto ya fue resuelto" : "Gasto no encontrado", exists ? 409 : 404);
  }
  return prisma.expenseOccurrence.findUniqueOrThrow({ where: { id } });
}
