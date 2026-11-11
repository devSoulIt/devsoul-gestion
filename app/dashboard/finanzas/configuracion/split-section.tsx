"use client";

import { useState } from "react";
import { postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import {
  SplitEditor,
  normalizeSplit,
  splitIsValid,
  type DefaultSplitResponse,
  type SplitShare,
} from "@/components/finance/split-editor";

export function SplitSection() {
  const { data, reload } = useJson<DefaultSplitResponse>("/api/splits/default");
  const [edited, setEdited] = useState<SplitShare[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const users = data?.users ?? [];
  const shares = edited ?? normalizeSplit(data?.shares, users);

  const save = async () => {
    if (!splitIsValid(shares)) return setMessage({ ok: false, text: "El reparto tiene que sumar 100%." });
    setSaving(true);
    const err = await postJson("/api/splits/default", { shares }, "PUT");
    setSaving(false);
    setMessage(err ? { ok: false, text: err } : { ok: true, text: "Reparto guardado." });
    if (!err) {
      setEdited(null);
      reload();
    }
  };

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white">Reparto por defecto</h2>
        <p className="text-xs text-white/40">
          Cómo se divide cada cobro entre los socios y la empresa. Cada contrato puede tener el suyo, y al cobrar se puede
          ajustar.
        </p>
      </div>
      {users.length > 0 && <SplitEditor shares={shares} users={users} onChange={setEdited} />}
      <div className="flex items-center justify-end gap-3">
        {message && <p className={`text-xs ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}
        <button
          onClick={save}
          disabled={saving || !edited}
          className="text-sm bg-acento-lima text-black font-medium rounded-lg px-4 py-2 disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Guardar reparto"}
        </button>
      </div>
    </section>
  );
}
