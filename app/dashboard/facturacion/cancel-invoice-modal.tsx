"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { formatAmount, type CurrencyCode } from "@/lib/format";
import { inputClass } from "../finanzas/types";

export type InvoiceSummary = {
  id: string;
  amount: string;
  currency: CurrencyCode;
  period: string;
  clientName: string;
  dueDate: string;
};

const QUICK_REASONS = ["El cliente dio de baja el servicio", "Error de carga", "Bonificada", "Se refacturó"];

type Props = { invoice: InvoiceSummary | null; onClose: () => void; onDone: () => void };

export function CancelInvoiceModal({ invoice, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((invoice?.id ?? null) !== current) {
    setCurrent(invoice?.id ?? null);
    setReason("");
    setError(null);
  }

  const submit = async () => {
    if (!invoice) return;
    if (!reason.trim()) return setError("Indicá el motivo de la cancelación.");
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/invoices/${invoice.id}/cancel`, { reason: reason.trim() });
    setSaving(false);
    if (err) return setError(err);
    onDone();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(invoice)}
      onOpenChange={(open) => !open && onClose()}
      title="Cancelar factura"
      error={error}
      saving={saving}
      submitLabel="Cancelar factura"
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
      <div className="flex flex-wrap gap-2">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
              reason === r ? "border-acento-lima text-acento-lima bg-acento-lima/10" : "border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <Field label="Motivo *">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Contá por qué se cancela"
          className={`${inputClass} resize-none`}
        />
      </Field>
      <p className="text-xs text-white/40">La factura queda en el historial como cancelada y deja de contar como pendiente.</p>
    </FormModal>
  );
}
