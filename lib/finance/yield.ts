export function yieldExternalId(accountId: string, dateKey: string) {
  return `yield:${accountId}:${dateKey}`;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00Z`);
}
