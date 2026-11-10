"use client";

import { useState } from "react";
import { Field, FormModal, postJson } from "@/components/form-modal";
import { useJson } from "@/lib/hooks/use-json";
import { todayKey } from "@/lib/format";
import {
  TASK_RECURRENCE_LABELS,
  TASK_TYPE_LABELS,
  type TaskRecurrenceCode,
  type TaskTypeCode,
} from "@/lib/tasks/labels";
import { fieldClass, selectFieldClass, type TaskDefaults, type TaskRow, type UserOption } from "./types";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRow | null;
  defaults?: TaskDefaults;
  lockClient?: boolean;
  onSaved: () => void;
};

type Form = {
  title: string;
  type: TaskTypeCode;
  dueAt: string;
  recurrence: TaskRecurrenceCode;
  assignedToId: string;
  clientId: string;
  projectId: string;
  invoiceId: string;
  notes: string;
};

type ClientOption = { id: string; companyName: string };
type ProjectOption = { id: string; name: string };

function initialForm(task: TaskRow | null | undefined, defaults: TaskDefaults | undefined): Form {
  if (task) {
    return {
      title: task.title,
      type: task.type,
      dueAt: task.dueAt.slice(0, 10),
      recurrence: task.recurrence,
      assignedToId: task.assignedTo?.id ?? "",
      clientId: task.client?.id ?? "",
      projectId: task.project?.id ?? "",
      invoiceId: task.invoice?.id ?? "",
      notes: task.notes ?? "",
    };
  }
  return {
    title: defaults?.title ?? "",
    type: defaults?.type ?? "FOLLOW_UP",
    dueAt: todayKey(),
    recurrence: "NONE",
    assignedToId: "",
    clientId: defaults?.clientId ?? "",
    projectId: defaults?.projectId ?? "",
    invoiceId: defaults?.invoiceId ?? "",
    notes: "",
  };
}

export function TaskModal({ isOpen, onOpenChange, task, defaults, lockClient, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => initialForm(task, defaults));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const currentKey = isOpen ? `${task?.id ?? "new"}:${JSON.stringify(defaults ?? {})}` : null;
  if (currentKey !== openKey) {
    setOpenKey(currentKey);
    if (currentKey) {
      setForm(initialForm(task, defaults));
      setError(null);
    }
  }

  const users = useJson<UserOption[]>(isOpen ? "/api/users" : null);
  const clients = useJson<ClientOption[]>(isOpen && !lockClient ? "/api/clients" : null);
  const projects = useJson<ProjectOption[]>(
    isOpen && form.clientId ? `/api/projects?clientId=${encodeURIComponent(form.clientId)}` : null
  );

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.title.trim() || !form.dueAt) {
      setError("Completá el título y la fecha.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title,
      type: form.type,
      dueAt: form.dueAt,
      recurrence: form.recurrence,
      notes: form.notes,
      clientId: form.clientId || null,
      projectId: form.projectId || null,
      invoiceId: form.invoiceId || null,
      ...(task || form.assignedToId ? { assignedToId: form.assignedToId || null } : {}),
    };
    const err = task
      ? await postJson(`/api/tasks/${task.id}`, payload, "PUT")
      : await postJson("/api/tasks", payload);
    setSaving(false);
    if (err) return setError(err);
    onOpenChange(false);
    onSaved();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={task ? "Editar recordatorio" : "Nuevo recordatorio"}
      error={error}
      saving={saving}
      submitLabel={task ? "Guardar" : "Crear"}
      onSubmit={submit}
    >
      <Field label="¿Qué hay que hacer? *">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ej: Cobrarle la cuota de octubre"
          maxLength={200}
          className={fieldClass}
          autoFocus
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Tipo">
          <select value={form.type} onChange={(e) => set("type", e.target.value as TaskTypeCode)} className={selectFieldClass}>
            {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-black">
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha *">
          <input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} className={fieldClass} />
        </Field>
      </div>

      <div className="flex gap-3">
        <Field label="Responsable">
          <select value={form.assignedToId} onChange={(e) => set("assignedToId", e.target.value)} className={selectFieldClass}>
            <option value="" className="bg-black">
              {task ? "Sin asignar" : "Yo"}
            </option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id} className="bg-black">
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Repetir">
          <select
            value={form.recurrence}
            onChange={(e) => set("recurrence", e.target.value as TaskRecurrenceCode)}
            className={selectFieldClass}
          >
            {Object.entries(TASK_RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-black">
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!lockClient && (
        <Field label="Cliente">
          <select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, projectId: "", invoiceId: "" }))}
            className={selectFieldClass}
          >
            <option value="" className="bg-black">
              Sin cliente
            </option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-black">
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
      )}

      {form.clientId && (projects.data?.length ?? 0) > 0 && (
        <Field label="Proyecto">
          <select value={form.projectId} onChange={(e) => set("projectId", e.target.value)} className={selectFieldClass}>
            <option value="" className="bg-black">
              Sin proyecto
            </option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id} className="bg-black">
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {form.invoiceId && (
        <p className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          Vinculado a una factura{task?.invoice ? ` del período ${task.invoice.period}` : ""}.
          <button type="button" onClick={() => set("invoiceId", "")} className="ml-2 text-red-400 hover:underline">
            Quitar
          </button>
        </p>
      )}

      <Field label="Notas">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Detalle, número de contacto, qué decirle..."
          className={`${fieldClass} resize-none`}
        />
      </Field>
    </FormModal>
  );
}
