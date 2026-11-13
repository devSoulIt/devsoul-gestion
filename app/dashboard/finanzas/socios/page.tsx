"use client";

import { useState } from "react";
import { HandCoins, Undo2, Wallet } from "lucide-react";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { Field, FormModal, submitJson } from "@/components/form-modal";
import { DateWarnings } from "@/components/finance/date-warnings";
import { ReverseModal } from "@/components/finance/reverse-modal";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, todayKey, type CurrencyCode } from "@/lib/format";
import { inputClass, selectClass, type AccountsResponse } from "../types";

type Balance = { userId: string; name: string; accruedArs: number; paidArs: number; balanceArs: number };

type PartnerPaymentRow = {
  id: string;
  amount: string;
  currency: CurrencyCode;
  amountArs: string;
  date: string;
  concept: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  user: { id: string; name: string };
  account: { id: string; name: string; currency: CurrencyCode } | null;
  createdBy: { name: string } | null;
};

type AccrualRow = {
  id: string;
  user: { id: string; name: string };
  percent: string;
  amount: string;
  currency: CurrencyCode;
  amountArs: string;
  date: string;
  client: string | null;
  software: string | null;
};

type PartnerPaymentsResponse = { payments: PartnerPaymentRow[]; balances: Balance[] };
type PayoutsResponse = { payouts: AccrualRow[]; balances: Balance[] };

export default function SociosPage() {
  const paymentsQ = useJson<PartnerPaymentsResponse>("/api/partner-payments");
  const accrualsQ = useJson<PayoutsResponse>("/api/payouts");
  const accountsQ = useJson<AccountsResponse>("/api/accounts");
  const [paying, setPaying] = useState<string | null>(null);
  const [reversing, setReversing] = useState<{ url: string; title: string; detail: string } | null>(null);

  const balances = paymentsQ.data?.balances ?? [];
  const payments = paymentsQ.data?.payments ?? [];
  const accruals = accrualsQ.data?.payouts ?? [];
  const reload = () => {
    paymentsQ.reload();
    accrualsQ.reload();
  };

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <div className="glass rounded-xl p-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Socios</h1>
          <p className="text-xs text-white/40 mt-1">
            Cada cobro suma la parte de cada socio. Los pagos se cargan cuando se hacen, por el monto que sea, y se
            descuentan del total acumulado.
          </p>
        </div>
        <button
          onClick={() => setPaying(balances[0]?.userId ?? "")}
          className="shrink-0 flex items-center gap-1.5 text-sm bg-acento-lima text-black font-medium rounded-lg px-3 py-2"
        >
          <HandCoins size={15} />
          Registrar pago
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {balances.map((b) => (
          <div key={b.userId} className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-acento-lima/10 text-acento-lima">
                <Wallet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/50">{b.balanceArs >= 0 ? `A pagar a ${b.name}` : `Adelanto de ${b.name}`}</p>
                <p className={`text-lg font-semibold ${b.balanceArs >= 0 ? "text-white" : "text-amber-300"}`}>
                  {formatAmount(Math.abs(b.balanceArs))}
                </p>
              </div>
              <button
                onClick={() => setPaying(b.userId)}
                title={`Registrar pago a ${b.name}`}
                className="text-acento-lima hover:text-acento-lima/70"
              >
                <HandCoins size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-white/40">Acumulado</p>
                <p className="text-white tabular-nums">{formatAmount(b.accruedArs)}</p>
              </div>
              <div>
                <p className="text-white/40">Pagado</p>
                <p className="text-white tabular-nums">{formatAmount(b.paidArs)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70 px-1">Pagos realizados</h2>
        {paymentsQ.loading && !paymentsQ.data ? (
          <div className="glass rounded-xl h-20 animate-pulse" />
        ) : payments.length === 0 ? (
          <div className="glass rounded-xl py-10 text-center text-sm text-white/40">Todavía no hay pagos a socios.</div>
        ) : (
          <div className="glass rounded-xl divide-y divide-white/5">
            {payments.map((p) => (
              <div key={p.id} className={`px-4 py-2.5 flex items-center gap-3 text-sm ${p.reversedAt ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-white truncate">
                    {p.user.name}
                    {p.concept && <span className="text-white/50"> · {p.concept}</span>}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {formatDate(p.date)} · {p.account ? p.account.name : "Fuera de las cuentas de la empresa"}
                    {p.createdBy && ` · cargó ${p.createdBy.name}`}
                  </p>
                  {p.reversedAt && <p className="text-xs text-red-400/80">Revertido: {p.reverseReason}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`tabular-nums ${p.reversedAt ? "line-through text-white/50" : "text-white"}`}>
                    {formatAmount(p.amount, p.currency)}
                  </p>
                  {p.currency !== "ARS" && <p className="text-[10px] text-white/40">≈ {formatAmount(p.amountArs)}</p>}
                </div>
                {!p.reversedAt && (
                  <button
                    onClick={() =>
                      setReversing({
                        url: `/api/partner-payments/${p.id}/reverse`,
                        title: "Revertir pago a socio",
                        detail: `Pago a ${p.user.name} de ${formatAmount(p.amount, p.currency)} del ${formatDate(p.date)}.`,
                      })
                    }
                    title="Revertir pago"
                    className="shrink-0 p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-white/5"
                  >
                    <Undo2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {accruals.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white/70 px-1">Acumulado por cobro</h2>
          <div className="glass rounded-xl divide-y divide-white/5">
            {accruals.map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white truncate">
                    {a.user.name} · {a.client ?? "Cobro"}
                    {a.software && <span className="text-white/50"> · {a.software}</span>}
                  </p>
                  <p className="text-xs text-white/40">
                    {formatDate(a.date)} · {Number(a.percent).toLocaleString("es-AR")}%
                  </p>
                </div>
                <span className="text-white/70 tabular-nums shrink-0">+{formatAmount(a.amount, a.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <PartnerPaymentModal
        userId={paying}
        balances={balances}
        accounts={accountsQ.data?.accounts ?? []}
        onClose={() => setPaying(null)}
        onSaved={reload}
      />
      <ReverseModal target={reversing} onClose={() => setReversing(null)} onDone={reload} />
    </div>
  );
}

type ModalProps = {
  userId: string | null;
  balances: Balance[];
  accounts: AccountsResponse["accounts"];
  onClose: () => void;
  onSaved: () => void;
};

function PartnerPaymentModal({ userId, balances, accounts, onClose, onSaved }: ModalProps) {
  const [partner, setPartner] = useState("");
  const [accountId, setAccountId] = useState("");
  const [deduct, setDeduct] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>("ARS");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey());
  const [concept, setConcept] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDate, setConfirmDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<string | null>(null);

  if (userId !== session) {
    setSession(userId);
    if (userId !== null) {
      setPartner(userId || balances[0]?.userId || "");
      setAccountId((accounts.find((a) => a.currency === "ARS") ?? accounts[0])?.id ?? "");
      setDeduct(true);
      setCurrency("ARS");
      setAmount("");
      setDate(todayKey());
      setConcept("");
      setWarnings([]);
      setConfirmDate(false);
      setError(null);
    }
  }

  const balance = balances.find((b) => b.userId === partner);
  const account = deduct ? accounts.find((a) => a.id === accountId) : undefined;
  const payCurrency = account?.currency ?? currency;
  const value = Number(amount) || 0;
  const valueArs = payCurrency === "ARS" ? value : null;

  const submit = async () => {
    if (!partner) return setError("Elegí el socio.");
    if (deduct && !account) return setError("Elegí la cuenta desde la que pagaste.");
    if (!(value > 0)) return setError("Indicá el monto pagado.");
    if (warnings.length && !confirmDate) return setError("Confirmá la fecha para guardar.");
    setSaving(true);
    setError(null);
    const result = await submitJson("/api/partner-payments", {
      userId: partner,
      deductFromAccount: deduct,
      accountId: deduct ? accountId : undefined,
      currency: deduct ? undefined : currency,
      amount: value,
      date,
      confirmDate,
      concept: concept.trim() || undefined,
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
      isOpen={userId !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pago a socio"
      error={error}
      saving={saving}
      submitLabel="Registrar pago"
      onSubmit={submit}
    >
      <Field label="Socio *">
        <select value={partner} onChange={(e) => setPartner(e.target.value)} className={selectClass}>
          {balances.map((b) => (
            <option key={b.userId} value={b.userId} className="bg-black">
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      {balance && (
        <p className="text-xs text-white/50">
          {balance.balanceArs >= 0
            ? `Se le debe ${formatAmount(balance.balanceArs)} en total.`
            : `Ya tiene un adelanto de ${formatAmount(-balance.balanceArs)}.`}
          {valueArs !== null && value > 0 && (
            <span className="text-white/70">
              {" "}
              Después de este pago:{" "}
              {balance.balanceArs - valueArs >= 0
                ? `queda ${formatAmount(balance.balanceArs - valueArs)} por pagar.`
                : `queda un adelanto de ${formatAmount(valueArs - balance.balanceArs)}.`}
            </span>
          )}
        </p>
      )}
      <label className="flex items-start gap-2 text-sm text-white cursor-pointer">
        <input
          type="checkbox"
          checked={deduct}
          onChange={(e) => {
            setDeduct(e.target.checked);
            setWarnings([]);
            setConfirmDate(false);
          }}
          className="accent-[#bdf61d] mt-1"
        />
        <span>
          Descontar de una cuenta de la empresa
          <span className="block text-xs text-white/40">
            Destildalo si la plata no salió de Ualá u otra cuenta, por ejemplo si el cliente le pagó directo al socio.
          </span>
        </span>
      </label>
      <div className="flex gap-3">
        {deduct ? (
          <Field label="Cuenta *">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-black">
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Moneda *">
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className={selectClass}>
              <option value="ARS" className="bg-black">ARS</option>
              <option value="USD" className="bg-black">USD</option>
            </select>
          </Field>
        )}
        <Field label="Fecha *">
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
      <Field label={`Monto * (${payCurrency})`}>
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
      <Field label="Concepto">
        <input
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Ej: retiro, adelanto"
          className={inputClass}
        />
      </Field>
      <DateWarnings warnings={warnings} confirmed={confirmDate} onConfirm={setConfirmDate} />
      <p className="text-xs text-white/40">
        {deduct
          ? "Baja el saldo de la cuenta, pero no cuenta como gasto de la empresa."
          : "No mueve ninguna cuenta: solo descuenta lo que se le debe al socio."}
      </p>
    </FormModal>
  );
}
