export function parsePaymentDay(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === "" || value === undefined) return { ok: true, value: null };
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: "El día de pago tiene que ser un número entre 1 y 31" };
  }
  return { ok: true, value: day };
}
