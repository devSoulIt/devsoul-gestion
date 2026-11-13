import "server-only";
import { Prisma, TransactionSource, TransactionType, type FinancialAccount } from "@prisma/client";
import { getRateToArs, toArs } from "./rates";

export const INVOICE_CATEGORY_NAME = "Factura cobrada";

export type LedgerEntryInput = {
  account: Pick<FinancialAccount, "id" | "currency">;
  type: TransactionType;
  amount: number;
  date: Date;
  categoryId?: string | null;
  description?: string | null;
  source?: TransactionSource;
  transferGroupId?: string;
  createdById?: string;
};

export async function buildLedgerEntry(input: LedgerEntryInput): Promise<Prisma.TransactionUncheckedCreateInput> {
  const { rate } = await getRateToArs(input.account.currency, input.date);
  return {
    type: input.type,
    accountId: input.account.id,
    categoryId: input.categoryId ?? null,
    amount: input.amount,
    currency: input.account.currency,
    rateToArs: rate,
    amountArs: toArs(input.amount, rate),
    description: input.description || null,
    date: input.date,
    source: input.source ?? TransactionSource.MANUAL,
    transferGroupId: input.transferGroupId,
    createdById: input.createdById,
  };
}

export function parseAmount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
