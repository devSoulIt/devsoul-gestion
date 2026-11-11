"use client";

import Link from "next/link";
import { ChevronRight, HandCoins, Repeat } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, type CurrencyCode } from "@/lib/format";

type PayoutTotals = { totals: { userId: string; name: string; pendingArs: number; count: number }[] };
type Pending = {
  pending: {
    id: string;
    dueDate: string;
    expectedAmount: string;
    recurringExpense: { name: string; currency: CurrencyCode };
  }[];
};

export function PayablesWidget() {
  const payouts = useJson<PayoutTotals>("/api/payouts?status=PENDING");
  const expenses = useJson<Pending>("/api/recurring-expenses");

  const partners = (payouts.data?.totals ?? []).filter((t) => t.pendingArs > 0);
  const pending = expenses.data?.pending ?? [];
  const loading = (payouts.loading && !payouts.data) || (expenses.loading && !expenses.data);

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HandCoins size={18} className="text-acento-lima" />
          <p className="text-sm font-semibold text-white/70">A pagar</p>
        </div>
        <Link href="/dashboard/finanzas/gastos-fijos" className="flex items-center text-xs text-white/50 hover:text-acento-lima">
          Ver todo
          <ChevronRight size={14} />
        </Link>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      ) : partners.length === 0 && pending.length === 0 ? (
        <p className="text-sm text-white/40">No hay pagos pendientes.</p>
      ) : (
        <ul className="space-y-2">
          {partners.map((p) => (
            <li key={p.userId}>
              <Link
                href="/dashboard/finanzas/socios"
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 hover:bg-white/5"
              >
                <span className="text-sm text-white truncate">Parte de {p.name}</span>
                <span className="text-sm font-semibold text-white tabular-nums">{formatAmount(p.pendingArs)}</span>
              </Link>
            </li>
          ))}
          {pending.slice(0, 5).map((o) => (
            <li key={o.id}>
              <Link
                href="/dashboard/finanzas/gastos-fijos"
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 hover:bg-white/5"
              >
                <span className="min-w-0 flex items-center gap-2 text-sm text-white">
                  <Repeat size={13} className="text-white/40 shrink-0" />
                  <span className="truncate">{o.recurringExpense.name}</span>
                  <span className="text-xs text-white/40 shrink-0">{formatDate(o.dueDate)}</span>
                </span>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatAmount(o.expectedAmount, o.recurringExpense.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
