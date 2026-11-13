"use client";

import { AlertTriangle } from "lucide-react";

type Props = { warnings: string[]; confirmed: boolean; onConfirm: (value: boolean) => void };

export function DateWarnings({ warnings, confirmed, onConfirm }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
        <ul className="text-xs text-amber-100 space-y-1">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
      <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} className="accent-[#bdf61d]" />
        La fecha es correcta, guardar igual
      </label>
    </div>
  );
}
