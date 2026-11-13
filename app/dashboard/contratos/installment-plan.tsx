"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatAmount, type CurrencyCode } from "@/lib/format";

export type InstallmentRow = { amount: string; dueDate: string };

type Props = {
  total: number;
  currency: CurrencyCode;
  startDate: string;
  rows: InstallmentRow[];
  onChange: (rows: InstallmentRow[]) => void;
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-acento-lima/50 [color-scheme:dark]";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function addMonthsKey(key: string, months: number) {
  const [y, m, d] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

export function evenInstallments(total: number, count: number, startDate: string): InstallmentRow[] {
  const base = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    amount: String(i === count - 1 ? round2(total - base * (count - 1)) : base),
    dueDate: addMonthsKey(startDate, i),
  }));
}

export const installmentsSum = (rows: InstallmentRow[]) => round2(rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0));

export function InstallmentPlan({ total, currency, startDate, rows, onChange }: Props) {
  const [count, setCount] = useState("3");
  const sum = installmentsSum(rows);
  const diff = round2(total - sum);

  const update = (i: number, patch: Partial<InstallmentRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="w-20">
          <label className="text-[11px] text-white/40 mb-1 block">Cuotas</label>
          <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} className={inputClass} />
        </div>
        <button
          type="button"
          disabled={!(total > 0) || !(Number(count) >= 1)}
          onClick={() => onChange(evenInstallments(total, Math.floor(Number(count)), startDate))}
          className="text-xs text-acento-lima border border-acento-lima/30 rounded-lg px-3 py-2 hover:bg-acento-lima/10 disabled:opacity-40"
        >
          Repartir en partes iguales
        </button>
      </div>

      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-14 shrink-0">{i === 0 ? "Anticipo" : `Cuota ${i + 1}`}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={r.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
            className={inputClass}
          />
          <input type="date" value={r.dueDate} onChange={(e) => update(i, { dueDate: e.target.value })} className={inputClass} />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            className="text-white/30 hover:text-red-400 shrink-0"
            title="Quitar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...rows,
              {
                amount: diff > 0 ? String(diff) : "",
                dueDate: rows.length ? addMonthsKey(rows[rows.length - 1].dueDate, 1) : startDate,
              },
            ])
          }
          className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
        >
          <Plus size={13} /> Agregar cuota
        </button>
        <p className={`text-xs ${diff === 0 ? "text-white/40" : "text-amber-300"}`}>
          Suma {formatAmount(sum, currency)}
          {diff !== 0 && ` · ${diff > 0 ? "faltan" : "sobran"} ${formatAmount(Math.abs(diff), currency)}`}
        </p>
      </div>
    </div>
  );
}
