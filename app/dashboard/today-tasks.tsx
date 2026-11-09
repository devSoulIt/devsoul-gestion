"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, ChevronRight, Plus } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import { TaskList } from "@/components/tasks/task-list";
import { TaskModal } from "@/components/tasks/task-modal";
import type { TaskRow } from "@/components/tasks/types";

export function TodayTasks() {
  const tasks = useJson<TaskRow[]>("/api/tasks?assignedTo=me&range=week");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-acento-lima" />
          <p className="text-sm font-semibold text-white/70">Mis pendientes de la semana</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            aria-label="Nuevo recordatorio"
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-acento-lima"
          >
            <Plus size={16} />
          </button>
          <Link
            href="/dashboard/recordatorios"
            className="flex items-center text-xs text-white/50 hover:text-acento-lima"
          >
            Ver todos
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
      {tasks.loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      ) : (
        <TaskList
          tasks={(tasks.data ?? []).slice(0, 8)}
          onChanged={tasks.reload}
          onEdit={(task) => {
            setEditing(task);
            setModalOpen(true);
          }}
          emptyLabel="No tenés nada pendiente esta semana."
        />
      )}
      <TaskModal isOpen={modalOpen} onOpenChange={setModalOpen} task={editing} onSaved={tasks.reload} />
    </div>
  );
}
