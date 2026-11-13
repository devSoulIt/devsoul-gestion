import "server-only";
import { PayoutStatus, Prisma, type Currency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toArs } from "./rates";

export type ShareInput = { userId: string | null; percent: number };
export type ShareView = ShareInput & { name: string };

type Db = Prisma.TransactionClient | typeof prisma;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getDefaultSplit(db: Db = prisma): Promise<ShareInput[]> {
  const rows = await db.splitShare.findMany({ where: { contractId: null }, orderBy: { createdAt: "asc" } });
  return rows.length
    ? rows.map((r) => ({ userId: r.userId, percent: Number(r.percent) }))
    : [{ userId: null, percent: 100 }];
}

export async function getContractSplit(contractId: string, db: Db = prisma): Promise<ShareInput[] | null> {
  const rows = await db.splitShare.findMany({ where: { contractId }, orderBy: { createdAt: "asc" } });
  return rows.length ? rows.map((r) => ({ userId: r.userId, percent: Number(r.percent) })) : null;
}

export async function getSplitFor(contractId: string, db: Db = prisma) {
  return (await getContractSplit(contractId, db)) ?? (await getDefaultSplit(db));
}

export async function withNames(shares: ShareInput[]): Promise<ShareView[]> {
  const ids = shares.map((s) => s.userId).filter((id): id is string => !!id);
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return shares.map((s) => ({ ...s, name: s.userId ? names.get(s.userId) ?? "Socio" : "Empresa" }));
}

export async function parseShares(value: unknown): Promise<{ ok: true; shares: ShareInput[] } | { ok: false; error: string }> {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: "Reparto inválido" };

  const shares: ShareInput[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const userId = raw?.userId ? String(raw.userId) : null;
    const percent = Number(raw?.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { ok: false, error: "Cada porcentaje debe estar entre 0 y 100" };
    }
    const key = userId ?? "company";
    if (seen.has(key)) return { ok: false, error: "Hay participantes repetidos en el reparto" };
    seen.add(key);
    shares.push({ userId, percent: round2(percent) });
  }

  const total = round2(shares.reduce((acc, s) => acc + s.percent, 0));
  if (Math.abs(total - 100) > 0.001) return { ok: false, error: `El reparto suma ${total}%, tiene que sumar 100%` };

  const ids = shares.map((s) => s.userId).filter((id): id is string => !!id);
  if (ids.length) {
    const count = await prisma.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length) return { ok: false, error: "Hay socios inexistentes en el reparto" };
  }

  return { ok: true, shares };
}

export async function replaceSplit(db: Db, contractId: string | null, shares: ShareInput[] | null) {
  await db.splitShare.deleteMany({ where: { contractId } });
  if (!shares) return;
  await db.splitShare.createMany({
    data: shares.map((s) => ({ contractId, userId: s.userId, percent: s.percent })),
  });
}

export function buildPayouts(
  paymentId: string,
  received: { amount: number; currency: Currency; rateToArs: number },
  shares: ShareInput[]
): Prisma.PayoutCreateManyInput[] {
  const partners = shares.filter((s) => s.userId && s.percent > 0);
  const rows: Prisma.PayoutCreateManyInput[] = partners.map((s) => {
    const amount = round2((received.amount * s.percent) / 100);
    return {
      paymentId,
      userId: s.userId,
      percent: s.percent,
      amount,
      currency: received.currency,
      amountArs: toArs(amount, received.rateToArs),
      status: PayoutStatus.PENDING,
    };
  });

  const companyPercent = shares.find((s) => !s.userId)?.percent ?? 0;
  const companyAmount = round2(received.amount - rows.reduce((acc, r) => acc + Number(r.amount), 0));
  rows.push({
    paymentId,
    userId: null,
    percent: companyPercent,
    amount: companyAmount,
    currency: received.currency,
    amountArs: toArs(companyAmount, received.rateToArs),
    status: PayoutStatus.RETAINED,
  });

  return rows;
}
