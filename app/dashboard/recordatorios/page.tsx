"use client";

import { useState } from "react";
import { Button } from "@heroui/react/button";
import { BellRing, Plus } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import { TaskList } from "@/components/tasks/task-list";
import { TaskModal } from "@/components/tasks/task-modal";
import type { TaskRow } from "@/components/tasks/types";

const SCOPES = [
  { value: "me", label: "Míos" },
  { value: "all", label: "Todos" },
] as const;

const VIEWS = [
  { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidos" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "7 días" },
  { value: "done", label: "Hechos" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];
type View = (typeof VIEWS)[number]["value"];

function buildUrl(scope: Scope, view: View) {
  const params = new URLSearchParams();
  if (scope === "me") params.set("assignedTo", "me");
  if (view === "done") params.set("status", "DONE");
  else if (view !== "pending") params.set("range", view);
  return `/api/tasks?${params}`;
}

export default function RecordatoriosPage() {
  const [scope, setScope] = useState<Scope>("me");
  const [view, setView] = useState<View>("pending");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const tasks = useJson<TaskRow[]>(buildUrl(scope, view));

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditing(task);
    setModalOpen(true);
  };

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
      active
        ? "border-acento-lima/50 bg-acento-lima/10 text-acento-lima"
        : "border-white/10 bg-white/5 text-white/50 hover:text-white"
    }`;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-white">Recordatorios</h1>
          <Button onPress={openCreate} className="bg-acento-lima text-black font-medium text-sm px-4 rounded-lg">
            <Plus size={15} />
            <span className="ml-1">Nuevo</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {SCOPES.map((s) => (
              <button key={s.value} type="button" onClick={() => setScope(s.value)} className={pill(scope === s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" onClick={() => setView(v.value)} className={pill(view === v.value)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        {tasks.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : tasks.error ? (
          <p className="text-sm text-red-400">{tasks.error}</p>
        ) : (tasks.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <BellRing size={32} className="text-white/20" />
            <p className="text-sm text-white/40">
              {view === "done" ? "Todavía no completaste recordatorios." : "Nada pendiente por acá."}
            </p>
            {view !== "done" && (
              <button onClick={openCreate} className="text-sm text-acento-lima hover:underline">
                Crear un recordatorio
              </button>
            )}
          </div>
        ) : (
          <TaskList
            tasks={tasks.data ?? []}
            onChanged={tasks.reload}
            onEdit={openEdit}
            grouped={view !== "done"}
          />
        )}
      </div>

      <TaskModal isOpen={modalOpen} onOpenChange={setModalOpen} task={editing} onSaved={tasks.reload} />
    </div>
  );
}
