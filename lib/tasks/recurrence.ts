import { TaskRecurrence } from "@prisma/client";
import { businessDateKey } from "@/lib/dates";

const DAY_MS = 86_400_000;

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  const endOfMonth = day === lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = lastDayOfMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(endOfMonth ? lastDay : Math.min(day, lastDay));
  return target;
}

function occurrence(anchor: Date, recurrence: TaskRecurrence, n: number) {
  switch (recurrence) {
    case TaskRecurrence.WEEKLY:
      return new Date(anchor.getTime() + 7 * n * DAY_MS);
    case TaskRecurrence.MONTHLY:
      return addMonthsClamped(anchor, n);
    case TaskRecurrence.YEARLY:
      return addMonthsClamped(anchor, 12 * n);
    default:
      return null;
  }
}

export function nextDueAt(dueAt: Date, recurrence: TaskRecurrence, now: Date = new Date()) {
  const today = dayStart(businessDateKey(now));
  for (let n = 1; ; n++) {
    const next = occurrence(dueAt, recurrence, n);
    if (!next || next > today) return next;
  }
}

export function dayStart(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

export function parseDueAt(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = dayStart(value.slice(0, 10));
  return Number.isNaN(date.getTime()) ? null : date;
}

export type TaskRange = "overdue" | "today" | "week" | "upcoming";

export function rangeFilter(range: TaskRange, now: Date = new Date()) {
  const today = dayStart(businessDateKey(now));
  const tomorrow = new Date(today.getTime() + DAY_MS);
  switch (range) {
    case "overdue":
      return { lt: today };
    case "today":
      return { gte: today, lt: tomorrow };
    case "week":
      return { lt: new Date(today.getTime() + 7 * DAY_MS) };
    case "upcoming":
      return { gte: today };
  }
}
