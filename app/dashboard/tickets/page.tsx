"use client";

import { useState, useEffect } from "react";
import { Modal } from "@heroui/react";
import { Chip } from "@heroui/react/chip";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Plus, Wrench } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  client: { id: string; companyName: string };
  software: { id: string; name: string };
  project?: { id: string; name: string } | null;
  createdAt: string;
};

type FormState = {
  clientId: string;
  softwareId: string;
  projectId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

type ClientOption = { id: string; companyName: string };
type SoftwareOption = { id: string; name: string };

const EMPTY_FORM: FormState = {
  clientId: "",
  softwareId: "",
  projectId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
};

const PRIORITY_CHIP: Record<
  string,
  { color: "danger" | "warning" | "default"; label: string }
> = {
  HIGH: { color: "danger", label: "Alta" },
  MEDIUM: { color: "warning", label: "Media" },
  LOW: { color: "default", label: "Baja" },
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En Progreso",
  RESOLVED: "Resuelto",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-white/60",
  IN_PROGRESS: "text-acento-lima",
  RESOLVED: "text-green-400",
};

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/50 mb-1 block">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors"
      />
    </div>
  );
}

const selectClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-acento-lima/50 transition-colors appearance-none";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [softwares, setSoftwares] = useState<SoftwareOption[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      setTickets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/softwares").then((r) => r.json()),
    ]).then(([cls, sws]) => {
      setClients(cls);
      setSoftwares(sws);
    });
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const projects = useJson<{ id: string; name: string }[]>(
    modalOpen && form.clientId ? `/api/projects?clientId=${encodeURIComponent(form.clientId)}` : null
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.softwareId || !form.title || !form.description) {
      setFormError("Completá todos los campos obligatorios.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId: form.projectId || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Error al guardar.");
        return;
      }
      const newTicket: TicketRow = await res.json();
      setTickets((prev) => [newTicket, ...prev]);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: TicketRow["status"]) => {
    setUpdatingId(id);
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Mantenimiento y Tickets</h1>
        <Button
          onPress={openCreate}
          className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg flex-shrink-0"
        >
          <Plus size={15} />
          <span className="ml-1">Levantar Ticket</span>
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Wrench size={32} className="text-white/20" />
          <p className="text-white/40 text-sm">No hay tickets activos</p>
          <button onClick={openCreate} className="text-acento-lima text-sm hover:underline">
            Levantar el primero
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const chip = PRIORITY_CHIP[t.priority];
            return (
              <div key={t.id} className="glass rounded-xl px-4 py-3 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <Chip color={chip.color} size="sm" variant="soft">
                    {chip.label}
                  </Chip>
                  <span className="text-xs text-white/30 font-mono">
                    #{t.id.slice(-6).toUpperCase()}
                  </span>
                </div>

                {/* Cuerpo */}
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {t.client.companyName} · {t.software.name}
                    {t.project ? ` · ${t.project.name}` : ""}
                  </p>
                </div>

                {/* Footer — select de status */}
                <select
                  value={t.status}
                  disabled={updatingId === t.id}
                  onChange={(e) => updateStatus(t.id, e.target.value as TicketRow["status"])}
                  className={`bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs outline-none appearance-none transition-colors disabled:opacity-40 ${STATUS_COLOR[t.status]}`}
                >
                  {Object.entries(STATUS_LABEL).map(([val, label]) => (
                    <option key={val} value={val} className="bg-black text-white">
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
                  Levantar Ticket
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
                    className={selectClass}
                  >
                    <option value="" className="bg-black">Seleccionar cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id} className="bg-black">
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                {(projects.data?.length ?? 0) > 0 && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Proyecto</label>
                    <select
                      value={form.projectId}
                      onChange={(e) => setField("projectId", e.target.value)}
                      className={selectClass}
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
                    onChange={(e) => setField("softwareId", e.target.value)}
                    className={selectClass}
                  >
                    <option value="" className="bg-black">Seleccionar software...</option>
                    {softwares.map((s) => (
                      <option key={s.id} value={s.id} className="bg-black">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label="Título *"
                  value={form.title}
                  onChange={(v) => setField("title", v)}
                />

                <div>
                  <label className="text-xs text-white/50 mb-1 block">Descripción *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    placeholder="Detallá el problema o mantenimiento..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1 block">Prioridad</label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setField("priority", e.target.value as FormState["priority"])
                    }
                    className={selectClass}
                  >
                    <option value="LOW" className="bg-black">Baja</option>
                    <option value="MEDIUM" className="bg-black">Media</option>
                    <option value="HIGH" className="bg-black">Alta</option>
                  </select>
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
                  {saving ? "Guardando..." : "Crear Ticket"}
                </Button>
              </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
