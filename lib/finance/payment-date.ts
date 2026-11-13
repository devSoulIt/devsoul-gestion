import { businessDateKey, daysBetween, dueDateKey } from "@/lib/dates";
import { dateFromKey, isDateKey } from "./yield";

export const UNUSUAL_DAYS_BACK = 45;

export type PaymentDateCheck =
  | { ok: true; date: Date; key: string }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; error: string; warnings: string[]; needsConfirmation: true };

type Options = {
  value: unknown;
  confirmed?: unknown;
  notBefore?: { date: Date; label: string } | null;
  reconciledAt?: Date | null;
};

export function checkPaymentDate({ value, confirmed, notBefore, reconciledAt }: Options): PaymentDateCheck {
  const key = typeof value === "string" && value ? value.slice(0, 10) : businessDateKey();
  if (!isDateKey(key)) return { ok: false, status: 400, error: "Fecha inválida" };

  const today = businessDateKey();
  if (key > today) return { ok: false, status: 400, error: "La fecha no puede ser futura" };

  const warnings: string[] = [];
  const daysBack = daysBetween(key, today);
  if (daysBack > UNUSUAL_DAYS_BACK) warnings.push(`La fecha es de hace ${daysBack} días.`);
  if (notBefore && key < dueDateKey(notBefore.date)) {
    warnings.push(`La fecha es anterior ${notBefore.label} (${formatKey(dueDateKey(notBefore.date))}).`);
  }
  if (reconciledAt && key <= businessDateKey(reconciledAt)) {
    warnings.push(
      `La cuenta se concilió el ${formatKey(businessDateKey(reconciledAt))}: este movimiento cambia un saldo ya verificado.`
    );
  }

  if (warnings.length && confirmed !== true) {
    return { ok: false, status: 409, error: "Revisá la fecha antes de guardar.", warnings, needsConfirmation: true };
  }
  return { ok: true, date: dateFromKey(key), key };
}

function formatKey(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}
