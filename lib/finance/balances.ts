import "server-only";
import { Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentRates, toArs } from "./rates";

const SIGN: Record<TransactionType, 1 | -1> = {
  INCOME: 1,
  TRANSFER_IN: 1,
  EXPENSE: -1,
  TRANSFER_OUT: -1,
  PARTNER_PAYOUT: -1,
};

export type AccountBalance = {
  id: string;
  name: string;
  provider: string;
  currency: Currency;
  active: boolean;
  openingBalance: number;
  openingDate: Date;
  balance: number;
  balanceArs: number | null;
};

export async function getAccountBalances(options: { includeInactive?: boolean } = {}) {
  const [accounts, sums, rates] = await Promise.all([
    prisma.financialAccount.findMany({
      where: options.includeInactive ? undefined : { active: true },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.groupBy({ by: ["accountId", "type"], _sum: { amount: true } }),
    getCurrentRates(),
  ]);

  const movements = new Map<string, number>();
  for (const s of sums) {
    movements.set(s.accountId, (movements.get(s.accountId) ?? 0) + SIGN[s.type] * Number(s._sum.amount ?? 0));
  }

  const balances: AccountBalance[] = accounts.map((a) => {
    const balance = Math.round((Number(a.openingBalance) + (movements.get(a.id) ?? 0)) * 100) / 100;
    const rate = rates[a.currency];
    return {
      id: a.id,
      name: a.name,
      provider: a.provider,
      currency: a.currency,
      active: a.active,
      openingBalance: Number(a.openingBalance),
      openingDate: a.openingDate,
      balance,
      balanceArs: rate === null ? null : toArs(balance, rate),
    };
  });

  const totalArs = balances.reduce((acc, b) => acc + (b.active ? (b.balanceArs ?? 0) : 0), 0);

  return { accounts: balances, totalArs: Math.round(totalArs * 100) / 100, usdRate: rates.USD };
}
