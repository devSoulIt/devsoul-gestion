"use client";

import { useState } from "react";
import { Chip } from "@heroui/react/chip";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react";
import { Bell, BellRing, CalendarClock, CheckCircle, FileText, Plus, Repeat, Undo2, XCircle, Zap } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import type { AccountsResponse } from "../finanzas/types";
import { PaymentModal, type PaymentTarget } from "@/components/finance/payment-modal";
import { ReverseModal } from "@/components/finance/reverse-modal";
import { AutomationModal } from "./automation-modal";
import { CancelInvoiceModal, type InvoiceSummary } from "./cancel-invoice-modal";
import { DueDateModal } from "./due-date-modal";
import { TaskModal } from "@/components/tasks/task-modal";
import type { TaskDefaults } from "@/components/tasks/types";

type InvoiceRow = {
  id: string;
  amount: string;
  paidAmount: string;
  dueDate: string;
  status: "PAID" | "PENDING" | "CANCELLED";
  delayDays: number | null;
  cancelReason: string | null;
  cancelledBy: { name: string } | null;
  currency: "ARS" | "USD";
  period: string;
  paymentDate: string | null;
  recurringKey: string | null;
  reminders: { kind: string; sentAt: string }[];
  allocations: {
    amount: string;
    payment: { id: string; date: string; amount: string; currency: "ARS" | "USD"; account: { name: string } };
  }[];
  contract: {
    id: string;
    client: { id: string; companyName: string };
    software: { id: string; name: string };
    splitShares: { userId: string | null; percent: string }[];
  };
};

const STATUS_CHIP: Record<InvoiceRow["status"], { label: string; color: "success" | "warning" | "default" }> = {
  PAID: { label: "Cobrada", color: "success" },
  PENDING: { label: "Pendiente", color: "warning" },
  CANCELLED: { label: "Cancelada", color: "default" },
};

function delayLabel(inv: InvoiceRow) {
  const days = inv.delayDays ?? 0;
  if (inv.status === "CANCELLED" || days <= 0) return null;
  const unit = days === 1 ? "día" : "días";
  return inv.status === "PAID" ? `Cobrada con ${days} ${unit} de atraso` : `${days} ${unit} de atraso`;
}

type ApiResponse = {
  data: InvoiceRow[];
  total: number;
  page: number;
  totalPages: number;
};

type ContractOption = {
  id: string;
  type: string;
  currency: "ARS" | "USD";
  client: { companyName: string };
  software: { name: string };
};

type FormState = {
  contractId: string;
  amount: string;
  period: string;
  dueDate: string;
  currency: "ARS" | "USD";
};

function formatAmount(amount: string, currency: "ARS" | "USD") {
  return new Intl.NumberFormat(currency === "ARS" ? "es-AR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(Number(amount));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getLast12Months() {
  const result: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    result.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return result;
}

const PERIOD_OPTIONS = getLast12Months();

const EMPTY_FORM: FormState = {
  contractId: "",
  amount: "",
  period: PERIOD_OPTIONS[0].value,
  dueDate: "",
  currency: "ARS",
};

export default function FacturacionPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [paying, setPaying] = useState<PaymentTarget | null>(null);
  const [reversing, setReversing] = useState<{ url: string; title: string; detail: string } | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [cancelling, setCancelling] = useState<InvoiceSummary | null>(null);
  const [rescheduling, setRescheduling] = useState<InvoiceSummary | null>(null);
  const [more, setMore] = useState<{ key: string; page: number; rows: InvoiceRow[] }>({
    key: "",
    page: 1,
    rows: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const [collectionTask, setCollectionTask] = useState<TaskDefaults | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (periodFilter) params.set("period", periodFilter);
    params.set("page", String(p));
    params.set("limit", "20");
    return `/api/invoices?${params.toString()}`;
  };

  const invoicesQ = useJson<ApiResponse>(buildUrl(1));
  const contractsQ = useJson<ContractOption[]>("/api/contracts?active=true");
  const accountsQ = useJson<AccountsResponse>("/api/accounts");

  const extra = more.key === invoicesQ.key ? more : { page: 1, rows: [] };
  const invoices = [...(invoicesQ.data?.data ?? []), ...extra.rows];
  const loading = invoicesQ.loading && !invoicesQ.data;
  const total = invoicesQ.data?.total ?? 0;
  const page = extra.page;
  const totalPages = invoicesQ.data?.totalPages ?? 1;
  const contracts = Array.isArray(contractsQ.data) ? contractsQ.data : [];
  const accounts = accountsQ.data?.accounts ?? [];

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextPage));
      const json: ApiResponse = await res.json();
      setMore({ key: invoicesQ.key, page: nextPage, rows: [...extra.rows, ...(json.data ?? [])] });
    } finally {
      setLoadingMore(false);
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectContract = (id: string) => {
    const contract = contracts.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      contractId: id,
      currency: contract?.currency ?? f.currency,
    }));
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contractId || !form.amount || Number(form.amount) <= 0 || !form.dueDate) {
      setFormError("Completá todos los campos obligatorios con valores válidos.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: form.contractId,
          amount: Number(form.amount),
          period: form.period,
          dueDate: form.dueDate,
          currency: form.currency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Error al guardar.");
        return;
      }
      setModalOpen(false);
      invoicesQ.reload();
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors appearance-none";

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Facturación</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40 hidden sm:inline">
            {total} factura{total !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setAutomationOpen(true)}
            title="Automatizaciones"
            className="flex items-center gap-1.5 text-sm text-white/80 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <Zap size={15} className="text-acento-lima" />
            <span className="hidden sm:inline">Automatizaciones</span>
          </button>
          <Button
            onPress={openCreate}
            className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg flex-shrink-0"
          >
            <Plus size={15} />
            <span className="ml-1">Nueva Factura</span>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-white/50 mb-1 block">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="" className="bg-black">Todos</option>
            <option value="PENDING" className="bg-black">Pendientes</option>
            <option value="OVERDUE" className="bg-black">Con atraso</option>
            <option value="PAID" className="bg-black">Cobradas</option>
            <option value="CANCELLED" className="bg-black">Canceladas</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-white/50 mb-1 block">Período</label>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="" className="bg-black">Todos los períodos</option>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-black">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileText size={32} className="text-white/20" />
          <p className="text-white/40 text-sm">No hay facturas con esos filtros</p>
        </div>
      ) : (
        <>
          {/* Header desktop */}
          <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 text-xs text-white/40 uppercase tracking-wide">
            <span>Cliente / Software</span>
            <span>Período</span>
            <span>Monto</span>
            <span>Vencimiento</span>
            <span>Estado</span>
            <span />
          </div>

          <div className="space-y-2">
            {invoices.map((inv) => {
              const overdue = inv.status === "PENDING" && (inv.delayDays ?? 0) > 0;
              const delay = delayLabel(inv);
              const summary: InvoiceSummary = {
                id: inv.id,
                amount: inv.amount,
                currency: inv.currency,
                period: inv.period,
                clientName: inv.contract.client.companyName,
                dueDate: inv.dueDate,
              };
              return (
                <div
                  key={inv.id}
                  className={`glass rounded-xl px-4 py-3 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center ${inv.status === "CANCELLED" ? "opacity-60" : ""}`}
                >
                  {/* Cliente / Software */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {inv.contract.client.companyName}
                    </p>
                    <p className="text-xs text-white/50 truncate flex items-center gap-1.5">
                      {inv.contract.software.name}
                      {inv.recurringKey && (
                        <Repeat size={11} className="text-acento-lima/70 flex-shrink-0" aria-label="Generada automáticamente" />
                      )}
                      {inv.reminders.length > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-white/40"
                          title={`Último recordatorio: ${formatDate(inv.reminders[0].sentAt)}`}
                        >
                          <Bell size={10} />
                          {inv.reminders.length}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Período */}
                  <p className="text-xs text-white/50 md:text-sm">{inv.period}</p>

                  {/* Monto */}
                  <div>
                    <p className="text-sm font-semibold text-white">{formatAmount(inv.amount, inv.currency)}</p>
                    {inv.status === "PENDING" && Number(inv.paidAmount) > 0 && (
                      <p className="text-xs text-amber-300/90">
                        Cobrado {formatAmount(inv.paidAmount, inv.currency)} · falta{" "}
                        {formatAmount(String(Number(inv.amount) - Number(inv.paidAmount)), inv.currency)}
                      </p>
                    )}
                    {inv.allocations.map((a) => (
                      <button
                        key={a.payment.id}
                        onClick={() =>
                          setReversing({
                            url: `/api/payments/${a.payment.id}/reverse`,
                            title: "Revertir cobro",
                            detail: `Cobro de ${formatAmount(a.payment.amount, a.payment.currency)} del ${formatDate(a.payment.date)} en ${a.payment.account.name}. Si se aplicó a otras facturas, también se libera.`,
                          })
                        }
                        title="Revertir este cobro"
                        className="flex items-center gap-1 text-[11px] text-white/40 hover:text-red-400 transition-colors"
                      >
                        <Undo2 size={11} />
                        {formatDate(a.payment.date)} · {formatAmount(a.amount, inv.currency)}
                      </button>
                    ))}
                  </div>

                  {/* Vencimiento */}
                  <div className="text-xs md:text-sm">
                    <p className={overdue ? "text-red-400" : "text-white/50"}>{formatDate(inv.dueDate)}</p>
                    {delay && (
                      <p className={`text-xs ${inv.status === "PAID" ? "text-amber-300/80" : "text-red-400/80"}`}>{delay}</p>
                    )}
                    {inv.status === "CANCELLED" && inv.cancelReason && (
                      <p className="text-xs text-white/40 line-clamp-2" title={inv.cancelReason}>
                        Motivo: {inv.cancelReason}
                        {inv.cancelledBy ? ` · ${inv.cancelledBy.name}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Estado */}
                  <div>
                    <Chip color={STATUS_CHIP[inv.status].color} size="sm" variant="soft">
                      {inv.status === "PENDING" && Number(inv.paidAmount) > 0 ? "Parcial" : STATUS_CHIP[inv.status].label}
                    </Chip>
                  </div>

                  {/* Acción */}
                  <div className="flex justify-end md:justify-center gap-3">
                    {overdue && (
                      <button
                        onClick={() =>
                          setCollectionTask({
                            type: "COLLECTION",
                            clientId: inv.contract.client.id,
                            invoiceId: inv.id,
                            title: `Cobrar ${inv.contract.software.name} ${inv.period}`,
                          })
                        }
                        title="Crear recordatorio de cobro"
                        className="text-white/40 hover:text-acento-lima transition-colors"
                      >
                        <BellRing size={17} />
                      </button>
                    )}
                    {inv.status === "PENDING" && (
                      <button
                        onClick={() => setRescheduling(summary)}
                        title="Cambiar fecha de pago"
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <CalendarClock size={17} />
                      </button>
                    )}
                    {inv.status === "PENDING" && (
                      <button
                        onClick={() => setCancelling(summary)}
                        title="Cancelar factura"
                        className="text-white/40 hover:text-red-400 transition-colors"
                      >
                        <XCircle size={17} />
                      </button>
                    )}
                    {inv.status === "PENDING" && (
                      <button
                        onClick={() =>
                          setPaying({
                            contractId: inv.contract.id,
                            invoiceId: inv.id,
                            title: inv.contract.client.companyName,
                            subtitle: `${inv.contract.software.name} · período ${inv.period}`,
                            currency: inv.currency,
                            pending: Math.round((Number(inv.amount) - Number(inv.paidAmount)) * 100) / 100,
                            shares: inv.contract.splitShares.map((s) => ({
                              userId: s.userId,
                              percent: Number(s.percent),
                            })),
                          })
                        }
                        title="Registrar cobro"
                        className="text-acento-lima hover:text-acento-lima/70 transition-colors disabled:opacity-40"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cargar más */}
          {page < totalPages && (
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
        </>
      )}

      {/* Modal de registro */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="px-6 pt-6 pb-0">
                <Modal.Heading className="text-lg font-semibold text-white">
                  Nueva Factura
                </Modal.Heading>
              </Modal.Header>
              <form onSubmit={handleSave}>
                <Modal.Body className="px-6 py-4 space-y-3">
                  {formError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {formError}
                    </p>
                  )}

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Contrato *</label>
                    <select
                      value={form.contractId}
                      onChange={(e) => selectContract(e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="" className="bg-black">Seleccionar contrato...</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id} className="bg-black">
                          {c.client.companyName} · {c.software.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-white/50 mb-1 block">Monto *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40 pointer-events-none">
                          $
                        </span>
                        <Input
                          type="number"
                          value={form.amount}
                          onChange={(e) => setField("amount", e.target.value)}
                          placeholder="0"
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-white/50 mb-1 block">Moneda</label>
                      <select
                        value={form.currency}
                        onChange={(e) => setField("currency", e.target.value as "ARS" | "USD")}
                        className={`${selectClass} w-full`}
                      >
                        <option value="ARS" className="bg-black">ARS</option>
                        <option value="USD" className="bg-black">USD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Período *</label>
                    <select
                      value={form.period}
                      onChange={(e) => setField("period", e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      {PERIOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-black">
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Vencimiento *</label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setField("dueDate", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </Modal.Body>
                <Modal.Footer className="px-6 pb-6 pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <Button
                    type="submit"
                    isDisabled={saving}
                    className="bg-acento-lima text-black text-sm font-medium px-5 rounded-lg"
                  >
                    {saving ? "Guardando..." : "Registrar"}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AutomationModal
        isOpen={automationOpen}
        onOpenChange={setAutomationOpen}
        onChanged={invoicesQ.reload}
      />

      <TaskModal
        isOpen={collectionTask !== null}
        onOpenChange={(open) => !open && setCollectionTask(null)}
        defaults={collectionTask ?? undefined}
        onSaved={() => setCollectionTask(null)}
      />

      <CancelInvoiceModal invoice={cancelling} onClose={() => setCancelling(null)} onDone={invoicesQ.reload} />
      <DueDateModal invoice={rescheduling} onClose={() => setRescheduling(null)} onDone={invoicesQ.reload} />

      <PaymentModal
        open={paying !== null}
        targets={paying ? [paying] : []}
        accounts={accounts}
        onClose={() => setPaying(null)}
        onSaved={invoicesQ.reload}
      />
      <ReverseModal target={reversing} onClose={() => setReversing(null)} onDone={invoicesQ.reload} />
    </div>
  );
}
