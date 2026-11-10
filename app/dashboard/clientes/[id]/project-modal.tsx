"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { fieldClass, selectFieldClass } from "@/components/tasks/types";
import { PROJECT_STATUS_LABELS, type ProjectStatusCode } from "@/lib/tasks/labels";
import type { ProjectRow } from "./types";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  project: ProjectRow | null;
  onSaved: () => void;
};

type Form = { name: string; description: string; status: ProjectStatusCode; startDate: string; endDate: string };

function initialForm(project: ProjectRow | null): Form {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "IN_PROGRESS",
    startDate: project?.startDate?.slice(0, 10) ?? "",
    endDate: project?.endDate?.slice(0, 10) ?? "",
  };
}

export function ProjectModal({ isOpen, onOpenChange, clientId, project, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => initialForm(project));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const currentKey = isOpen ? project?.id ?? "new" : null;
  if (currentKey !== openKey) {
    setOpenKey(currentKey);
    if (currentKey) {
      setForm(initialForm(project));
      setError(null);
      setConfirmArchive(false);
    }
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    const err = project
      ? await postJson(`/api/projects/${project.id}`, payload, "PUT")
      : await postJson("/api/projects", { ...payload, clientId });
    setSaving(false);
    if (err) return setError(err);
    onOpenChange(false);
    onSaved();
  };

  const archive = async () => {
    if (!project) return;
    if (!confirmArchive) return setConfirmArchive(true);
    setSaving(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setConfirmArchive(false);
      return setError(data?.error ?? "No se pudo archivar.");
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={project ? "Editar proyecto" : "Nuevo proyecto"}
      error={error}
      saving={saving}
      submitLabel={project ? "Guardar" : "Crear"}
      onSubmit={submit}
    >
      <Field label="Nombre *">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej: Plataforma de turnos"
          className={fieldClass}
          autoFocus
        />
      </Field>
      <Field label="Estado">
        <select value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatusCode)} className={selectFieldClass}>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-black">
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-3">
        <Field label="Inicio">
          <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Fin / entrega">
          <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={fieldClass} />
        </Field>
      </div>
      <Field label="Descripción">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={`${fieldClass} resize-none`}
        />
      </Field>
      {project && (
        <button
          type="button"
          onClick={archive}
          disabled={saving}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            confirmArchive
              ? "border border-red-500/30 bg-red-500/10 text-red-400"
              : "text-white/40 hover:bg-white/5 hover:text-red-400"
          }`}
        >
          <Archive size={14} />
          {confirmArchive ? "¿Confirmar archivo?" : "Archivar proyecto"}
        </button>
      )}
    </FormModal>
  );
}
