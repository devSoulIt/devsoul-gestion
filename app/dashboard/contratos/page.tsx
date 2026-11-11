"use client";

import { useState, useEffect, useMemo } from "react";
import { Chip } from "@heroui/react/chip";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react";
import { Plus, FileSignature, Power, SlidersHorizontal } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import {
  SplitEditor,
  normalizeSplit,
  splitIsValid,
  type DefaultSplitResponse,
  type SplitShare,
} from "@/components/finance/split-editor";
import { ContractBillingModal, type BillableContract } from "./contract-billing-modal";

type ContractRow = {
  id: string;
  type: "SAAS_SUBSCRIPTION" | "MAINTENANCE" | "CUSTOM_DEVELOPMENT";
  totalAmount: string;
  currency: "ARS" | "USD";
  active: boolean;
  startDate: string;
  endDate: string | null;
  client: { id: string; companyName: string };
  software: { id: string; name: string };
  project: { id: string; name: string } | null;
  paymentDay: number | null;
  splitShares: { userId: string | null; percent: string }[];
  _count: { invoices: number };
};

type ClientOption = { id: string; companyName: string; stage: "PROSPECT" | "CLIENT"; email: string | null };
type SoftwareOption = { id: string; name: string; basePrice: string };

type FormState = {
  clientId: string;
  softwareId: string;
  projectId: string;
  type: ContractRow["type"];
  totalAmount: string;
  currency: "ARS" | "USD";
  installmentsCount: string;
  startDate: string;
  paymentDay: string;
  customSplit: boolean;
};

const TYPE_LABEL: Record<ContractRow["type"], string> = {
  SAAS_SUBSCRIPTION: "Suscripción SaaS",
  MAINTENANCE: "Mantenimiento",
  CUSTOM_DEVELOPMENT: "Desarrollo a Medida",
};

const EMPTY_FORM: FormState = {
  clientId: "",
  softwareId: "",
  projectId: "",
  type: "SAAS_SUBSCRIPTION",
  totalAmount: "",
  currency: "ARS",
  installmentsCount: "1",
  startDate: new Date().toISOString().slice(0, 10),
  paymentDay: "",
  customSplit: false,
};

function formatAmount(amount: string | number, currency: "ARS" | "USD") {
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

const selectClass =
  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors appearance-none";

export default function ContratosPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [softwares, setSoftwares] = useState<SoftwareOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editedSplit, setEditedSplit] = useState<SplitShare[] | null>(null);
  const [billing, setBilling] = useState<BillableContract | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      setContracts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/softwares").then((r) => r.json()),
    ]).then(([cls, sws]) => {
      setClients(Array.isArray(cls) ? cls : []);
      setSoftwares(Array.isArray(sws) ? sws : []);
    });
  }, []);

  const splitQ = useJson<DefaultSplitResponse>(modalOpen ? "/api/splits/default" : null);
  const splitUsers = splitQ.data?.users ?? [];
  const formSplit = editedSplit ?? normalizeSplit(splitQ.data?.shares, splitUsers);

  const projects = useJson<{ id: string; name: string }[]>(
    modalOpen && form.clientId ? `/api/projects?clientId=${encodeURIComponent(form.clientId)}` : null
  );

  const visible = useMemo(
    () => (showInactive ? contracts : contracts.filter((c) => c.active)),
    [contracts, showInactive]
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectSoftware = (id: string) => {
    const software = softwares.find((s) => s.id === id);
    setForm((f) => ({
      ...f,
      softwareId: id,
      totalAmount: f.totalAmount || (software ? String(Number(software.basePrice)) : ""),
    }));
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().slice(0, 10) });
    setEditedSplit(null);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.clientId ||
      !form.softwareId ||
      !form.totalAmount ||
      Number(form.totalAmount) <= 0 ||
      !form.startDate
    ) {
      setFormError("Completá todos los campos obligatorios con valores válidos.");
      return;
    }
    if (form.type === "CUSTOM_DEVELOPMENT" && Number(form.installmentsCount) < 1) {
      setFormError("Indicá la cantidad de cuotas.");
      return;
    }
    const day = form.paymentDay ? Number(form.paymentDay) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setFormError("El día de pago tiene que estar entre 1 y 31.");
      return;
    }
    if (form.customSplit && !splitIsValid(formSplit)) {
      setFormError("El reparto tiene que sumar 100%.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          softwareId: form.softwareId,
          projectId: form.projectId || null,
          type: form.type,
          totalAmount: Number(form.totalAmount),
          currency: form.currency,
          installmentsCount: Number(form.installmentsCount),
          startDate: form.startDate,
          paymentDay: day,
          shares: form.customSplit ? formSplit : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Error al guardar.");
        return;
      }
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (contract: ContractRow) => {
    setTogglingId(contract.id);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !contract.active }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contract.id ? { ...c, active: updated.active, endDate: updated.endDate } : c
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Contratos</h1>
        <Button
          onPress={openCreate}
          className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg flex-shrink-0"
        >
          <Plus size={15} />
          <span className="ml-1">Nuevo Contrato</span>
        </Button>
      </div>

      {/* Filtro inactivos */}
      <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="accent-[#bdf61d]"
        />
        Mostrar inactivos
      </label>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileSignature size={32} className="text-white/20" />
          <p className="text-white/40 text-sm">
            {showInactive ? "No hay contratos registrados" : "No hay contratos activos"}
          </p>
          <button onClick={openCreate} className="text-acento-lima text-sm hover:underline">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <div
              key={c.id}
              className="glass rounded-xl px-4 py-3 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {c.client.companyName}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {c.software.name}
                  {c.project && <span className="text-acento-lima/70"> · {c.project.name}</span>}
                </p>
              </div>

              <p className="text-xs text-white/50 md:text-sm">{TYPE_LABEL[c.type]}</p>

              <div>
                <p className="text-sm font-semibold text-white">
                  {formatAmount(c.totalAmount, c.currency)}
                </p>
                <p className="text-xs text-white/40">
                  Desde {formatDate(c.startDate)}
                  {c.endDate ? ` · hasta ${formatDate(c.endDate)}` : ""}
                </p>
                <p className="text-xs text-white/40">
                  {c.paymentDay ? `Paga el día ${c.paymentDay}` : "Paga el día 10"}
                  {c.splitShares.length > 0 && <span className="text-acento-lima/70"> · reparto propio</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Chip color={c.active ? "success" : "default"} size="sm" variant="soft">
                  {c.active ? "Activo" : "Inactivo"}
                </Chip>
                {c._count.invoices > 0 && (
                  <span className="text-xs text-acento-lima/80">
                    {c._count.invoices} pendiente{c._count.invoices !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex justify-end md:justify-center gap-3">
                <button
                  onClick={() =>
                    setBilling({
                      id: c.id,
                      label: `${c.client.companyName} · ${c.software.name}`,
                      paymentDay: c.paymentDay,
                      splitShares: c.splitShares,
                    })
                  }
                  title="Día de pago y reparto"
                  className="text-white/40 hover:text-acento-lima transition-colors"
                >
                  <SlidersHorizontal size={18} />
                </button>
                <button
                  onClick={() => toggleActive(c)}
                  disabled={togglingId === c.id}
                  title={c.active ? "Desactivar contrato" : "Reactivar contrato"}
                  className={`transition-colors disabled:opacity-40 ${
                    c.active
                      ? "text-white/40 hover:text-red-400"
                      : "text-white/40 hover:text-acento-lima"
                  }`}
                >
                  <Power size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de creación */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="px-6 pt-6 pb-0">
                <Modal.Heading className="text-lg font-semibold text-white">
                  Nuevo Contrato
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
                    <label className="text-xs text-white/50 mb-1 block">Cliente *</label>
                    <select
                      value={form.clientId}
                      onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, projectId: "" }))}
                      className={`${selectClass} w-full`}
                    >
                      <option value="" className="bg-black">Seleccionar cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id} className="bg-black">
                          {c.companyName}
                          {c.stage === "PROSPECT" ? " (posible cliente)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {clients.find((c) => c.id === form.clientId)?.stage === "PROSPECT" && (
                    <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      Es un posible cliente: al crear el contrato pasa a la etapa Cliente.
                    </p>
                  )}

                  {(projects.data?.length ?? 0) > 0 && (
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">Proyecto</label>
                      <select
                        value={form.projectId}
                        onChange={(e) => setField("projectId", e.target.value)}
                        className={`${selectClass} w-full`}
                      >
                        <option value="" className="bg-black">Sin proyecto</option>
                        {(projects.data ?? []).map((p) => (
                          <option key={p.id} value={p.id} className="bg-black">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Software *</label>
                    <select
                      value={form.softwareId}
                      onChange={(e) => selectSoftware(e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="" className="bg-black">Seleccionar software...</option>
                      {softwares.map((s) => (
                        <option key={s.id} value={s.id} className="bg-black">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Tipo de contrato *</label>
                    <select
                      value={form.type}
                      onChange={(e) => setField("type", e.target.value as FormState["type"])}
                      className={`${selectClass} w-full`}
                    >
                      <option value="SAAS_SUBSCRIPTION" className="bg-black">Suscripción SaaS</option>
                      <option value="MAINTENANCE" className="bg-black">Mantenimiento</option>
                      <option value="CUSTOM_DEVELOPMENT" className="bg-black">Desarrollo a Medida</option>
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-white/50 mb-1 block">Monto total *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40 pointer-events-none">
                          $
                        </span>
                        <Input
                          type="number"
                          value={form.totalAmount}
                          onChange={(e) => setField("totalAmount", e.target.value)}
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

                  {form.type === "CUSTOM_DEVELOPMENT" && (
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">Cantidad de cuotas *</label>
                      <Input
                        type="number"
                        value={form.installmentsCount}
                        onChange={(e) => setField("installmentsCount", e.target.value)}
                        placeholder="1"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors"
                      />
                      {Number(form.installmentsCount) > 0 && Number(form.totalAmount) > 0 && (
                        <p className="text-xs text-white/40 mt-1">
                          {form.installmentsCount} cuota{Number(form.installmentsCount) !== 1 ? "s" : ""} de{" "}
                          {formatAmount(
                            Number(form.totalAmount) / Number(form.installmentsCount),
                            form.currency
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Fecha de inicio *</label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setField("startDate", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Día de pago del mes</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      value={form.paymentDay}
                      onChange={(e) => setField("paymentDay", e.target.value)}
                      placeholder="Por defecto: día 10"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.customSplit}
                      onChange={(e) => setField("customSplit", e.target.checked)}
                      className="accent-[#bdf61d]"
                    />
                    Reparto propio (si no, usa el reparto por defecto)
                  </label>
                  {form.customSplit && splitUsers.length > 0 && (
                    <SplitEditor shares={formSplit} users={splitUsers} onChange={setEditedSplit} />
                  )}
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
                    {saving ? "Guardando..." : "Crear Contrato"}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ContractBillingModal contract={billing} onClose={() => setBilling(null)} onSaved={load} />
    </div>
  );
}
