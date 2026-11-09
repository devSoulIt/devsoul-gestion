import type { CurrencyCode } from "@/lib/format";
import type { TaskRecurrenceCode, TaskTypeCode } from "@/lib/tasks/labels";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  type: TaskTypeCode;
  status: "PENDING" | "DONE" | "CANCELLED";
  dueAt: string;
  recurrence: TaskRecurrenceCode;
  completedAt: string | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  client: { id: string; companyName: string } | null;
  project: { id: string; name: string } | null;
  invoice: {
    id: string;
    period: string;
    amount: string;
    currency: CurrencyCode;
    dueDate: string;
    status: "PAID" | "PENDING";
  } | null;
};

export type TaskDefaults = {
  title?: string;
  type?: TaskTypeCode;
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
};

export type UserOption = { id: string; name: string; role: string };

export const fieldClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors [color-scheme:dark]";

export const selectFieldClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors appearance-none";

export function dueState(dueAt: string, today: string) {
  const key = dueAt.slice(0, 10);
  if (key < today) return "overdue" as const;
  if (key === today) return "today" as const;
  return "upcoming" as const;
}
