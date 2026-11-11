"use client";

import { useState } from "react";
import Link from "next/link";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { Button } from "@heroui/react/button";
import {
  ArrowLeftRight,
  Percent,
  Plus,
  Scale,
  Settings2,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate, lastMonths } from "@/lib/format";
import { MovementModal } from "./movement-modal";
import { AdjustBalanceModal } from "./adjust-balance-modal";
import { YieldModal } from "./yield-modal";
import { TransferModal } from "./transfer-modal";
import {
  PROVIDER_LABELS,
  SOURCE_LABELS,
  selectClass,
  type Account,
  type AccountsResponse,
  type Category,
  type TransactionRow,
  type TransactionsResponse,
  type YieldResponse,
} from "./types";

const MONTH_OPTIONS = lastMonths(12);
const PAGE_SIZE = 20;
const STALE_DAYS = 7;
const DAY_MS = 86_400_000;

function reconciledLabel(reconciledAt: string | null) {
  if (!reconciledAt) return { text: "Sin ajustar", stale: true };
  const days = Math.floor((Date.now() - new Date(reconciledAt).getTime()) / DAY_MS);
  return {
    text: days === 0 ? "Ajustado hoy" : days === 1 ? "Ajustado ayer" : `Ajustado hace ${days} días`,
    stale: days > STALE_DAYS,
  };
}

type Filters = { type: string; accountId: string; categoryId: string; month: string };

export default function FinanzasPage() {
  const [filters, setFilters] = useState<Filters>({ type: "", accountId: "", categoryId: "", month: "" });
  const [modal, setModal] = useState<"movement" | "transfer" | null>(null);
  const [adjusting, setAdjusting] = useState<Account | null>(null);
  const [yieldAccountId, setYieldAccountId] = useState<string | null>(null);
  const [more, setMore] = useState<{ key: string; page: number; rows: TransactionRow[] }>({
    key: "",
    page: 1,
    rows: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const accountsQ = useJson<AccountsResponse>("/api/accounts");
  const categoriesQ = useJson<Category[]>("/api/categories");
  const yieldQ = useJson<YieldResponse>("/api/accounts/yield");

  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  (Object.entries(filters) as [keyof Filters, string][]).forEach(([k, v]) => v && params.set(k, v));
  const txQ = useJson<TransactionsResponse>(`/api/transactions?${params.toString()}`);

  const accounts = accountsQ.data?.accounts ?? [];
  const categories = categoriesQ.data ?? [];
  const extra = more.key === txQ.key ? more : { page: 1, rows: [] };
  const rows = [...(txQ.data?.data ?? []), ...extra.rows];
  const summary = txQ.data?.summary ?? { income: 0, expense: 0, net: 0 };
  const totalPages = txQ.data?.totalPages ?? 1;

  const reloadAll = () => {
    accountsQ.reload();
    txQ.reload();
    yieldQ.reload();
  };
  const yieldAccounts = yieldQ.data?.accounts ?? [];
  const missingToday = yieldAccounts.filter((a) => a.todayAmount === null);

  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  const loadMore = async () => {
    const nextPage = extra.page + 1;
    setLoadingMore(true);
    try {
      const p = new URLSearchParams(params);
      p.set("page", String(nextPage));
      const json: TransactionsResponse = await (await fetch(`/api/transactions?${p}`)).json();
      setMore({ key: txQ.key, page: nextPage, rows: [...extra.rows, ...(json.data ?? [])] });
    } finally {
      setLoadingMore(false);
    }
  };

  const deleteTx = async (tx: TransactionRow) => {
    if (confirmDelete !== tx.id) return setConfirmDelete(tx.id);
    setConfirmDelete(null);
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (res.ok) reloadAll();
  };

  const summaryCards = [
    { label: "Ingresos", value: summary.income, icon: TrendingUp, color: "text-green-400" },
    { label: "Egresos", value: summary.expense, icon: TrendingDown, color: "text-red-400" },
    {
      label: "Resultado neto",
      value: summary.net,
      icon: Wallet,
      color: summary.net >= 0 ? "text-acento-lima" : "text-red-400",
    },
  ];

  const filteredCategories = categories.filter(
    (c) => !filters.type || filters.type === "TRANSFER" || c.type === filters.type
  );

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <div className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Finanzas</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/dashboard/finanzas/configuracion"
            className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <Settings2 size={15} />
            <span className="hidden sm:inline">Configuración</span>
          </Link>
          <button
            onClick={() => setModal("transfer")}
            disabled={accounts.length < 2}
            className="flex items-center gap-1.5 text-sm text-white/80 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <ArrowLeftRight size={15} />
            Transferir
          </button>
          <Button
            onPress={() => setModal("movement")}
            isDisabled={accounts.length === 0}
            className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg"
          >
            <Plus size={15} />
            <span className="ml-1">Movimiento</span>
          </Button>
        </div>
      </div>

      {/* Saldos */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold text-white/70">Saldos</h2>
          {accountsQ.data?.usdRate && (
            <span className="text-xs text-white/40">
              Dólar: {formatAmount(accountsQ.data.usdRate)}
            </span>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          <div className="glass rounded-xl p-4 min-w-[180px] snap-start border-acento-lima/30">
            <p className="text-xs text-white/40">Liquidez total (ARS)</p>
            <p className="text-xl font-bold text-acento-lima">
              {accountsQ.data ? formatAmount(accountsQ.data.totalArs) : "—"}
            </p>
          </div>
          {accounts.map((a) => {
            const rec = reconciledLabel(a.reconciledAt);
            return (
              <div
                key={a.id}
                className={`glass rounded-xl min-w-[200px] snap-start transition-colors flex flex-col ${
                  filters.accountId === a.id ? "border-acento-lima/50" : "hover:border-white/20"
                }`}
              >
                <button
                  onClick={() => setFilter("accountId", filters.accountId === a.id ? "" : a.id)}
                  className="text-left px-4 pt-4 pb-2 flex-1"
                >
                  <p className="text-xs text-white/40">
                    {a.name} · {PROVIDER_LABELS[a.provider]}
                  </p>
                  <p className={`text-lg font-semibold ${a.balance < 0 ? "text-red-400" : "text-white"}`}>
                    {formatAmount(a.balance, a.currency)}
                  </p>
                  {a.currency !== "ARS" && a.balanceArs !== null && (
                    <p className="text-xs text-white/40">≈ {formatAmount(a.balanceArs)}</p>
                  )}
                  <p className={`text-[11px] mt-1 ${rec.stale ? "text-amber-400" : "text-white/40"}`}>{rec.text}</p>
                </button>
                <div className="flex border-t border-white/10 text-xs">
                  <button
                    onClick={() => setAdjusting(a)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-bl-xl"
                  >
                    <Scale size={13} />
                    Ajustar saldo
                  </button>
                  {a.earnsYield && (
                    <button
                      onClick={() => setYieldAccountId(a.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-acento-lima/80 hover:text-acento-lima hover:bg-white/5 border-l border-white/10 rounded-br-xl"
                    >
                      <Percent size={13} />
                      Rendimiento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {accountsQ.data && accounts.length === 0 && (
            <Link
              href="/dashboard/finanzas/configuracion"
              className="glass rounded-xl p-4 min-w-[180px] text-sm text-acento-lima hover:underline flex items-center"
            >
              Creá tu primera cuenta →
            </Link>
          )}
        </div>
      </section>

      {yieldAccounts.length > 0 && (
        <div className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-acento-lima" />
            <div>
              <p className="text-xs text-white/40">Rendimientos del mes</p>
              <p className="text-lg font-semibold text-acento-lima">{formatAmount(yieldQ.data?.totalArs ?? 0)}</p>
            </div>
          </div>
          {missingToday.length > 0 ? (
            <button
              onClick={() => setYieldAccountId(missingToday[0].id)}
              className="flex items-center justify-center gap-1.5 text-sm text-amber-300 border border-amber-400/30 bg-amber-400/10 rounded-lg px-3 py-2 hover:bg-amber-400/20 transition-colors"
            >
              <Percent size={14} />
              Cargar el rendimiento de hoy{missingToday.length > 1 ? ` (${missingToday.length} cuentas)` : ""}
            </button>
          ) : (
            <p className="text-xs text-white/50">
              Hoy:{" "}
              {yieldAccounts
                .map((a) => `${a.name} ${formatAmount(a.todayAmount ?? 0, a.currency)}`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
            <Icon size={20} className={color} />
            <div>
              <p className="text-xs text-white/40">{label}</p>
              <p className={`text-lg font-semibold ${color}`}>{formatAmount(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FilterSelect label="Tipo" value={filters.type} onChange={(v) => setFilters((f) => ({ ...f, type: v, categoryId: "" }))}>
          <option value="" className="bg-black">Todos</option>
          <option value="INCOME" className="bg-black">Ingresos</option>
          <option value="EXPENSE" className="bg-black">Egresos</option>
          <option value="TRANSFER" className="bg-black">Transferencias</option>
          <option value="ADJUSTMENT" className="bg-black">Ajustes</option>
        </FilterSelect>
        <FilterSelect label="Cuenta" value={filters.accountId} onChange={(v) => setFilter("accountId", v)}>
          <option value="" className="bg-black">Todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} className="bg-black">{a.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Categoría" value={filters.categoryId} onChange={(v) => setFilter("categoryId", v)}>
          <option value="" className="bg-black">Todas</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id} className="bg-black">
              {c.name}{!filters.type ? ` (${c.type === "INCOME" ? "ingreso" : "egreso"})` : ""}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Mes" value={filters.month} onChange={(v) => setFilter("month", v)}>
          <option value="" className="bg-black">Todos</option>
          {MONTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-black">{o.label}</option>
          ))}
        </FilterSelect>
      </div>

      {/* Lista */}
      {txQ.loading && !txQ.data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Wallet size={32} className="text-white/20" />
          <p className="text-white/40 text-sm">No hay movimientos con esos filtros</p>
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity ${txQ.loading ? "opacity-50" : ""}`}>
          {rows.map((t) => (
            <TransactionItem
              key={t.id}
              tx={t}
              confirming={confirmDelete === t.id}
              onDelete={() => deleteTx(t)}
            />
          ))}
          {extra.page < totalPages && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm text-white/50 hover:text-white border border-white/10 rounded-lg px-5 py-2 hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </div>
      )}

      <MovementModal
        isOpen={modal === "movement"}
        onOpenChange={(open) => setModal(open ? "movement" : null)}
        accounts={accounts}
        categories={categories}
        onSaved={reloadAll}
      />
      <TransferModal
        isOpen={modal === "transfer"}
        onOpenChange={(open) => setModal(open ? "transfer" : null)}
        accounts={accounts}
        onSaved={reloadAll}
      />
      <AdjustBalanceModal
        account={adjusting}
        categories={categories}
        onClose={() => setAdjusting(null)}
        onSaved={reloadAll}
      />
      <YieldModal
        accountId={yieldAccountId}
        accounts={accounts.filter((a) => a.earnsYield)}
        data={yieldQ.data ?? undefined}
        onClose={() => setYieldAccountId(null)}
        onSaved={reloadAll}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="text-xs text-white/50 mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
    </div>
  );
}

const DELETABLE_SOURCES: TransactionRow["source"][] = ["MANUAL", "TRANSFER", "ADJUSTMENT", "YIELD"];

function TransactionItem({
  tx,
  confirming,
  onDelete,
}: {
  tx: TransactionRow;
  confirming: boolean;
  onDelete: () => void;
}) {
  const isTransfer = tx.type === "TRANSFER_IN" || tx.type === "TRANSFER_OUT";
  const isAdjustment = tx.type === "ADJUSTMENT_IN" || tx.type === "ADJUSTMENT_OUT";
  const positive = tx.type === "INCOME" || tx.type === "TRANSFER_IN" || tx.type === "ADJUSTMENT_IN";
  const color = isTransfer
    ? "text-sky-400"
    : isAdjustment
      ? "text-white/60"
      : positive
        ? "text-green-400"
        : "text-red-400";
  const Icon = isTransfer ? ArrowLeftRight : isAdjustment ? Scale : positive ? TrendingUp : TrendingDown;
  const deletable = DELETABLE_SOURCES.includes(tx.source);
  const title = isTransfer
    ? tx.type === "TRANSFER_IN"
      ? "Transferencia recibida"
      : "Transferencia enviada"
    : isAdjustment
      ? "Ajuste de saldo"
      : tx.category?.name ?? "Sin categoría";

  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={16} className={`${color} flex-shrink-0`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            <span className="text-[10px] text-white/40 border border-white/10 rounded-full px-1.5 py-0.5">
              {tx.account.name}
            </span>
            {tx.source !== "MANUAL" && tx.source !== "TRANSFER" && (
              <span className="text-[10px] text-acento-lima/70 border border-acento-lima/20 rounded-full px-1.5 py-0.5">
                {SOURCE_LABELS[tx.source]}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 truncate">
            {formatDate(tx.date)}
            {tx.description ? ` · ${tx.description}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className={`text-sm font-semibold ${color}`}>
            {positive ? "+" : "-"}
            {formatAmount(tx.amount, tx.currency)}
          </p>
          {tx.currency !== "ARS" && (
            <p className="text-[10px] text-white/40">≈ {formatAmount(tx.amountArs)}</p>
          )}
        </div>
        {deletable && (
          <button
            onClick={onDelete}
            title={isTransfer ? "Eliminar transferencia (ambos movimientos)" : "Eliminar movimiento"}
            className={`p-1.5 rounded-lg transition-colors ${
              confirming ? "text-red-400 bg-red-500/10" : "text-white/20 hover:text-red-400"
            }`}
          >
            {confirming ? <span className="text-[10px] font-medium px-0.5">¿Eliminar?</span> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
