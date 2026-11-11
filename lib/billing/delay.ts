import { businessDateKey, daysBetween } from "@/lib/dates";

type DelayInput = {
  status: "PAID" | "PENDING" | "CANCELLED";
  dueDate: Date | string;
  paymentDate?: Date | string | null;
};

const toKey = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

export function delayDays(invoice: DelayInput, today: string = businessDateKey()): number | null {
  if (invoice.status === "CANCELLED") return null;
  const due = toKey(invoice.dueDate);
  if (invoice.status === "PAID") {
    if (!invoice.paymentDate) return null;
    return Math.max(0, daysBetween(due, businessDateKey(new Date(invoice.paymentDate))));
  }
  return Math.max(0, daysBetween(due, today));
}

export function isOverdue(invoice: DelayInput, today: string = businessDateKey()) {
  return invoice.status === "PENDING" && (delayDays(invoice, today) ?? 0) > 0;
}
