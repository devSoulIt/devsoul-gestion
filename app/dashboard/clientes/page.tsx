"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react";
import { Archive, BellRing, Pencil, Eye, Plus, Search, Users } from "lucide-react";

type ClientRow = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: boolean;
  lastContactAt: string | null;
  _count: { contracts: number; projects: number; tasks: number };
};

type FormState = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: boolean;
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

const EMPTY_FORM: FormState = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  status: true,
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.companyName.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      ),
    [clients, search]
  );

  const openCreate = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setConfirmArchive(false);
    setModalOpen(true);
  };

  const openEdit = (c: ClientRow) => {
    setEditingClient(c);
    setForm({
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone ?? "",
      status: c.status,
    });
    setFormError(null);
    setConfirmArchive(false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      setFormError("Completá los campos obligatorios.");
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
        body: JSON.stringify({ ...form, phone: form.phone || undefined }),
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

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass rounded-xl p-4">
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
              placeholder="Buscar por empresa o email..."
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

      {/* Grid */}
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
            {search ? "Sin resultados para esa búsqueda" : "Todavía no hay clientes"}
          </p>
          {!search && (
            <button onClick={openCreate} className="text-acento-lima text-sm hover:underline">
              Crear el primero
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
                <Chip color={c.status ? "success" : "default"} size="sm" variant="soft">
                  {c.status ? "Activo" : "Inactivo"}
                </Chip>
              </Card.Header>
              <Card.Content className="px-5 py-3 space-y-1">
                <p className="text-sm text-white/70">{c.contactName}</p>
                <p className="text-xs text-white/40 truncate">{c.email}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-2">
                  <span className="text-acento-lima/80">
                    {c._count.projects} proyecto{c._count.projects === 1 ? "" : "s"}
                  </span>
                  <span className="text-white/50">
                    {c._count.contracts} contrato{c._count.contracts === 1 ? "" : "s"} activo{c._count.contracts === 1 ? "" : "s"}
                  </span>
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

      {/* Modal */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="px-6 pt-6 pb-0">
                <Modal.Heading className="text-lg font-semibold text-white">
                  {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
                </Modal.Heading>
              </Modal.Header>
              <form onSubmit={handleSave}>
                <Modal.Body className="px-6 py-4 space-y-3">
                  {formError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {formError}
                    </p>
                  )}
                  <InputField
                    label="Razón Social *"
                    value={form.companyName}
                    onChange={(v) => setField("companyName", v)}
                  />
                  <InputField
                    label="Contacto *"
                    value={form.contactName}
                    onChange={(v) => setField("contactName", v)}
                  />
                  <InputField
                    label="Email *"
                    type="email"
                    value={form.email}
                    onChange={(v) => setField("email", v)}
                  />
                  <InputField
                    label="Teléfono"
                    value={form.phone}
                    onChange={(v) => setField("phone", v)}
                  />
                  {editingClient && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-sm text-white/60">Estado</span>
                      <button
                        type="button"
                        onClick={() => setField("status", !form.status)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.status
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
                      className={`mr-auto flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors ${confirmArchive
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
