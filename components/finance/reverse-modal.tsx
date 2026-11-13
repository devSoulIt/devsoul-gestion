"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";

type Props = {
  target: { url: string; title: string; detail: string } | null;
  onClose: () => void;
  onDone: () => void;
};

export function ReverseModal({ target, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((target?.url ?? null) !== current) {
    setCurrent(target?.url ?? null);
    setReason("");
    setError(null);
  }

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) return setError("Indicá el motivo.");
    setSaving(true);
    const err = await postJson(target.url, { reason: reason.trim() });
    setSaving(false);
    if (err) return setError(err);
    onDone();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={target?.title ?? "Revertir"}
      error={error}
      saving={saving}
      submitLabel="Revertir"
      onSubmit={submit}
    >
      {target && <p className="text-sm text-white/70">{target.detail}</p>}
      <Field label="Motivo *">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: cargado con la fecha equivocada"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50"
        />
      </Field>
      <p className="text-xs text-white/40">Se borra el movimiento de la cuenta y queda registrado en la auditoría.</p>
    </FormModal>
  );
}
