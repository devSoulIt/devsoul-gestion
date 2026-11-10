import "server-only";
import { NotificationChannel, Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKey } from "@/lib/dates";
import { getNotifier } from "@/lib/notifications";
import { dayStart } from "./recurrence";
import { renderDigestEmail, type DigestTask } from "./digest-template";

const DAY_MS = 86_400_000;

type DigestOutcome = {
  userId: string;
  name: string;
  email: string;
  tasks: number;
  status: "SENT" | "FAILED" | "SKIPPED" | "DRY_RUN";
  detail?: string;
};

export type DigestRunResult = {
  today: string;
  configured: boolean;
  dryRun: boolean;
  outcomes: DigestOutcome[];
};

export async function runTaskDigest({ dryRun = false }: { dryRun?: boolean } = {}): Promise<DigestRunResult> {
  const notifier = getNotifier(NotificationChannel.EMAIL);
  const todayKey = businessDateKey();
  const today = dayStart(todayKey);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const result: DigestRunResult = { today: todayKey, configured: Boolean(notifier), dryRun, outcomes: [] };

  const [tasks, owners] = await Promise.all([
    prisma.task.findMany({
      where: { status: TaskStatus.PENDING, dueAt: { lt: tomorrow } },
      include: {
        client: { select: { companyName: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.user.findMany({ where: { role: Role.OWNER }, select: { id: true } }),
  ]);

  const byUser = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const recipients = task.assignedToId ? [task.assignedToId] : owners.map((o) => o.id);
    for (const userId of recipients) byUser.set(userId, [...(byUser.get(userId) ?? []), task]);
  }
  if (byUser.size === 0) return result;

  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, name: true, email: true },
  });

  for (const user of users) {
    const userTasks = byUser.get(user.id)!;
    const base = { userId: user.id, name: user.name, email: user.email, tasks: userTasks.length };

    if (userTasks.every((t) => t.notifiedAt && t.notifiedAt >= today)) {
      result.outcomes.push({ ...base, status: "SKIPPED", detail: "Ya notificado hoy" });
      continue;
    }

    const message = renderDigestEmail({
      name: user.name,
      appUrl: process.env.APP_URL ?? null,
      tasks: userTasks.map<DigestTask>((t) => ({
        title: t.title,
        type: t.type,
        dueAt: t.dueAt,
        overdue: t.dueAt < today,
        clientName: t.client?.companyName ?? null,
        projectName: t.project?.name ?? null,
      })),
    });

    if (dryRun || !notifier) {
      result.outcomes.push({ ...base, status: "DRY_RUN", detail: message.subject });
      continue;
    }

    const sent = await notifier.send({
      to: user.email,
      ...message,
      idempotencyKey: `task-digest-${user.id}-${todayKey}`,
    });

    if (sent.ok) {
      await prisma.task.updateMany({
        where: { id: { in: userTasks.map((t) => t.id) } },
        data: { notifiedAt: new Date() },
      });
    }
    result.outcomes.push({ ...base, status: sent.ok ? "SENT" : "FAILED", detail: sent.ok ? undefined : sent.error });
  }

  return result;
}
