"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import {
  SplitEditor,
  normalizeSplit,
  splitIsValid,
  type DefaultSplitResponse,
  type SplitShare,
} from "@/components/finance/split-editor";
import { inputClass } from "../finanzas/types";

export type BillableContract = {
  id: string;
  label: string;
  paymentDay: number | null;
  splitShares: { userId: string | null; percent: string }[];
};

type Props = { contract: BillableContract | null; onClose: () => void; onSaved: () => void };

export function ContractBillingModal({ contract, onClose, onSaved }: Props) {
  const [paymentDay, setPaymentDay] = useState("");
  const [custom, setCustom] = useState(false);
  const [edited, setEdited] = useState<SplitShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const splitQ = useJson<DefaultSplitResponse>(contract ? "/api/splits/default" : null);
  const users = splitQ.data?.users ?? [];

  if ((contract?.id ?? null) !== current) {
    setCurrent(contract?.id ?? null);
    setPaymentDay(contract?.paymentDay ? String(contract.paymentDay) : "");
    setCustom(Boolean(contract?.splitShares.length));
    setEdited(null);
    setError(null);
  }

  const initial = contract?.splitShares.length
    ? contract.splitShares.map((s) => ({ userId: s.userId, percent: Number(s.percent) }))
    : splitQ.data?.shares;
  const shares = edited ?? normalizeSplit(initial, users);

  const submit = async () => {
    if (!contract) return;
    const day = paymentDay ? Number(paymentDay) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      return setError("El día de pago tiene que estar entre 1 y 31.");
    }
    if (custom && !splitIsValid(shares)) return setError("El reparto tiene que sumar 100%.");
    setSaving(true);
    setError(null);
    const err = await postJson(
      `/api/contracts/${contract.id}`,
      { paymentDay: day, shares: custom ? shares : null },
      "PATCH"
    );
    setSaving(false);
    if (err) return setError(err);
    onSaved();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(contract)}
      onOpenChange={(open) => !open && onClose()}
      title="Cobro y reparto"
      error={error}
      saving={saving}
      submitLabel="Guardar"
      onSubmit={submit}
    >
      {contract && <p className="text-sm text-white/60">{contract.label}</p>}
      <Field label="Día de pago del mes (1–31)">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={paymentDay}
          onChange={(e) => setPaymentDay(e.target.value)}
          placeholder="Por defecto: día 10"
          className={inputClass}
        />
      </Field>
      <p className="text-xs text-white/40 -mt-1">
        Se usa en las próximas facturas. Si el mes tiene menos días, vence el último día.
      </p>
      <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer pt-1">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="accent-[#bdf61d]" />
        Reparto propio para este contrato
      </label>
      {custom ? (
        users.length > 0 && <SplitEditor shares={shares} users={users} onChange={setEdited} />
      ) : (
        <p className="text-xs text-white/40">Usa el reparto por defecto (Finanzas → Configuración).</p>
      )}
    </FormModal>
  );
}
