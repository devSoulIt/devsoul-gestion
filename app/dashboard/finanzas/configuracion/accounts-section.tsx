"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, todayKey } from "@/lib/format";
import {
  PROVIDER_LABELS,
  inputClass,
  selectClass,
  type Account,
  type AccountsResponse,
  type Provider,
} from "../types";

type Form = {
  name: string;
  provider: Provider;
  currency: "ARS" | "USD";
  openingBalance: string;
  openingDate: string;
  active: boolean;
  earnsYield: boolean;
};

const EMPTY: Form = {
  name: "",
  provider: "UALA",
  currency: "ARS",
  openingBalance: "0",
  openingDate: todayKey(),
  active: true,
  earnsYield: false,
};

export function AccountsSection() {
  const { data, reload } = useJson<AccountsResponse>("/api/accounts?all=true");
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openModal = (account: Account | null) => {
    setEditing(account);
    setForm(
      account
        ? {
            name: account.name,
            provider: account.provider,
            currency: account.currency,
            openingBalance: String(account.openingBalance),
            openingDate: account.openingDate.slice(0, 10),
            active: account.active,
            earnsYield: account.earnsYield,
          }
        : { ...EMPTY, openingDate: todayKey() }
    );
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.openingDate || Number.isNaN(Number(form.openingBalance))) {
      setError("Completá nombre, saldo inicial y fecha de apertura.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { ...form, openingBalance: Number(form.openingBalance) };
    const err = editing
      ? await postJson(`/api/accounts/${editing.id}`, payload, "PATCH")
      : await postJson("/api/accounts", payload);
    setSaving(false);
    if (err) return setError(err);
    setOpen(false);
    reload();
  };

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Cuentas</h2>
          <p className="text-xs text-white/40">Dónde está el dinero. El saldo = saldo inicial + movimientos.</p>
        </div>
        <button
          onClick={() => openModal(null)}
          className="flex items-center gap-1 text-sm bg-acento-lima text-black font-medium rounded-lg px-3 py-1.5 flex-shrink-0"
        >
          <Plus size={14} />
          Cuenta
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {(data?.accounts ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className={`text-sm font-medium ${a.active ? "text-white" : "text-white/40 line-through"}`}>
                {a.name}
              </p>
              <p className="text-xs text-white/40">
                {PROVIDER_LABELS[a.provider]} · {a.currency} · Inicial {formatAmount(a.openingBalance, a.currency)} al{" "}
                {formatDate(a.openingDate)}
                {a.earnsYield ? " · Remunerada" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <p className="text-sm font-semibold text-white">{formatAmount(a.balance, a.currency)}</p>
              <button
                onClick={() => openModal(a)}
                className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
        ))}
        {data && data.accounts.length === 0 && (
          <p className="text-sm text-white/40 py-3">Todavía no hay cuentas.</p>
        )}
      </div>

      <FormModal
        isOpen={open}
        onOpenChange={setOpen}
        title={editing ? "Editar cuenta" : "Nueva cuenta"}
        error={error}
        saving={saving}
        submitLabel="Guardar"
        onSubmit={submit}
      >
        <Field label="Nombre *">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} placeholder="Ualá ARS" />
        </Field>
        <div className="flex gap-3">
          <Field label="Tipo">
            <select value={form.provider} onChange={(e) => set("provider", e.target.value as Provider)} className={selectClass}>
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                <option key={p} value={p} className="bg-black">{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Moneda">
            <select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value as Form["currency"])}
              disabled={Boolean(editing)}
              className={`${selectClass} disabled:opacity-50`}
            >
              <option value="ARS" className="bg-black">ARS</option>
              <option value="USD" className="bg-black">USD</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-3">
          <Field label={`Saldo inicial (${form.currency})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) => set("openingBalance", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Fecha de apertura">
            <input type="date" value={form.openingDate} onChange={(e) => set("openingDate", e.target.value)} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={form.earnsYield}
            onChange={(e) => set("earnsYield", e.target.checked)}
            className="accent-[#bdf61d]"
          />
          Cuenta remunerada (rinde todos los días)
        </label>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="accent-[#bdf61d]" />
            Cuenta activa
          </label>
        )}
      </FormModal>
    </section>
  );
}
