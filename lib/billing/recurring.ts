import "server-only";
import { ContractType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKey, currentPeriod, periodBounds, periodDueDate } from "@/lib/dates";

const RECURRING_TYPES: ContractType[] = [ContractType.SAAS_SUBSCRIPTION, ContractType.MAINTENANCE];
export const INVOICE_DUE_DAY = Number(process.env.INVOICE_DUE_DAY ?? 10);
const LATE_GENERATION_GRACE_DAYS = 7;

export type RecurringResult = {
  period: string;
  created: { invoiceId: string; contractId: string; client: string }[];
  skipped: number;
};

export async function generateRecurringInvoices(period: string = currentPeriod()): Promise<RecurringResult> {
  const { start, end } = periodBounds(period);

  const contracts = await prisma.contract.findMany({
    where: {
      type: { in: RECURRING_TYPES },
      active: true,
      deletedAt: null,
      startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
      client: { deletedAt: null },
    },
    include: {
      client: { select: { companyName: true } },
      invoices: { where: { period }, select: { id: true } },
    },
  });

  const result: RecurringResult = { period, created: [], skipped: 0 };

  for (const contract of contracts) {
    if (contract.invoices.length > 0) {
      result.skipped++;
      continue;
    }
    try {
      const invoice = await prisma.invoice.create({
        data: {
          contractId: contract.id,
          amount: contract.totalAmount,
          currency: contract.currency,
          period,
          dueDate: resolveDueDate(period, contract.paymentDay ?? INVOICE_DUE_DAY),
          status: PaymentStatus.PENDING,
          recurringKey: `${contract.id}:${period}`,
        },
      });
      result.created.push({ invoiceId: invoice.id, contractId: contract.id, client: contract.client.companyName });
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

function resolveDueDate(period: string, day: number) {
  const scheduled = periodDueDate(period, day);
  const today = Date.parse(`${businessDateKey()}T00:00:00Z`);
  return scheduled.getTime() >= today
    ? scheduled
    : new Date(today + LATE_GENERATION_GRACE_DAYS * 86_400_000);
}
