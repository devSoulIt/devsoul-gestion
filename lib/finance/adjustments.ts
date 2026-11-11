import "server-only";
import { Prisma, TransactionSource, TransactionType, type FinancialAccount } from "@prisma/client";
import { buildLedgerEntry } from "./ledger";

export const YIELD_CATEGORY_NAME = "Rendimientos";
export const UNRECORDED_EXPENSE_CATEGORY_NAME = "Gasto no registrado";

export const TREATMENTS = ["YIELD", "EXPENSE", "ADJUSTMENT"] as const;
export type Treatment = (typeof TREATMENTS)[number];

export class AdjustmentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type CategoryDb = Pick<Prisma.TransactionClient, "transactionCategory">;

export function adjustmentDiff(systemBalance: number, realBalance: number) {
  return Math.round((realBalance - systemBalance) * 100) / 100;
}

export function parseTreatment(value: unknown): Treatment | null {
  return TREATMENTS.includes(value as Treatment) ? (value as Treatment) : null;
}

export function validateTreatment(diff: number, treatment: Treatment) {
  if (treatment === "YIELD" && diff < 0) return "Un rendimiento solo puede sumar: el saldo real es menor al del sistema";
  if (treatment === "EXPENSE" && diff > 0) return "Un gasto solo puede restar: el saldo real es mayor al del sistema";
  return null;
}

export function ensureCategory(db: CategoryDb, name: string, type: TransactionType) {
  return db.transactionCategory.upsert({
    where: { name_type: { name, type } },
    create: { name, type },
    update: {},
  });
}

export async function adjustmentEntry(
  db: CategoryDb,
  input: {
    account: Pick<FinancialAccount, "id" | "currency">;
    diff: number;
    treatment: Treatment;
    categoryId?: string | null;
    date: Date;
    userId: string;
  }
) {
  const { account, diff, treatment, date, userId } = input;
  const common = { account, amount: Math.abs(diff), date, createdById: userId };

  if (treatment === "YIELD") {
    const category = await ensureCategory(db, YIELD_CATEGORY_NAME, TransactionType.INCOME);
    return buildLedgerEntry({
      ...common,
      type: TransactionType.INCOME,
      categoryId: category.id,
      description: "Rendimiento (ajuste de saldo)",
      source: TransactionSource.YIELD,
    });
  }

  if (treatment === "EXPENSE") {
    const category = input.categoryId
      ? await db.transactionCategory.findFirst({ where: { id: input.categoryId, type: TransactionType.EXPENSE } })
      : await ensureCategory(db, UNRECORDED_EXPENSE_CATEGORY_NAME, TransactionType.EXPENSE);
    if (!category) throw new AdjustmentError("Categoría de egreso inválida");
    return buildLedgerEntry({
      ...common,
      type: TransactionType.EXPENSE,
      categoryId: category.id,
      description: "Gasto no registrado (ajuste de saldo)",
      source: TransactionSource.ADJUSTMENT,
    });
  }

  return buildLedgerEntry({
    ...common,
    type: diff > 0 ? TransactionType.ADJUSTMENT_IN : TransactionType.ADJUSTMENT_OUT,
    description: "Ajuste de saldo",
    source: TransactionSource.ADJUSTMENT,
  });
}
