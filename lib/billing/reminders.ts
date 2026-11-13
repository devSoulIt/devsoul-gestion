import "server-only";
import { NotificationChannel, PaymentStatus, Prisma, ReminderKind, ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKey, daysBetween, dueDateKey } from "@/lib/dates";
import { getNotifier } from "@/lib/notifications";
import { renderReminderEmail } from "./reminder-template";

export const DAYS_BEFORE = Number(process.env.REMINDER_DAYS_BEFORE ?? 3);
export const DAYS_AFTER = Number(process.env.REMINDER_DAYS_AFTER ?? 7);
const MAX_ATTEMPTS = 5;
const STALE_PENDING_MS = 60 * 60 * 1000;
const BATCH_SIZE = 50;

export function reminderKindFor(daysFromDue: number): ReminderKind | null {
  if (daysFromDue >= DAYS_AFTER) return ReminderKind.OVERDUE;
  if (daysFromDue >= 0) return ReminderKind.DUE_DAY;
  if (daysFromDue >= -DAYS_BEFORE) return ReminderKind.BEFORE_DUE;
  return null;
}

type Outcome = {
  invoiceId: string;
  client: string;
  kind: ReminderKind;
  recipient: string;
  status: "SENT" | "FAILED" | "SKIPPED" | "DRY_RUN";
  detail?: string;
};

export type ReminderRunResult = {
  today: string;
  channel: NotificationChannel;
  configured: boolean;
  dryRun: boolean;
  outcomes: Outcome[];
};

export async function runReminders({ dryRun = false }: { dryRun?: boolean } = {}): Promise<ReminderRunResult> {
  const channel = NotificationChannel.EMAIL;
  const notifier = getNotifier(channel);
  const today = businessDateKey();
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + (DAYS_BEFORE + 1) * 86_400_000);
  const result: ReminderRunResult = { today, channel, configured: Boolean(notifier), dryRun, outcomes: [] };

  const invoices = await prisma.invoice.findMany({
    where: {
      status: PaymentStatus.PENDING,
      dueDate: { lt: horizon },
      contract: { deletedAt: null, client: { deletedAt: null } },
    },
    include: {
      contract: {
        select: {
          client: { select: { companyName: true, contactName: true, email: true } },
          software: { select: { name: true } },
        },
      },
      reminders: { where: { channel } },
    },
    orderBy: { dueDate: "asc" },
  });

  for (const invoice of invoices) {
    if (result.outcomes.filter((o) => o.status !== "SKIPPED").length >= BATCH_SIZE) break;

    const daysFromDue = daysBetween(dueDateKey(invoice.dueDate), today);
    const kind = reminderKindFor(daysFromDue);
    if (!kind) continue;

    const { client, software } = invoice.contract;
    if (!client.email) {
      result.outcomes.push({
        invoiceId: invoice.id,
        client: client.companyName,
        kind,
        recipient: "",
        status: "SKIPPED",
        detail: "El cliente no tiene email",
      });
      continue;
    }
    const base = { invoiceId: invoice.id, client: client.companyName, kind, recipient: client.email };
    const existing = invoice.reminders.find((r) => r.kind === kind);

    if (existing?.status === ReminderStatus.SENT) continue;
    if (existing && existing.attempts >= MAX_ATTEMPTS) {
      result.outcomes.push({ ...base, status: "SKIPPED", detail: "Máximo de reintentos alcanzado" });
      continue;
    }

    const message = renderReminderEmail({
      kind,
      contactName: client.contactName,
      companyName: client.companyName,
      softwareName: software.name,
      period: invoice.period,
      amount: (Number(invoice.amount) - Number(invoice.paidAmount)).toFixed(2),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      daysFromDue,
    });

    if (dryRun || !notifier) {
      result.outcomes.push({ ...base, status: "DRY_RUN", detail: message.subject });
      continue;
    }

    const claimed = await claim(invoice.id, kind, channel, client.email, existing);
    if (!claimed) {
      result.outcomes.push({ ...base, status: "SKIPPED", detail: "En proceso por otra ejecución" });
      continue;
    }

    const sent = await notifier.send({
      to: client.email,
      ...message,
      idempotencyKey: `reminder-${invoice.id}-${kind}-${claimed.attempts}`,
    });

    await prisma.reminderLog.update({
      where: { id: claimed.id },
      data: sent.ok
        ? { status: ReminderStatus.SENT, providerId: sent.providerId, error: null, sentAt: new Date() }
        : { status: ReminderStatus.FAILED, error: sent.error.slice(0, 500) },
    });

    result.outcomes.push({ ...base, status: sent.ok ? "SENT" : "FAILED", detail: sent.ok ? undefined : sent.error });
  }

  return result;
}

async function claim(
  invoiceId: string,
  kind: ReminderKind,
  channel: NotificationChannel,
  recipient: string,
  existing: { id: string; status: ReminderStatus; updatedAt: Date } | undefined
) {
  if (!existing) {
    try {
      return await prisma.reminderLog.create({
        data: { invoiceId, kind, channel, recipient, status: ReminderStatus.PENDING, attempts: 1 },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  const { count } = await prisma.reminderLog.updateMany({
    where: {
      id: existing.id,
      OR: [
        { status: ReminderStatus.FAILED },
        { status: ReminderStatus.PENDING, updatedAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } },
      ],
    },
    data: { status: ReminderStatus.PENDING, recipient, attempts: { increment: 1 } },
  });
  return count ? prisma.reminderLog.findUnique({ where: { id: existing.id } }) : null;
}
