"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { fieldClass } from "@/components/tasks/types";
import { INTERACTION_TYPE_LABELS, type InteractionTypeCode } from "@/lib/tasks/labels";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSaved: () => void;
};

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function InteractionModal({ isOpen, onOpenChange, clientId, onSaved }: Props) {
  const [type, setType] = useState<InteractionTypeCode>("WHATSAPP");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setType("WHATSAPP");
      setNote("");
      setOccurredAt(nowLocal());
      setError(null);
    }
  }

  const submit = async () => {
    if (!note.trim()) return setError("Contá brevemente de qué se habló.");
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/clients/${clientId}/interactions`, {
      type,
      note,
      occurredAt: new Date(occurredAt).toISOString(),
    });
    setSaving(false);
    if (err) return setError(err);
    onOpenChange(false);
    onSaved();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Registrar contacto"
      error={error}
      saving={saving}
      submitLabel="Registrar"
      onSubmit={submit}
    >
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {(Object.keys(INTERACTION_TYPE_LABELS) as InteractionTypeCode[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg border py-1.5 text-xs transition-colors ${
              type === t
                ? "border-acento-lima/50 bg-acento-lima/10 text-acento-lima"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {INTERACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <Field label="Cuándo">
        <input
          type="datetime-local"
          value={occurredAt}
          max={nowLocal()}
          onChange={(e) => setOccurredAt(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <Field label="Nota *">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Ej: Confirmó que paga la cuota el viernes."
          className={`${fieldClass} resize-none`}
          autoFocus
        />
      </Field>
    </FormModal>
  );
}
