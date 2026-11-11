"use client";

import { Building2, User } from "lucide-react";
import { formatAmount, type CurrencyCode } from "@/lib/format";

export type SplitShare = { userId: string | null; percent: number };
export type SplitUser = { id: string; name: string };
export type DefaultSplitResponse = { shares: (SplitShare & { name: string })[]; users: SplitUser[] };

export const splitTotal = (shares: SplitShare[]) => Math.round(shares.reduce((acc, s) => acc + (Number(s.percent) || 0), 0) * 100) / 100;
export const splitIsValid = (shares: SplitShare[]) => Math.abs(splitTotal(shares) - 100) < 0.001;

export function normalizeSplit(shares: SplitShare[] | undefined, users: SplitUser[]): SplitShare[] {
  const source = shares ?? [];
  const rows: SplitShare[] = users.map((u) => ({ userId: u.id, percent: Number(source.find((s) => s.userId === u.id)?.percent ?? 0) }));
  rows.push({ userId: null, percent: Number(source.find((s) => !s.userId)?.percent ?? 0) });
  return rows;
}

export function evenSplit(users: SplitUser[]): SplitShare[] {
  const parts = users.length + 1;
  const base = Math.floor((100 / parts) * 100) / 100;
  const rows: SplitShare[] = users.map((u) => ({ userId: u.id, percent: base }));
  rows.push({ userId: null, percent: Math.round((100 - base * users.length) * 100) / 100 });
  return rows;
}

type Props = {
  shares: SplitShare[];
  users: SplitUser[];
  onChange: (shares: SplitShare[]) => void;
  amount?: number;
  currency?: CurrencyCode;
};

export function SplitEditor({ shares, users, onChange, amount, currency = "ARS" }: Props) {
  const total = splitTotal(shares);
  const valid = splitIsValid(shares);
  const name = (userId: string | null) => (userId ? users.find((u) => u.id === userId)?.name ?? "Socio" : "Empresa");

  const update = (userId: string | null, value: string) =>
    onChange(shares.map((s) => (s.userId === userId ? { ...s, percent: value === "" ? 0 : Number(value) } : s)));

  return (
    <div className="space-y-2">
      {shares.map((s) => (
        <div key={s.userId ?? "company"} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
          {s.userId ? <User size={15} className="text-white/40 shrink-0" /> : <Building2 size={15} className="text-acento-lima/80 shrink-0" />}
          <span className="flex-1 min-w-0 truncate text-sm text-white">{name(s.userId)}</span>
          {amount !== undefined && (
            <span className="text-xs text-white/50 tabular-nums">{formatAmount((amount * (Number(s.percent) || 0)) / 100, currency)}</span>
          )}
          <div className="relative w-24 shrink-0">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              value={Number.isFinite(s.percent) ? s.percent : 0}
              onChange={(e) => update(s.userId, e.target.value)}
              aria-label={`Porcentaje de ${name(s.userId)}`}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-7 py-1.5 text-sm text-white text-right outline-none focus:border-acento-lima/50"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">%</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs px-1">
        <button
          type="button"
          onClick={() => onChange(evenSplit(users))}
          className="text-white/50 hover:text-acento-lima transition-colors"
        >
          Repartir en partes iguales
        </button>
        <span className={valid ? "text-white/50" : "text-red-400"}>
          Total {total.toLocaleString("es-AR")}%{valid ? "" : " · tiene que sumar 100%"}
        </span>
      </div>
    </div>
  );
}
