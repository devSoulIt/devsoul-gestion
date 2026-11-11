"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { formatAmount, formatDate, todayKey } from "@/lib/format";
import { inputClass, selectClass, type Account, type YieldResponse } from "./types";

type Props = {
  accountId: string | null;
  accounts: Account[];
  data: YieldResponse | undefined;
  onClose: () => void;
  onSaved: () => void;
};

type Form = { accountId: string; date: string; amount: string };

function existingAmount(data: YieldResponse | undefined, accountId: string, date: string) {
  const day = data?.days.find((d) => d.daily && d.accountId === accountId && d.date === date);
  return day ? String(day.amount) : "";
}

export function YieldModal({ accountId, accounts, data, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>({ accountId: "", date: todayKey(), amount: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  if (accountId !== lastId) {
    setLastId(accountId);
    if (accountId) {
      const date = todayKey();
      setForm({ accountId, date, amount: existingAmount(data, accountId, date) });
      setError(null);
    }
  }

  const account = accounts.find((a) => a.id === form.accountId);
  const loaded = existingAmount(data, form.accountId, form.date);
  const change = (patch: Partial<Form>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      return patch.amount === undefined ? { ...next, amount: existingAmount(data, next.accountId, next.date) } : next;
    });

  const recent = (data?.days ?? []).filter((d) => d.accountId === form.accountId).slice(0, 5);
  const monthTotal = (data?.days ?? [])
    .filter((d) => d.accountId === form.accountId)
    .reduce((acc, d) => acc + d.amount, 0);

  const submit = async () => {
    const amount = Number(form.amount || 0);
    if (!form.accountId || !form.date || !Number.isFinite(amount) || amount < 0) {
      return setError("Ingresá un monto válido.");
    }
    if (amount === 0 && !loaded) return setError("Ingresá cuánto rindió la cuenta ese día.");
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/accounts/${form.accountId}/yield`, { amount, date: form.date }, "PUT");
    setSaving(false);
    if (err) return setError(err);
    onClose();
    onSaved();
  };

  const currency = account?.currency ?? "ARS";

  return (
    <FormModal
      isOpen={accountId !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Rendimiento diario"
      error={error}
      saving={saving}
      submitLabel={loaded ? (Number(form.amount || 0) === 0 ? "Borrar" : "Actualizar") : "Registrar"}
      onSubmit={submit}
    >
      <div className="flex gap-3">
        <Field label="Cuenta">
          <select value={form.accountId} onChange={(e) => change({ accountId: e.target.value })} className={selectClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-black">
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            value={form.date}
            max={todayKey()}
            onChange={(e) => change({ date: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={`Rendimiento del día (${currency})`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(e) => change({ amount: e.target.value })}
          placeholder="Lo que informa Ualá"
          className={inputClass}
          autoFocus
        />
      </Field>
      {loaded && (
        <p className="text-xs text-white/40">
          Ese día ya tiene {formatAmount(Number(loaded), currency)} cargado: se reemplaza. Con 0 se borra.
        </p>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">Total del mes</span>
          <span className="font-semibold text-acento-lima">{formatAmount(monthTotal, currency)}</span>
        </div>
        {recent.map((d) => (
          <div key={d.id} className="flex items-center justify-between text-xs text-white/40">
            <span>
              {formatDate(d.date)}
              {d.daily ? "" : " · ajuste"}
            </span>
            <span>{formatAmount(d.amount, d.currency)}</span>
          </div>
        ))}
      </div>
    </FormModal>
  );
}
