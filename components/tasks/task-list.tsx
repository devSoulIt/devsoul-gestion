"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Pencil, Repeat, RotateCcw, Trash2, User } from "lucide-react";
import { postJson } from "@/components/form-modal";
import { formatAmount, formatDate, todayKey } from "@/lib/format";
import { TASK_RECURRENCE_LABELS, TASK_TYPE_LABELS } from "@/lib/tasks/labels";
import { dueState, type TaskRow } from "./types";

type Props = {
  tasks: TaskRow[];
  onChanged: () => void;
  onEdit: (task: TaskRow) => void;
  showClient?: boolean;
  grouped?: boolean;
  emptyLabel?: string;
};

const GROUPS = [
  { key: "overdue", label: "Vencidos", color: "text-red-400" },
  { key: "today", label: "Hoy", color: "text-acento-lima" },
  { key: "upcoming", label: "Próximos", color: "text-white/50" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  COLLECTION: "bg-acento-lima/10 text-acento-lima border-acento-lima/30",
  RENEWAL: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  CALL: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  MESSAGE: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  MEETING: "bg-purple-500/10 text-purple-300 border-purple-500/30",
};

export function TaskList({ tasks, onChanged, onEdit, showClient = true, grouped = true, emptyLabel }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();

  const act = async (task: TaskRow, action: "complete" | "reopen" | "cancel") => {
    setBusyId(task.id);
    setError(null);
    const err =
      action === "cancel"
        ? await fetch(`/api/tasks/${task.id}`, { method: "DELETE" }).then((r) => (r.ok ? null : "No se pudo eliminar."))
        : await postJson(`/api/tasks/${task.id}`, { action }, "PUT");
    setBusyId(null);
    if (err) return setError(err);
    onChanged();
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-white/40 py-6 text-center">{emptyLabel ?? "No hay recordatorios."}</p>;
  }

  const renderTask = (task: TaskRow) => {
    const state = dueState(task.dueAt, today);
    const done = task.status !== "PENDING";
    const busy = busyId === task.id;
    return (
      <li
        key={task.id}
        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
          !done && state === "overdue" ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <button
          type="button"
          onClick={() => act(task, done ? "reopen" : "complete")}
          disabled={busy}
          aria-label={done ? "Reabrir" : "Marcar como hecho"}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
            done
              ? "border-acento-lima bg-acento-lima text-black"
              : "border-white/30 hover:border-acento-lima hover:bg-acento-lima/10"
          } ${busy ? "opacity-50" : ""}`}
        >
          {done && <Check size={13} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${done ? "text-white/40 line-through" : "text-white"}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
            <span className={`rounded border px-1.5 py-px ${TYPE_COLORS[task.type] ?? "border-white/15 bg-white/5 text-white/60"}`}>
              {TASK_TYPE_LABELS[task.type]}
            </span>
            <span className={!done && state === "overdue" ? "text-red-400" : ""}>
              {state === "today" ? "Hoy" : formatDate(task.dueAt)}
            </span>
            {task.recurrence !== "NONE" && (
              <span className="flex items-center gap-0.5">
                <Repeat size={10} />
                {TASK_RECURRENCE_LABELS[task.recurrence]}
              </span>
            )}
            {task.assignedTo && (
              <span className="flex items-center gap-0.5">
                <User size={10} />
                {task.assignedTo.name}
              </span>
            )}
            {showClient && task.client && (
              <Link href={`/dashboard/clientes/${task.client.id}`} className="text-white/60 hover:text-acento-lima">
                {task.client.companyName}
              </Link>
            )}
            {task.project && <span>· {task.project.name}</span>}
            {task.invoice && (
              <span className="text-white/60">
                · Factura {task.invoice.period} {formatAmount(task.invoice.amount, task.invoice.currency)}
                {task.invoice.status === "PAID" && <span className="text-green-400"> (cobrada)</span>}
              </span>
            )}
          </div>
          {task.notes && <p className="mt-1 whitespace-pre-line text-xs text-white/50">{task.notes}</p>}
        </div>

        <div className="flex flex-shrink-0 gap-1">
          {done ? (
            <button
              type="button"
              onClick={() => act(task, "reopen")}
              disabled={busy}
              aria-label="Reabrir"
              className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
            >
              <RotateCcw size={14} />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label="Editar"
                className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => act(task, "cancel")}
                disabled={busy}
                aria-label="Eliminar"
                className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      {grouped ? (
        GROUPS.map((group) => {
          const list = tasks.filter((t) => t.status === "PENDING" && dueState(t.dueAt, today) === group.key);
          if (list.length === 0) return null;
          return (
            <div key={group.key}>
              <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${group.color}`}>
                {group.label} · {list.length}
              </p>
              <ul className="space-y-1.5">{list.map(renderTask)}</ul>
            </div>
          );
        })
      ) : (
        <ul className="space-y-1.5">{tasks.map(renderTask)}</ul>
      )}
    </div>
  );
}
