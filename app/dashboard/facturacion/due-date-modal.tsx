"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { formatDate } from "@/lib/format";
import { inputClass } from "../finanzas/types";
import type { InvoiceSummary } from "./cancel-invoice-modal";

type Props = { invoice: InvoiceSummary | null; onClose: () => void; onDone: () => void };

export function DueDateModal({ invoice, onClose, onDone }: Props) {
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((invoice?.id ?? null) !== current) {
    setCurrent(invoice?.id ?? null);
    setDueDate(invoice?.dueDate.slice(0, 10) ?? "");
    setError(null);
  }

  const submit = async () => {
    if (!invoice) return;
    if (!dueDate) return setError("Elegí la fecha.");
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/invoices/${invoice.id}/due-date`, { dueDate }, "PATCH");
    setSaving(false);
    if (err) return setError(err);
    onDone();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(invoice)}
      onOpenChange={(open) => !open && onClose()}
      title="Fecha de pago"
      error={error}
      saving={saving}
      submitLabel="Guardar"
      onSubmit={submit}
    >
      {invoice && (
        <p className="text-sm text-white/60">
          {invoice.clientName} · {invoice.period}. Ahora vence el {formatDate(invoice.dueDate)}.
        </p>
      )}
      <Field label="¿Qué día tiene que llegar el pago? *">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
      </Field>
      <p className="text-xs text-white/40">
        Cambia solo esta factura. Para todos los meses, editá el día de pago en el contrato.
      </p>
    </FormModal>
  );
}
