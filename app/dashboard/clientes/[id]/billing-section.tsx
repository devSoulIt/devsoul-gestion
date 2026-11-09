"use client";

import Link from "next/link";
import { BellRing, ExternalLink } from "lucide-react";
import { formatAmount, formatDate } from "@/lib/format";
import type { TaskDefaults } from "@/components/tasks/types";
import type { ClientDetail, InvoiceRow } from "./types";

type Props = {
  detail: ClientDetail;
  onNewTask: (defaults?: TaskDefaults) => void;
};

export function BillingSection({ detail, onNewTask }: Props) {
  const { pending, paid } = detail.invoices;
  const { summary } = detail;

  const row = (invoice: InvoiceRow) => (
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
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold ${invoice.overdue ? "text-red-400" : invoice.status === "PAID" ? "text-green-400" : "text-white"}`}>
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

  return (
    <div className="space-y-4">
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
          <Link
            href="/dashboard/facturacion"
            className="flex items-center gap-1 text-xs text-white/50 hover:text-acento-lima"
          >
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
        <p className="mb-3 text-sm font-semibold text-white/70">Últimos cobros</p>
        {paid.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Todavía no hay cobros registrados.</p>
        ) : (
          <ul className="space-y-1.5">{paid.map(row)}</ul>
        )}
      </div>
    </div>
  );
}
