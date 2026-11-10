"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@heroui/react/card";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react";
import { Archive, BellRing, ChevronDown, Pencil, Eye, Plus, Search, Users } from "lucide-react";
import {
  SOCIAL_KEYS,
  SOCIAL_META,
  STAGE_META,
  SocialLinks,
  StageBadge,
  type SocialKey,
  type StageCode,
} from "@/components/clients/social-links";

type ClientRow = {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: boolean;
  stage: StageCode;
  lastContactAt: string | null;
  _count: { contracts: number; projects: number; tasks: number };
} & Record<SocialKey, string | null>;

type FormState = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: boolean;
  stage: StageCode;
} & Record<SocialKey, string>;

type StageFilter = "ALL" | StageCode;

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors";

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/50 mb-1 block">{label}</label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

const EMPTY_SOCIALS = Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ""])) as Record<SocialKey, string>;

const EMPTY_FORM: FormState = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  status: true,
  stage: "PROSPECT",
  ...EMPTY_SOCIALS,
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showSocials, setShowSocials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const loadClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const counts = useMemo(
    () => ({
      ALL: clients.length,
      PROSPECT: clients.filter((c) => c.stage === "PROSPECT").length,
      CLIENT: clients.filter((c) => c.stage === "CLIENT").length,
    }),
    [clients]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        (stageFilter === "ALL" || c.stage === stageFilter) &&
        (c.companyName.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q))
    );
  }, [clients, search, stageFilter]);

  const openCreate = () => {
    setEditingClient(null);
    setForm({ ...EMPTY_FORM, stage: stageFilter === "CLIENT" ? "CLIENT" : "PROSPECT" });
    setShowSocials(true);
    setFormError(null);
    setConfirmArchive(false);
    setModalOpen(true);
  };

  const openEdit = (c: ClientRow) => {
    setEditingClient(c);
    setForm({
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      status: c.status,
      stage: c.stage,
      ...(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k] ?? ""])) as Record<SocialKey, string>),
    });
    setShowSocials(SOCIAL_KEYS.some((k) => c[k]));
    setFormError(null);
    setConfirmArchive(false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.contactName.trim()) {
      setFormError("Completá la razón social y el contacto.");
      return;
    }
    if (form.stage === "CLIENT" && !form.email.trim()) {
      setFormError("Para registrarlo como cliente cargá el email.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          phone: form.phone || null,
          ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, form[k] || null])),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Error al guardar.");
        return;
      }
      setModalOpen(false);
      loadClients();
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!editingClient) return;
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Error al archivar.");
        setConfirmArchive(false);
        return;
      }
      setModalOpen(false);
      loadClients();
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const filters: { value: StageFilter; label: string }[] = [
    { value: "ALL", label: "Todos" },
    { value: "PROSPECT", label: "Posibles clientes" },
    { value: "CLIENT", label: "Clientes" },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <div className="flex gap-2 flex-1 sm:max-w-sm sm:ml-auto">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por empresa, contacto o email..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors"
              />
            </div>
            <Button
              onPress={openCreate}
              className="bg-acento-lima text-black font-medium text-sm px-4 flex-shrink-0 rounded-lg"
            >
              <Plus size={15} />
              <span className="hidden sm:inline ml-1">Nuevo</span>
            </Button>
          </div>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStageFilter(f.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
                stageFilter === f.value
                  ? "border-acento-lima/50 bg-acento-lima/10 text-acento-lima"
                  : "border-white/10 bg-white/5 text-white/50 hover:text-white"
              }`}
            >
              {f.label}
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users size={32} className="text-white/20" />
          <p className="text-white/40 text-sm">
            {search
              ? "Sin resultados para esa búsqueda"
              : stageFilter === "PROSPECT"
                ? "No hay posibles clientes cargados"
                : "Todavía no hay clientes"}
          </p>
          {!search && (
            <button onClick={openCreate} className="text-acento-lima text-sm hover:underline">
              Registrar uno
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card.Root key={c.id} className="glass rounded-xl border-white/10">
              <Card.Header className="px-5 pt-5 pb-0 flex items-start justify-between gap-2">
                <Card.Title className="text-base font-semibold text-white leading-tight">
                  {c.companyName}
                </Card.Title>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {!c.status && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-px text-[11px] text-white/40">
                      Inactivo
                    </span>
                  )}
                  <StageBadge stage={c.stage} />
                </div>
              </Card.Header>
              <Card.Content className="px-5 py-3 space-y-1">
                <p className="text-sm text-white/70">{c.contactName}</p>
                <p className="text-xs text-white/40 truncate">{c.email ?? c.phone ?? "Sin email"}</p>
                <div className="pt-1.5">
                  <SocialLinks socials={c} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs pt-1.5">
                  {c.stage === "CLIENT" ? (
                    <>
                      <span className="text-acento-lima/80">
                        {c._count.projects} proyecto{c._count.projects === 1 ? "" : "s"}
                      </span>
                      <span className="text-white/50">
                        {c._count.contracts} contrato{c._count.contracts === 1 ? "" : "s"} activo
                        {c._count.contracts === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : (
                    <span className="text-white/40">
                      {c.lastContactAt
                        ? `Último contacto: ${new Date(c.lastContactAt).toLocaleDateString("es-AR")}`
                        : "Sin contactos registrados"}
                    </span>
                  )}
                  {c._count.tasks > 0 && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <BellRing size={11} />
                      {c._count.tasks}
                    </span>
                  )}
                </div>
              </Card.Content>
              <Card.Footer className="px-5 pb-4 pt-0 flex gap-3">
                <button
                  onClick={() => openEdit(c)}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
                >
                  <Pencil size={13} />
                  Editar
                </button>
                <Link
                  href={`/dashboard/clientes/${c.id}`}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-acento-lima transition-colors"
                >
                  <Eye size={13} />
                  Ver ficha
                </Link>
              </Card.Footer>
            </Card.Root>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="px-6 pt-6 pb-0">
                <Modal.Heading className="text-lg font-semibold text-white">
                  {editingClient ? "Editar cliente" : "Registrar cliente"}
                </Modal.Heading>
              </Modal.Header>
              <form onSubmit={handleSave}>
                <Modal.Body className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                  {formError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {formError}
                    </p>
                  )}

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Etapa</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(STAGE_META) as StageCode[]).map((stage) => (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setField("stage", stage)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            form.stage === stage
                              ? STAGE_META[stage].className
                              : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                          }`}
                        >
                          <span className="block text-sm font-medium">{STAGE_META[stage].label}</span>
                          <span className="mt-0.5 block text-[10px] leading-tight opacity-80">
                            {STAGE_META[stage].hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <InputField
                    label="Razón social / marca *"
                    value={form.companyName}
                    onChange={(v) => setField("companyName", v)}
                  />
                  <InputField
                    label="Contacto *"
                    value={form.contactName}
                    onChange={(v) => setField("contactName", v)}
                  />
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <InputField
                        label={form.stage === "CLIENT" ? "Email *" : "Email"}
                        type="email"
                        value={form.email}
                        onChange={(v) => setField("email", v)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <InputField label="Teléfono" value={form.phone} onChange={(v) => setField("phone", v)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowSocials((v) => !v)}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm text-white/70"
                    >
                      <span>
                        Redes sociales
                        {SOCIAL_KEYS.some((k) => form[k]) && (
                          <span className="ml-2 text-xs text-acento-lima/80">
                            {SOCIAL_KEYS.filter((k) => form[k]).length} cargada(s)
                          </span>
                        )}
                      </span>
                      <ChevronDown size={16} className={`transition-transform ${showSocials ? "rotate-180" : ""}`} />
                    </button>
                    {showSocials && (
                      <div className="grid grid-cols-1 gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
                        {SOCIAL_KEYS.map((key) => (
                          <InputField
                            key={key}
                            label={SOCIAL_META[key].label}
                            value={form[key]}
                            placeholder={SOCIAL_META[key].placeholder}
                            onChange={(v) => setField(key, v)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {editingClient && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-sm text-white/60">Estado</span>
                      <button
                        type="button"
                        onClick={() => setField("status", !form.status)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          form.status
                            ? "border-green-500/50 text-green-400 bg-green-500/10"
                            : "border-white/20 text-white/40 bg-white/5"
                        }`}
                      >
                        {form.status ? "Activo" : "Inactivo"}
                      </button>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer className="px-6 pb-6 pt-2 flex items-center justify-end gap-2">
                  {editingClient && (
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={saving}
                      className={`mr-auto flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors ${
                        confirmArchive
                          ? "text-red-400 bg-red-500/10 border border-red-500/30"
                          : "text-white/40 hover:text-red-400 hover:bg-white/5"
                      }`}
                    >
                      <Archive size={14} />
                      {confirmArchive ? "¿Confirmar?" : "Archivar"}
                    </button>
                  )}
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
                    {saving ? "Guardando..." : "Guardar"}
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
