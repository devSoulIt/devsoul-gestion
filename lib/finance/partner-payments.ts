import "server-only";
import { Prisma, TransactionSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { formatAmount } from "@/lib/format";
import { buildLedgerEntry, parseAmount } from "./ledger";
import { checkPaymentDate } from "./payment-date";
import { PaymentError } from "@/lib/billing/payments";

type Db = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PartnerPaymentRequest = {
  userId?: unknown;
  accountId?: unknown;
  amount?: unknown;
  date?: unknown;
  confirmDate?: unknown;
  concept?: unknown;
};

export async function preparePartnerPayment(body: PartnerPaymentRequest, createdById: string) {
  const user = await prisma.user.findUnique({ where: { id: String(body.userId ?? "") }, select: { id: true, name: true } });
  if (!user) throw new PaymentError("Elegí el socio");

  const account = await prisma.financialAccount.findFirst({ where: { id: String(body.accountId ?? ""), active: true } });
  if (!account) throw new PaymentError("Elegí la cuenta desde la que pagaste");

  const amount = parseAmount(body.amount);
  if (!amount) throw new PaymentError("Indicá el monto pagado");

  const dateCheck = checkPaymentDate({ value: body.date, confirmed: body.confirmDate, reconciledAt: account.reconciledAt });
  if (!dateCheck.ok) {
    throw new PaymentError(dateCheck.error, dateCheck.status, "warnings" in dateCheck ? dateCheck.warnings : undefined);
  }

  const concept = typeof body.concept === "string" && body.concept.trim() ? body.concept.trim().slice(0, 200) : null;
  const entry = await buildLedgerEntry({
    account,
    type: TransactionType.PARTNER_PAYOUT,
    amount,
    date: dateCheck.date,
    description: `Pago a ${user.name}${concept ? ` — ${concept}` : ""}`,
    source: TransactionSource.PAYOUT,
    createdById,
  });

  return { user, account, amount, date: dateCheck.date, concept, entry, createdById };
}

export type PreparedPartnerPayment = Awaited<ReturnType<typeof preparePartnerPayment>>;

export async function registerPartnerPayment(tx: Db, input: PreparedPartnerPayment) {
  const transaction = await tx.transaction.create({ data: input.entry });
  const payment = await tx.partnerPayment.create({
    data: {
      userId: input.user.id,
      accountId: input.account.id,
      amount: input.amount,
      currency: input.account.currency,
      rateToArs: transaction.rateToArs,
      amountArs: transaction.amountArs,
      date: input.date,
      concept: input.concept,
      transactionId: transaction.id,
      createdById: input.createdById,
    },
  });
  await audit(tx, {
    userId: input.createdById,
    action: "partnerPayment.create",
    entity: "PartnerPayment",
    entityId: payment.id,
    summary: `Pago a ${input.user.name} de ${formatAmount(input.amount, input.account.currency)} desde ${input.account.name}`,
    diff: { amount: input.amount, date: input.date.toISOString(), concept: input.concept },
  });
  return payment;
}

export async function reversePartnerPayment(tx: Db, id: string, reason: string, userId: string) {
  const payment = await tx.partnerPayment.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!payment) throw new PaymentError("Pago no encontrado", 404);
  if (payment.reversedAt) throw new PaymentError("El pago ya fue revertido", 409);

  await tx.partnerPayment.update({
    where: { id },
    data: { reversedAt: new Date(), reversedById: userId, reverseReason: reason, transactionId: null },
  });
  if (payment.transactionId) await tx.transaction.delete({ where: { id: payment.transactionId } });

  await audit(tx, {
    userId,
    action: "partnerPayment.reverse",
    entity: "PartnerPayment",
    entityId: id,
    summary: `Pago a ${payment.user.name} revertido (${formatAmount(Number(payment.amount), payment.currency)}): ${reason}`,
    diff: { amount: Number(payment.amount), date: payment.date.toISOString(), reason },
  });
}

export type PartnerBalance = { userId: string; name: string; accruedArs: number; paidArs: number; balanceArs: number };

export async function getPartnerBalances(): Promise<PartnerBalance[]> {
  const [users, accrued, paid] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.payout.groupBy({ by: ["userId"], where: { userId: { not: null } }, _sum: { amountArs: true } }),
    prisma.partnerPayment.groupBy({ by: ["userId"], where: { reversedAt: null }, _sum: { amountArs: true } }),
  ]);

  return users.map((u) => {
    const accruedArs = round2(Number(accrued.find((a) => a.userId === u.id)?._sum.amountArs ?? 0));
    const paidArs = round2(Number(paid.find((p) => p.userId === u.id)?._sum.amountArs ?? 0));
    return { userId: u.id, name: u.name, accruedArs, paidArs, balanceArs: round2(accruedArs - paidArs) };
  });
}
