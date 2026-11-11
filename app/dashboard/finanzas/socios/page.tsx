"use client";

import { useState } from "react";
import { HandCoins, Wallet } from "lucide-react";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, todayKey, type CurrencyCode } from "@/lib/format";
import { inputClass, selectClass, type AccountsResponse } from "../types";

type PayoutRow = {
  id: string;
  userId: string;
  percent: string;
  amount: string;
  amountArs: string;
  currency: CurrencyCode;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; name: string };
  invoice: {
    id: string;
    period: string;
    transaction: { accountId: string } | null;
    contract: { client: { companyName: string }; software: { name: string } };
  };
};

type PayoutsResponse = {
  payouts: PayoutRow[];
  totals: { userId: string; name: string; pendingArs: number; count: number }[];
};

export default function SociosPage() {
  const pendingQ = useJson<PayoutsResponse>("/api/payouts?status=PENDING");
  const paidQ = useJson<PayoutsResponse>("/api/payouts?status=PAID");
  const accountsQ = useJson<AccountsResponse>("/api/accounts");
  const [paying, setPaying] = useState<PayoutRow | null>(null);

  const totals = pendingQ.data?.totals ?? [];
  const pending = pendingQ.data?.payouts ?? [];
  const paid = paidQ.data?.payouts ?? [];
  const reload = () => {
    pendingQ.reload();
    paidQ.reload();
  };

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <div className="glass rounded-xl p-4">
        <h1 className="text-xl font-bold text-white">Pagos a socios</h1>
        <p className="text-xs text-white/40 mt-1">
          Cada cobro se reparte según el contrato. Marcá cada parte como pagada cuando la transfieras.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {totals.map((t) => (
          <div key={t.userId} className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-acento-lima/10 text-acento-lima">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/50">A pagar a {t.name}</p>
              <p className="text-lg font-semibold text-white">{formatAmount(t.pendingArs)}</p>
              <p className="text-xs text-white/40">
                {t.count} cobro{t.count === 1 ? "" : "s"} pendiente{t.count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70 px-1">Pendientes</h2>
        {pendingQ.loading && !pendingQ.data ? (
          <div className="glass rounded-xl h-20 animate-pulse" />
        ) : pending.length === 0 ? (
          <div className="glass rounded-xl py-10 text-center text-sm text-white/40">No hay pagos pendientes a socios.</div>
        ) : (
          pending.map((p) => (
            <div key={p.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {p.user.name} · {formatAmount(p.amount, p.currency)}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {p.invoice.contract.client.companyName} · {p.invoice.contract.software.name} · {p.invoice.period} ·{" "}
                  {Number(p.percent).toLocaleString("es-AR")}%
                </p>
              </div>
              <button
                onClick={() => setPaying(p)}
                className="shrink-0 flex items-center gap-1.5 text-sm bg-acento-lima text-black font-medium rounded-lg px-3 py-2"
              >
                <HandCoins size={15} />
                Pagar
              </button>
            </div>
          ))
        )}
      </section>

      {paid.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/70 px-1">Pagados</h2>
          <div className="glass rounded-xl divide-y divide-white/5">
            {paid.map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white truncate">
                    {p.user.name} · {p.invoice.contract.client.companyName} · {p.invoice.period}
                  </p>
                  <p className="text-xs text-white/40">{p.paidAt ? `Pagado el ${formatDate(p.paidAt)}` : ""}</p>
                </div>
                <span className="text-white/70 tabular-nums shrink-0">{formatAmount(p.amount, p.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <PayPayoutModal
        payout={paying}
        accounts={accountsQ.data?.accounts ?? []}
        onClose={() => setPaying(null)}
        onPaid={reload}
      />
    </div>
  );
}

type ModalProps = {
  payout: PayoutRow | null;
  accounts: AccountsResponse["accounts"];
  onClose: () => void;
  onPaid: () => void;
};

function PayPayoutModal({ payout, accounts, onClose, onPaid }: ModalProps) {
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  if ((payout?.id ?? null) !== current) {
    setCurrent(payout?.id ?? null);
    if (payout) {
      const fromInvoice = accounts.find((a) => a.id === payout.invoice.transaction?.accountId);
      setAccountId((fromInvoice ?? accounts.find((a) => a.currency === payout.currency) ?? accounts[0])?.id ?? "");
      setDate(todayKey());
      setAmountPaid("");
      setError(null);
    }
  }

  const account = accounts.find((a) => a.id === accountId);
  const crossCurrency = Boolean(payout && account && account.currency !== payout.currency);

  const submit = async () => {
    if (!payout || !account) return setError("Elegí la cuenta desde la que pagaste.");
    if (crossCurrency && !(Number(amountPaid) > 0)) return setError(`Indicá el monto pagado en ${account.currency}.`);
    setSaving(true);
    setError(null);
    const err = await postJson(`/api/payouts/${payout.id}/pay`, {
      accountId,
      date,
      amountPaid: crossCurrency ? Number(amountPaid) : undefined,
    });
    setSaving(false);
    if (err) return setError(err);
    onPaid();
    onClose();
  };

  return (
    <FormModal
      isOpen={Boolean(payout)}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pago a socio"
      error={error}
      saving={saving}
      submitLabel="Marcar pagado"
      onSubmit={submit}
    >
      {payout && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
          <p className="text-sm text-white">
            {payout.user.name} · {formatAmount(payout.amount, payout.currency)}
          </p>
          <p className="text-xs text-white/50">
            {payout.invoice.contract.client.companyName} · {payout.invoice.period}
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <Field label="Cuenta *">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-black">
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {crossCurrency && (
        <Field label={`Monto pagado * (${account?.currency})`}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}
      <p className="text-xs text-white/40">Baja el saldo de la cuenta, pero no cuenta como gasto de la empresa.</p>
    </FormModal>
  );
}
