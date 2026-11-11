"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { formatAmount, todayKey, type CurrencyCode } from "@/lib/format";
import { useJson } from "@/lib/hooks/use-json";
import {
  SplitEditor,
  normalizeSplit,
  splitIsValid,
  type DefaultSplitResponse,
  type SplitShare,
} from "@/components/finance/split-editor";
import { inputClass, selectClass, type Account } from "../finanzas/types";

export type PayableInvoice = {
  id: string;
  amount: string;
  currency: CurrencyCode;
  period: string;
  clientName: string;
  contractShares: SplitShare[];
};

type Props = {
  invoice: PayableInvoice | null;
  accounts: Account[];
  onClose: () => void;
  onPaid: () => void;
};

export function PayInvoiceModal({ invoice, accounts, onClose, onPaid }: Props) {
  const [accountId, setAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayKey());
  const [amountReceived, setAmountReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [editedShares, setEditedShares] = useState<SplitShare[] | null>(null);
  const splitQ = useJson<DefaultSplitResponse>(invoice ? "/api/splits/default" : null);
  const users = splitQ.data?.users ?? [];

  if ((invoice?.id ?? null) !== current) {
    setCurrent(invoice?.id ?? null);
    if (invoice) {
      setAccountId((accounts.find((a) => a.currency === invoice.currency) ?? accounts[0])?.id ?? "");
      setPaymentDate(todayKey());
      setAmountReceived("");
      setEditedShares(null);
      setError(null);
    }
  }

  const account = accounts.find((a) => a.id === accountId);
  const crossCurrency = Boolean(invoice && account && account.currency !== invoice.currency);
  const fromContract = Boolean(invoice?.contractShares.length);
  const shares =
    editedShares ?? normalizeSplit(fromContract ? invoice?.contractShares : splitQ.data?.shares, users);
  const splitAmount = crossCurrency ? Number(amountReceived) || 0 : Number(invoice?.amount ?? 0);
  const splitCurrency = (crossCurrency ? account?.currency : invoice?.currency) ?? "ARS";

  const submit = async () => {
    if (!invoice || !account) return setError("Elegí la cuenta donde ingresó el cobro.");
    if (crossCurrency && !(Number(amountReceived) > 0)) {
      return setError(`Indicá el monto recibido en ${account.currency}.`);
    }
    if (users.length > 0 && !splitIsValid(shares)) return setError("El reparto tiene que sumar 100%.");
    setSaving(true);
    setError(null);
    const err = await postJson(
      `/api/invoices/${invoice.id}`,
      {
        accountId,
        paymentDate,
        amountReceived: crossCurrency ? Number(amountReceived) : undefined,
        shares: users.length > 0 ? shares : undefined,
      },
      "PATCH"
    );
    setSaving(false);
    if (err) return setError(err);
    onPaid();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(invoice)}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar cobro"
      error={error}
      saving={saving}
      submitLabel="Marcar cobrada"
      onSubmit={submit}
    >
      {invoice && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
          <p className="text-sm text-white">{invoice.clientName}</p>
          <p className="text-xs text-white/50">
            Período {invoice.period} · {formatAmount(invoice.amount, invoice.currency)}
          </p>
        </div>
      )}
      {accounts.length === 0 ? (
        <p className="text-sm text-white/50">Primero creá una cuenta en Finanzas → Configuración.</p>
      ) : (
        <>
          <div className="flex gap-3">
            <Field label="Cuenta destino *">
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-black">
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de cobro *">
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
          {crossCurrency && (
            <Field label={`Monto recibido * (${account?.currency})`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          {users.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-white/50">Reparto de este cobro</p>
                <p className="text-[11px] text-white/30">{fromContract ? "Reparto del contrato" : "Reparto por defecto"}</p>
              </div>
              <SplitEditor
                shares={shares}
                users={users}
                onChange={setEditedShares}
                amount={splitAmount}
                currency={splitCurrency}
              />
            </div>
          )}
        </>
      )}
    </FormModal>
  );
}
