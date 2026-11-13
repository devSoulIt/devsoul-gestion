"use client";

import { useState } from "react";
import { Field, FormModal, submitJson } from "@/components/form-modal";
import { DateWarnings } from "@/components/finance/date-warnings";
import {
  SplitEditor,
  normalizeSplit,
  splitIsValid,
  type DefaultSplitResponse,
  type SplitShare,
} from "@/components/finance/split-editor";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, todayKey, type CurrencyCode } from "@/lib/format";

export type PaymentTarget = {
  contractId: string;
  invoiceId?: string;
  title: string;
  subtitle: string;
  currency: CurrencyCode;
  pending: number;
  shares: SplitShare[];
};

export type PaymentAccount = { id: string; name: string; currency: CurrencyCode };

type Props = {
  open: boolean;
  targets: PaymentTarget[];
  accounts: PaymentAccount[];
  onClose: () => void;
  onSaved: () => void;
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors [color-scheme:dark]";

export function PaymentModal({ open, targets, accounts, onClose, onSaved }: Props) {
  const [targetKey, setTargetKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState("");
  const [appliedAmount, setAppliedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [editedShares, setEditedShares] = useState<SplitShare[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDate, setConfirmDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const splitQ = useJson<DefaultSplitResponse>(open ? "/api/splits/default" : null);
  const users = splitQ.data?.users ?? [];

  const keyOf = (t: PaymentTarget) => t.invoiceId ?? t.contractId;
  const openKey = open ? targets.map(keyOf).join("|") : null;

  const reset = (target: PaymentTarget | undefined) => {
    setTargetKey(target ? keyOf(target) : "");
    setAccountId((accounts.find((a) => a.currency === target?.currency) ?? accounts[0])?.id ?? "");
    setAmount(target && target.pending > 0 ? String(target.pending) : "");
    setAppliedAmount("");
    setEditedShares(null);
    setWarnings([]);
    setConfirmDate(false);
    setError(null);
  };

  if (openKey !== session) {
    setSession(openKey);
    if (open) {
      reset(targets[0]);
      setDate(todayKey());
      setNotes("");
    }
  }

  const target = targets.find((t) => keyOf(t) === targetKey);
  const account = accounts.find((a) => a.id === accountId);
  const crossCurrency = Boolean(target && account && account.currency !== target.currency);
  const shares = editedShares ?? normalizeSplit(target?.shares.length ? target.shares : splitQ.data?.shares, users);
  const numericAmount = Number(amount) || 0;
  const diff = target && !crossCurrency ? Math.round((numericAmount - target.pending) * 100) / 100 : 0;

  const submit = async () => {
    if (!target) return setError("Elegí el contrato.");
    if (!account) return setError("Elegí la cuenta donde ingresó el cobro.");
    if (!(numericAmount > 0)) return setError("Indicá el monto cobrado.");
    if (users.length > 0 && !splitIsValid(shares)) return setError("El reparto tiene que sumar 100%.");
    if (warnings.length && !confirmDate) return setError("Confirmá la fecha para guardar.");

    setSaving(true);
    setError(null);
    const result = await submitJson("/api/payments", {
      contractId: target.contractId,
      invoiceIds: target.invoiceId ? [target.invoiceId] : undefined,
      accountId,
      amount: numericAmount,
      appliedAmount: crossCurrency && Number(appliedAmount) > 0 ? Number(appliedAmount) : undefined,
      date,
      confirmDate,
      notes: notes.trim() || undefined,
      shares: users.length > 0 ? shares : undefined,
    });
    setSaving(false);
    if (result.warnings.length) {
      setWarnings(result.warnings);
      setConfirmDate(false);
      return setError(result.error);
    }
    if (result.error) return setError(result.error);
    onSaved();
    onClose();
  };

  return (
    <FormModal
      isOpen={open}
      onOpenChange={(o) => !o && onClose()}
      title="Registrar cobro"
      error={error}
      saving={saving}
      submitLabel="Registrar cobro"
      onSubmit={submit}
    >
      {targets.length > 1 ? (
        <Field label="Contrato *">
          <select value={targetKey} onChange={(e) => reset(targets.find((t) => keyOf(t) === e.target.value))} className={inputClass}>
            {targets.map((t) => (
              <option key={keyOf(t)} value={keyOf(t)} className="bg-black">
                {t.title} — falta {formatAmount(t.pending, t.currency)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        target && (
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
            <p className="text-sm text-white">{target.title}</p>
            <p className="text-xs text-white/50">
              {target.subtitle} · falta {formatAmount(target.pending, target.currency)}
            </p>
          </div>
        )
      )}

      {accounts.length === 0 ? (
        <p className="text-sm text-white/50">Primero creá una cuenta en Finanzas → Configuración.</p>
      ) : (
        <>
          <div className="flex gap-3">
            <Field label="Cuenta destino *">
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-black">
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de cobro *">
              <input
                type="date"
                value={date}
                max={todayKey()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setWarnings([]);
                  setConfirmDate(false);
                }}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label={`Monto cobrado * (${account?.currency ?? target?.currency ?? "ARS"})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </Field>
          {target && !crossCurrency && numericAmount > 0 && diff !== 0 && (
            <p className="text-xs text-white/50">
              {diff < 0
                ? `Cobro parcial: quedan ${formatAmount(-diff, target.currency)} pendientes.`
                : `Sobran ${formatAmount(diff, target.currency)}: quedan como saldo a favor del cliente en este contrato.`}
            </p>
          )}
          {crossCurrency && target && (
            <Field label={`Equivale a (${target.currency}) — opcional`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={appliedAmount}
                onChange={(e) => setAppliedAmount(e.target.value)}
                placeholder="Si lo dejás vacío se usa la cotización del día"
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Nota">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className={inputClass} />
          </Field>
          <DateWarnings warnings={warnings} confirmed={confirmDate} onConfirm={setConfirmDate} />
          {users.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-white/50">Reparto de este cobro</p>
              <SplitEditor
                shares={shares}
                users={users}
                onChange={setEditedShares}
                amount={numericAmount}
                currency={account?.currency ?? "ARS"}
              />
            </div>
          )}
        </>
      )}
    </FormModal>
  );
}
