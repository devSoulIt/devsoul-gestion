"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { fieldClass, selectFieldClass } from "@/components/tasks/types";
import { useJson } from "@/lib/hooks/use-json";
import { COMPONENT_KIND_LABELS, type ComponentKindCode } from "@/lib/tasks/labels";
import type { ComponentRow } from "./types";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  component: ComponentRow | null;
  onSaved: () => void;
};

type Form = {
  name: string;
  kind: ComponentKindCode;
  softwareId: string;
  url: string;
  repoUrl: string;
  notes: string;
};

type SoftwareOption = { id: string; name: string; type: "SAAS" | "CUSTOM" };

function initialForm(component: ComponentRow | null): Form {
  return {
    name: component?.name ?? "",
    kind: component?.kind ?? "WEB",
    softwareId: component?.software?.id ?? "",
    url: component?.url ?? "",
    repoUrl: component?.repoUrl ?? "",
    notes: component?.notes ?? "",
  };
}

export function ComponentModal({ isOpen, onOpenChange, projectId, component, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => initialForm(component));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const softwares = useJson<SoftwareOption[]>(isOpen ? "/api/softwares" : null);

  const currentKey = isOpen ? `${projectId}:${component?.id ?? "new"}` : null;
  if (currentKey !== openKey) {
    setOpenKey(currentKey);
    if (currentKey) {
      setForm(initialForm(component));
      setError(null);
      setConfirmDelete(false);
    }
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const selectSoftware = (softwareId: string) => {
    const software = softwares.data?.find((s) => s.id === softwareId);
    setForm((f) => ({ ...f, softwareId, name: f.name || software?.name || "" }));
  };

  const submit = async () => {
    if (!form.name.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError(null);
    const payload = { ...form, softwareId: form.softwareId || null };
    const err = component
      ? await postJson(`/api/project-components/${component.id}`, payload, "PUT")
      : await postJson(`/api/projects/${projectId}/components`, payload);
    setSaving(false);
    if (err) return setError(err);
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!component) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    const res = await fetch(`/api/project-components/${component.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setConfirmDelete(false);
      return setError("No se pudo eliminar el componente.");
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={component ? "Editar componente" : "Agregar software al proyecto"}
      error={error}
      saving={saving}
      submitLabel={component ? "Guardar" : "Agregar"}
      onSubmit={submit}
    >
      <div className="flex gap-3">
        <Field label="Tipo">
          <select value={form.kind} onChange={(e) => set("kind", e.target.value as ComponentKindCode)} className={selectFieldClass}>
            {Object.entries(COMPONENT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-black">
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Del catálogo">
          <select value={form.softwareId} onChange={(e) => selectSoftware(e.target.value)} className={selectFieldClass}>
            <option value="" className="bg-black">
              Ninguno
            </option>
            {(softwares.data ?? []).map((s) => (
              <option key={s.id} value={s.id} className="bg-black">
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nombre *">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej: App de pacientes"
          className={fieldClass}
        />
      </Field>
      <Field label="URL">
        <input
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="app.cliente.com"
          inputMode="url"
          className={fieldClass}
        />
      </Field>
      <Field label="Repositorio">
        <input
          value={form.repoUrl}
          onChange={(e) => set("repoUrl", e.target.value)}
          placeholder="github.com/devsoul/..."
          inputMode="url"
          className={fieldClass}
        />
      </Field>
      <Field label="Notas">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="Stack, hosting, accesos..."
          className={`${fieldClass} resize-none`}
        />
      </Field>
      {component && (
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            confirmDelete
              ? "border border-red-500/30 bg-red-500/10 text-red-400"
              : "text-white/40 hover:bg-white/5 hover:text-red-400"
          }`}
        >
          <Trash2 size={14} />
          {confirmDelete ? "¿Confirmar?" : "Quitar del proyecto"}
        </button>
      )}
    </FormModal>
  );
}
