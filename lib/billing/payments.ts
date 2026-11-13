import "server-only";
import {
  ContractType,
  Currency,
  PaymentStatus,
  Prisma,
  TransactionSource,
  TransactionType,
  type FinancialAccount,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { INVOICE_CATEGORY_NAME, buildLedgerEntry, parseAmount } from "@/lib/finance/ledger";
import { checkPaymentDate } from "@/lib/finance/payment-date";
import { getRateToArs } from "@/lib/finance/rates";
import { buildPayouts, getSplitFor, parseShares, type ShareInput } from "@/lib/finance/splits";
import { formatAmount } from "@/lib/format";

type Db = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly warnings?: string[]
  ) {
    super(message);
  }
}

export type PaymentRequest = {
  contractId?: unknown;
  accountId?: unknown;
  amount?: unknown;
  appliedAmount?: unknown;
  date?: unknown;
  confirmDate?: unknown;
  notes?: unknown;
  invoiceIds?: unknown;
  shares?: unknown;
};

export type PreparedPayment = {
  contract: { id: string; clientId: string; currency: Currency; label: string };
  account: Pick<FinancialAccount, "id" | "currency" | "name">;
  amount: number;
  appliedAmount: number;
  date: Date;
  notes: string | null;
  invoiceIds: string[];
  shares: ShareInput[];
  entry: Prisma.TransactionUncheckedCreateInput;
  userId: string;
};

export async function preparePayment(body: PaymentRequest, userId: string): Promise<PreparedPayment> {
  const contract = await prisma.contract.findFirst({
    where: { id: String(body.contractId ?? ""), deletedAt: null },
    include: { client: { select: { companyName: true } }, software: { select: { name: true } } },
  });
  if (!contract) throw new PaymentError("Contrato no encontrado", 404);

  const account = await prisma.financialAccount.findFirst({ where: { id: String(body.accountId ?? ""), active: true } });
  if (!account) throw new PaymentError("Indicá la cuenta donde ingresó el cobro");

  const amount = parseAmount(body.amount);
  if (!amount) throw new PaymentError("Indicá el monto cobrado");

  const dateCheck = checkPaymentDate({
    value: body.date,
    confirmed: body.confirmDate,
    notBefore: { date: contract.startDate, label: "al inicio del contrato" },
    reconciledAt: account.reconciledAt,
  });
  if (!dateCheck.ok) {
    throw new PaymentError(dateCheck.error, dateCheck.status, "warnings" in dateCheck ? dateCheck.warnings : undefined);
  }
  const date = dateCheck.date;

  let appliedAmount = amount;
  if (account.currency !== contract.currency) {
    const explicit = parseAmount(body.appliedAmount);
    if (explicit) appliedAmount = explicit;
    else {
      const [from, to] = await Promise.all([
        getRateToArs(account.currency, date),
        getRateToArs(contract.currency, date),
      ]);
      appliedAmount = round2((amount * from.rate) / to.rate);
    }
  }

  let shares: ShareInput[];
  if (body.shares !== undefined && body.shares !== null) {
    const parsed = await parseShares(body.shares);
    if (!parsed.ok) throw new PaymentError(parsed.error);
    shares = parsed.shares;
  } else {
    shares = await getSplitFor(contract.id);
  }

  const invoiceIds = Array.isArray(body.invoiceIds) ? body.invoiceIds.map(String) : [];
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;
  const label = `${contract.client.companyName} · ${contract.software.name}`;

  const category = await prisma.transactionCategory.upsert({
    where: { name_type: { name: INVOICE_CATEGORY_NAME, type: TransactionType.INCOME } },
    create: { name: INVOICE_CATEGORY_NAME, type: TransactionType.INCOME },
    update: {},
  });

  const entry = await buildLedgerEntry({
    account,
    type: TransactionType.INCOME,
    amount,
    date,
    categoryId: category.id,
    description: `Cobro — ${label}${notes ? ` (${notes})` : ""}`,
    source: TransactionSource.INVOICE,
    createdById: userId,
  });

  return {
    contract: { id: contract.id, clientId: contract.clientId, currency: contract.currency, label },
    account,
    amount,
    appliedAmount,
    date,
    notes,
    invoiceIds,
    shares,
    entry,
    userId,
  };
}

export async function registerPayment(tx: Db, input: PreparedPayment) {
  const transaction = await tx.transaction.create({ data: input.entry });
  const payment = await tx.payment.create({
    data: {
      clientId: input.contract.clientId,
      contractId: input.contract.id,
      accountId: input.account.id,
      amount: input.amount,
      currency: input.account.currency,
      rateToArs: transaction.rateToArs,
      amountArs: transaction.amountArs,
      appliedAmount: input.appliedAmount,
      appliedCurrency: input.contract.currency,
      date: input.date,
      notes: input.notes,
      transactionId: transaction.id,
      createdById: input.userId,
    },
  });

  await applyPaymentBalance(tx, payment.id, input.invoiceIds);
  await tx.payout.createMany({
    data: buildPayouts(
      payment.id,
      { amount: input.amount, currency: input.account.currency, rateToArs: Number(transaction.rateToArs) },
      input.shares
    ),
  });
  await audit(tx, {
    userId: input.userId,
    action: "payment.create",
    entity: "Payment",
    entityId: payment.id,
    summary: `Cobro de ${formatAmount(input.amount, input.account.currency)} — ${input.contract.label} en ${input.account.name}`,
    diff: { amount: input.amount, appliedAmount: input.appliedAmount, date: input.date.toISOString(), accountId: input.account.id },
  });

  return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { allocations: true } });
}

export async function applyPaymentBalance(tx: Db, paymentId: string, priority: string[] = []) {
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { allocations: { select: { amount: true } } },
  });
  if (payment.reversedAt) return;

  let remaining = round2(Number(payment.appliedAmount) - payment.allocations.reduce((acc, a) => acc + Number(a.amount), 0));
  if (remaining <= 0) return;

  const invoices = await tx.invoice.findMany({
    where: { contractId: payment.contractId, status: PaymentStatus.PENDING, currency: payment.appliedCurrency },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const rank = (id: string) => (priority.includes(id) ? priority.indexOf(id) : priority.length);
  invoices.sort((a, b) => rank(a.id) - rank(b.id));

  const invoiceRate =
    payment.appliedCurrency === Currency.ARS
      ? null
      : payment.appliedCurrency === payment.currency
        ? Number(payment.rateToArs)
        : round4(Number(payment.amountArs) / Number(payment.appliedAmount));

  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const pending = round2(Number(invoice.amount) - Number(invoice.paidAmount));
    if (pending <= 0) continue;

    const take = Math.min(remaining, pending);
    await tx.paymentAllocation.upsert({
      where: { paymentId_invoiceId: { paymentId, invoiceId: invoice.id } },
      create: { paymentId, invoiceId: invoice.id, amount: take },
      update: { amount: { increment: take } },
    });

    const paidAmount = round2(Number(invoice.paidAmount) + take);
    const full = paidAmount >= Number(invoice.amount);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        ...(full && { status: PaymentStatus.PAID, paymentDate: payment.date, rateToArs: invoiceRate }),
      },
    });
    remaining = round2(remaining - take);
  }
}

export async function applyContractCredit(tx: Db, contractId: string) {
  const payments = await tx.payment.findMany({
    where: { contractId, reversedAt: null },
    select: { id: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  for (const p of payments) await applyPaymentBalance(tx, p.id);
}

export async function recomputeInvoice(tx: Db, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { allocations: { include: { payment: { select: { date: true } } } } },
  });
  const paidAmount = round2(invoice.allocations.reduce((acc, a) => acc + Number(a.amount), 0));
  if (invoice.status === PaymentStatus.CANCELLED) {
    return tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount } });
  }
  const full = paidAmount >= Number(invoice.amount);
  const lastDate = invoice.allocations.reduce<Date | null>(
    (acc, a) => (!acc || a.payment.date > acc ? a.payment.date : acc),
    null
  );
  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status: full ? PaymentStatus.PAID : PaymentStatus.PENDING,
      paymentDate: full ? lastDate : null,
      ...(!full && { rateToArs: null }),
    },
  });
}

export async function reversePayment(tx: Db, paymentId: string, reason: string, userId: string) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { allocations: { select: { invoiceId: true } }, contract: { include: { client: true } } },
  });
  if (!payment) throw new PaymentError("Cobro no encontrado", 404);
  if (payment.reversedAt) throw new PaymentError("El cobro ya fue revertido", 409);

  await tx.payout.deleteMany({ where: { paymentId } });
  await tx.paymentAllocation.deleteMany({ where: { paymentId } });
  await tx.payment.update({
    where: { id: paymentId },
    data: { reversedAt: new Date(), reversedById: userId, reverseReason: reason, transactionId: null },
  });
  if (payment.transactionId) await tx.transaction.delete({ where: { id: payment.transactionId } });

  for (const { invoiceId } of payment.allocations) await recomputeInvoice(tx, invoiceId);
  await applyContractCredit(tx, payment.contractId);

  await audit(tx, {
    userId,
    action: "payment.reverse",
    entity: "Payment",
    entityId: paymentId,
    summary: `Cobro revertido de ${formatAmount(Number(payment.amount), payment.currency)} — ${payment.contract.client.companyName}: ${reason}`,
    diff: { amount: Number(payment.amount), date: payment.date.toISOString(), reason },
  });
}

export async function releaseInvoiceAllocations(tx: Db, invoiceId: string) {
  const { count } = await tx.paymentAllocation.deleteMany({ where: { invoiceId } });
  if (count) await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: 0 } });
  return count;
}

export async function customContractRoom(db: Db | typeof prisma, contractId: string) {
  const contract = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (contract.type !== ContractType.CUSTOM_DEVELOPMENT) return null;
  const invoiced = await db.invoice.aggregate({
    where: { contractId, status: { not: PaymentStatus.CANCELLED }, currency: contract.currency },
    _sum: { amount: true },
  });
  return round2(Number(contract.totalAmount) - Number(invoiced._sum.amount ?? 0));
}

export type ContractAccount = {
  contractId: string;
  currency: Currency;
  agreed: number | null;
  invoiced: number;
  collected: number;
  applied: number;
  pending: number;
  credit: number;
  balance: number;
};

export async function getContractAccounts(contractIds: string[]): Promise<Map<string, ContractAccount>> {
  const [contracts, invoices, payments, allocations] = await Promise.all([
    prisma.contract.findMany({ where: { id: { in: contractIds } }, select: { id: true, type: true, totalAmount: true, currency: true } }),
    prisma.invoice.groupBy({
      by: ["contractId"],
      where: { contractId: { in: contractIds }, status: { not: PaymentStatus.CANCELLED } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["contractId"],
      where: { contractId: { in: contractIds }, reversedAt: null },
      _sum: { appliedAmount: true },
    }),
    prisma.paymentAllocation.findMany({
      where: { payment: { contractId: { in: contractIds }, reversedAt: null } },
      select: { amount: true, payment: { select: { contractId: true } } },
    }),
  ]);

  const allocated = new Map<string, number>();
  for (const a of allocations) {
    allocated.set(a.payment.contractId, (allocated.get(a.payment.contractId) ?? 0) + Number(a.amount));
  }

  const result = new Map<string, ContractAccount>();
  for (const c of contracts) {
    const inv = invoices.find((i) => i.contractId === c.id);
    const invoiced = round2(Number(inv?._sum.amount ?? 0));
    const paid = round2(Number(inv?._sum.paidAmount ?? 0));
    const collected = round2(Number(payments.find((p) => p.contractId === c.id)?._sum.appliedAmount ?? 0));
    const applied = round2(allocated.get(c.id) ?? 0);
    const credit = round2(collected - applied);
    const pending = round2(invoiced - paid);
    const agreed = c.type === ContractType.CUSTOM_DEVELOPMENT ? Number(c.totalAmount) : null;
    result.set(c.id, {
      contractId: c.id,
      currency: c.currency,
      agreed,
      invoiced,
      collected,
      applied,
      pending,
      credit,
      balance: agreed !== null ? round2(agreed - collected) : round2(pending - credit),
    });
  }
  return result;
}
