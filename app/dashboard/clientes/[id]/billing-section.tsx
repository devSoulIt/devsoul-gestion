"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, ExternalLink, HandCoins, Undo2 } from "lucide-react";
import { formatAmount, formatDate, type CurrencyCode } from "@/lib/format";
import { useJson } from "@/lib/hooks/use-json";
import { PaymentModal, type PaymentTarget } from "@/components/finance/payment-modal";
import { ReverseModal } from "@/components/finance/reverse-modal";
import type { TaskDefaults } from "@/components/tasks/types";
import type { AccountsResponse } from "../../finanzas/types";
import type { ClientContract, ClientDetail, InvoiceRow } from "./types";

type Props = {
  detail: ClientDetail;
  onNewTask: (defaults?: TaskDefaults) => void;
  onChanged: () => void;
};

type PaymentRow = {
  id: string;
  amount: string;
  currency: CurrencyCode;
  appliedAmount: string;
  appliedCurrency: CurrencyCode;
  date: string;
  notes: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  account: { name: string };
  contract: { id: string; software: { name: string } };
  allocations: { amount: string; invoice: { id: string; period: string } }[];
  createdBy: { name: string } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function targetFor(c: ClientContract, clientName: string): PaymentTarget {
  return {
    contractId: c.id,
    title: `${c.software.name}${c.project ? ` · ${c.project.name}` : ""}`,
    subtitle: clientName,
    currency: c.currency,
    pending: Math.max(0, c.account?.balance ?? 0),
    shares: c.splitShares.map((s) => ({ userId: s.userId, percent: Number(s.percent) })),
  };
}

export function BillingSection({ detail, onNewTask, onChanged }: Props) {
  const { pending, paid } = detail.invoices;
  const { summary } = detail;
  const [collecting, setCollecting] = useState<PaymentTarget[] | null>(null);
  const [reversing, setReversing] = useState<{ url: string; title: string; detail: string } | null>(null);
  const accountsQ = useJson<AccountsResponse>("/api/accounts");
  const paymentsQ = useJson<PaymentRow[]>(`/api/payments?clientId=${detail.client.id}&includeReversed=true`);
  const payments = paymentsQ.data ?? [];
  const contracts = detail.contracts.filter((c) => c.active || (c.account?.balance ?? 0) > 0);
  const targets = contracts.map((c) => targetFor(c, detail.client.companyName));

  const refresh = () => {
    onChanged();
    paymentsQ.reload();
  };

  const row = (invoice: InvoiceRow) => {
    const paidPart = Number(invoice.paidAmount);
    const partial = invoice.status === "PENDING" && paidPart > 0;
    return (
      <li
        key={invoice.id}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
          invoice.overdue ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white">
            {invoice.contract.software.name}
            <span className="text-white/40"> · {invoice.period}</span>
          </p>
          <p className="text-[11px] text-white/45">
            {invoice.status === "PAID"
              ? `Cobrada el ${invoice.paymentDate ? formatDate(invoice.paymentDate) : "—"}`
              : `${invoice.overdue ? "Venció" : "Vence"} el ${formatDate(invoice.dueDate)}`}
            {invoice.contract.project && ` · ${invoice.contract.project.name}`}
          </p>
          {partial && (
            <p className="text-[11px] text-amber-300/90">
              Cobrado {formatAmount(paidPart, invoice.currency)} · falta{" "}
              {formatAmount(round2(Number(invoice.amount) - paidPart), invoice.currency)}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p
            className={`text-sm font-semibold ${invoice.overdue ? "text-red-400" : invoice.status === "PAID" ? "text-green-400" : "text-white"}`}
          >
            {formatAmount(invoice.amount, invoice.currency)}
          </p>
          {invoice.currency !== "ARS" && <p className="text-[10px] text-white/40">≈ {formatAmount(invoice.amountArs)}</p>}
        </div>
        {invoice.status === "PENDING" && (
          <button
            type="button"
            onClick={() =>
              onNewTask({
                type: "COLLECTION",
                invoiceId: invoice.id,
                projectId: invoice.contract.project?.id,
                title: `Cobrar ${invoice.contract.software.name} ${invoice.period}`,
              })
            }
            aria-label="Crear recordatorio de cobro"
            className="flex-shrink-0 rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-acento-lima"
          >
            <BellRing size={14} />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white/70">Cuenta corriente</p>
            <p className="text-xs text-white/40">Lo pactado, lo cobrado y lo que falta por contrato.</p>
          </div>
          {targets.length > 0 && (
            <button
              type="button"
              onClick={() => setCollecting(targets)}
              className="flex items-center gap-1.5 text-sm bg-acento-lima text-black font-medium rounded-lg px-3 py-1.5"
            >
              <HandCoins size={15} />
              Registrar cobro
            </button>
          )}
        </div>
        {contracts.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">No tiene contratos activos.</p>
        ) : (
          <ul className="space-y-2">
            {contracts.map((c) => {
              const acc = c.account;
              const base = acc ? acc.agreed ?? acc.invoiced : 0;
              const progress = acc && base > 0 ? Math.min(100, (acc.collected / base) * 100) : 0;
              return (
                <li key={c.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white truncate">
                      {c.software.name}
                      {c.project && <span className="text-white/40"> · {c.project.name}</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCollecting([targetFor(c, detail.client.companyName)])}
                      title="Registrar cobro"
                      className="text-acento-lima hover:text-acento-lima/70 shrink-0"
                    >
                      <HandCoins size={16} />
                    </button>
                  </div>
                  {acc && (
                    <>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-acento-lima" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-white/40">{acc.agreed !== null ? "Pactado" : "Facturado"}</p>
                          <p className="text-white tabular-nums">{formatAmount(base, c.currency)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">Cobrado</p>
                          <p className="text-green-400 tabular-nums">{formatAmount(acc.collected, c.currency)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">{acc.balance < 0 ? "A favor" : "Falta"}</p>
                          <p className={`tabular-nums ${acc.balance > 0 ? "text-amber-300" : "text-white/70"}`}>
                            {formatAmount(Math.abs(acc.balance), c.currency)}
                          </p>
                        </div>
                      </div>
                      {acc.credit > 0 && (
                        <p className="text-[11px] text-acento-lima/80">
                          {formatAmount(acc.credit, c.currency)} sin aplicar: se descuentan de la próxima factura.
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="glass rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white/70">Pendientes de cobro</p>
            <p className="text-xs text-white/40">
              {formatAmount(summary.pendingArs)} en total
              {summary.overdueCount > 0 && (
                <span className="text-red-400">
                  {" "}
                  · {summary.overdueCount} vencida{summary.overdueCount === 1 ? "" : "s"} ({formatAmount(summary.overdueArs)})
                </span>
              )}
            </p>
          </div>
          <Link href="/dashboard/facturacion" className="flex items-center gap-1 text-xs text-white/50 hover:text-acento-lima">
            Facturación
            <ExternalLink size={12} />
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">No tiene facturas pendientes.</p>
        ) : (
          <ul className="space-y-1.5">{pending.map(row)}</ul>
        )}
      </div>

      <div className="glass rounded-xl p-4">
        <p className="mb-3 text-sm font-semibold text-white/70">Cobros recibidos</p>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Todavía no hay cobros registrados.</p>
        ) : (
          <ul className="space-y-1.5">
            {payments.map((p) => {
              const applied = round2(p.allocations.reduce((acc, a) => acc + Number(a.amount), 0));
              const unapplied = round2(Number(p.appliedAmount) - applied);
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 ${p.reversedAt ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {p.contract.software.name}
                      <span className="text-white/40"> · {formatDate(p.date)}</span>
                    </p>
                    <p className="text-[11px] text-white/45 truncate">
                      {p.account.name}
                      {p.allocations.length > 0 && ` · aplicado a ${p.allocations.map((a) => a.invoice.period).join(", ")}`}
                      {!p.reversedAt && unapplied > 0 && ` · ${formatAmount(unapplied, p.appliedCurrency)} a favor`}
                      {p.notes && ` · ${p.notes}`}
                    </p>
                    {p.reversedAt && (
                      <p className="text-[11px] text-red-400/80">Revertido: {p.reverseReason}</p>
                    )}
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${p.reversedAt ? "text-white/50 line-through" : "text-green-400"}`}>
                    {formatAmount(p.amount, p.currency)}
                  </p>
                  {!p.reversedAt && (
                    <button
                      type="button"
                      onClick={() =>
                        setReversing({
                          url: `/api/payments/${p.id}/reverse`,
                          title: "Revertir cobro",
                          detail: `Cobro de ${formatAmount(p.amount, p.currency)} del ${formatDate(p.date)} en ${p.account.name}.`,
                        })
                      }
                      title="Revertir cobro"
                      className="flex-shrink-0 rounded p-1.5 text-white/30 hover:bg-white/5 hover:text-red-400"
                    >
                      <Undo2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {paid.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-white/40">Facturas cobradas</summary>
            <ul className="mt-2 space-y-1.5">{paid.map(row)}</ul>
          </details>
        )}
      </div>

      <PaymentModal
        open={collecting !== null}
        targets={collecting ?? []}
        accounts={accountsQ.data?.accounts ?? []}
        onClose={() => setCollecting(null)}
        onSaved={refresh}
      />
      <ReverseModal target={reversing} onClose={() => setReversing(null)} onDone={refresh} />
    </div>
  );
}
