"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { formatAmount } from "@/lib/format";
import { inputClass, selectClass, type Account, type Category } from "./types";

type Treatment = "YIELD" | "EXPENSE" | "ADJUSTMENT";

type Props = {
  account: Account | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

const OPTIONS: { value: Treatment; label: string; hint: string; sign: 1 | -1 | 0 }[] = [
  { value: "YIELD", label: "Rendimiento", hint: "Suma como ingreso", sign: 1 },
  { value: "EXPENSE", label: "Gasto no registrado", hint: "Resta como egreso", sign: -1 },
  { value: "ADJUSTMENT", label: "Ajuste", hint: "Sin tocar ingresos ni egresos", sign: 0 },
];

export function AdjustBalanceModal({ account, categories, onClose, onSaved }: Props) {
  const [real, setReal] = useState("");
  const [treatment, setTreatment] = useState<Treatment>("ADJUSTMENT");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const accountId = account?.id ?? null;
  if (accountId !== lastId) {
    setLastId(accountId);
    if (account) {
      setReal("");
      setTreatment("ADJUSTMENT");
      setCategoryId("");
      setError(null);
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE" && c.active);
  const realValue = real === "" ? null : Number(real);
  const diff =
    account && realValue !== null && Number.isFinite(realValue)
      ? Math.round((realValue - account.balance) * 100) / 100
      : null;
  const allowed = (sign: number) => diff === null || diff === 0 || sign === 0 || Math.sign(diff) === sign;
  const effective = diff !== null && !allowed(OPTIONS.find((o) => o.value === treatment)!.sign) ? "ADJUSTMENT" : treatment;

  const submit = async () => {
    if (!account || diff === null) return setError("Ingresá el saldo real que ves hoy en la cuenta.");
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/accounts/${account.id}/reconcile`, {
      realBalance: realValue,
      treatment: effective,
      categoryId: effective === "EXPENSE" && categoryId ? categoryId : undefined,
    });
    setSaving(false);
    if (err) return setError(err);
    onClose();
    onSaved();
  };

  const currency = account?.currency ?? "ARS";

  return (
    <FormModal
      isOpen={account !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Ajustar saldo${account ? ` · ${account.name}` : ""}`}
      error={error}
      saving={saving}
      submitLabel={diff === 0 ? "Marcar verificado" : "Confirmar ajuste"}
      onSubmit={submit}
    >
      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between text-sm">
        <span className="text-white/50">Saldo según el sistema</span>
        <span className="font-semibold text-white">{account ? formatAmount(account.balance, currency) : "—"}</span>
      </div>

      <Field label={`Saldo real hoy (${currency}) *`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={real}
          onChange={(e) => setReal(e.target.value)}
          placeholder="Lo que muestra la app de Ualá"
          className={inputClass}
          autoFocus
        />
      </Field>

      {diff !== null && (
        <div
          className={`rounded-lg px-3 py-2 text-sm flex items-center justify-between border ${
            diff === 0
              ? "border-white/10 text-white/60"
              : diff > 0
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          <span>{diff === 0 ? "El saldo coincide" : diff > 0 ? "Hay más dinero del registrado" : "Hay menos dinero del registrado"}</span>
          {diff !== 0 && (
            <span className="font-semibold">
              {diff > 0 ? "+" : "-"}
              {formatAmount(Math.abs(diff), currency)}
            </span>
          )}
        </div>
      )}

      {diff !== null && diff !== 0 && (
        <>
          <div className="space-y-1">
            <p className="text-xs text-white/50">¿Qué es la diferencia?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {OPTIONS.filter((o) => allowed(o.sign)).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setTreatment(o.value)}
                  className={`rounded-lg px-3 py-2 text-left border transition-colors ${
                    effective === o.value
                      ? "border-acento-lima/50 bg-acento-lima/10 text-white"
                      : "border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-[11px] text-white/40">{o.hint}</p>
                </button>
              ))}
            </div>
          </div>
          {effective === "EXPENSE" && (
            <Field label="Categoría del egreso">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
                <option value="" className="bg-black">Gasto no registrado</option>
                {expenseCategories
                  .filter((c) => c.name !== "Gasto no registrado")
                  .map((c) => (
                    <option key={c.id} value={c.id} className="bg-black">
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </>
      )}
    </FormModal>
  );
}
