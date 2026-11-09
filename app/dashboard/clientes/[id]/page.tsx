"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@heroui/react/button";
import { ArrowLeft, BellRing, Mail, MessageCircle, MessageSquarePlus, Phone, Plus } from "lucide-react";
import { useJson } from "@/lib/hooks/use-json";
import { formatAmount, formatDate } from "@/lib/format";
import { TaskList } from "@/components/tasks/task-list";
import { TaskModal } from "@/components/tasks/task-modal";
import type { TaskDefaults, TaskRow } from "@/components/tasks/types";
import { ProjectsSection } from "./projects-section";
import { BillingSection } from "./billing-section";
import { TicketsSection } from "./tickets-section";
import { InteractionsSection } from "./interactions-section";
import { InteractionModal } from "./interaction-modal";
import type { ClientDetail } from "./types";

const TABS = [
  { key: "projects", label: "Proyectos" },
  { key: "tasks", label: "Recordatorios" },
  { key: "billing", label: "Facturación" },
  { key: "tickets", label: "Tickets" },
  { key: "history", label: "Historial" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useJson<ClientDetail>(`/api/clients/${id}`);
  const [tab, setTab] = useState<Tab>("projects");
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: TaskRow | null; defaults?: TaskDefaults }>({
    open: false,
    task: null,
  });
  const [interactionOpen, setInteractionOpen] = useState(false);

  const openTask = (defaults?: TaskDefaults, task: TaskRow | null = null) =>
    setTaskModal({ open: true, task, defaults: { clientId: id, ...defaults } });

  if (detail.error) {
    return (
      <div className="glass rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-red-400">{detail.error}</p>
        <Link href="/dashboard/clientes" className="text-sm text-acento-lima hover:underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-xl h-40 animate-pulse" />
        <div className="glass rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  const { client, summary } = detail.data;
  const wa = client.phone ? whatsappUrl(client.phone) : null;
  const counts: Partial<Record<Tab, number>> = {
    projects: detail.data.projects.length,
    tasks: summary.pendingTasks,
    billing: detail.data.invoices.pending.length,
    tickets: summary.openTickets,
    history: detail.data.interactions.length,
  };

  const kpis = [
    { label: "Por cobrar", value: formatAmount(summary.pendingArs), tone: "text-white" },
    {
      label: "Vencido",
      value: formatAmount(summary.overdueArs),
      tone: summary.overdueArs > 0 ? "text-red-400" : "text-white",
    },
    { label: "Contratos activos", value: String(summary.activeContracts), tone: "text-white" },
    {
      label: "Recordatorios",
      value: summary.overdueTasks > 0 ? `${summary.pendingTasks} (${summary.overdueTasks} venc.)` : String(summary.pendingTasks),
      tone: summary.overdueTasks > 0 ? "text-amber-300" : "text-white",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/clientes"
            aria-label="Volver"
            className="mt-0.5 rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-white leading-tight">{client.companyName}</h1>
              <span
                className={`rounded-full border px-2 py-px text-[11px] ${
                  client.status
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-white/15 bg-white/5 text-white/40"
                }`}
              >
                {client.status ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-sm text-white/60">{client.contactName}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:text-white"
              >
                <Mail size={12} />
                <span className="max-w-[180px] truncate">{client.email}</span>
              </a>
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:text-white"
                >
                  <Phone size={12} />
                  {client.phone}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1 text-green-400 hover:bg-green-500/20"
                >
                  <MessageCircle size={12} />
                  WhatsApp
                </a>
              )}
            </div>
            <p className="mt-2 text-[11px] text-white/40">
              {client.lastContactAt
                ? `Último contacto: ${formatDate(client.lastContactAt)} (hace ${daysSince(client.lastContactAt)} días)`
                : "Sin contactos registrados"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{k.label}</p>
              <p className={`mt-0.5 truncate text-base font-semibold ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            onPress={() => openTask()}
            className="flex-1 sm:flex-none bg-acento-lima text-black text-sm font-medium px-4 rounded-lg"
          >
            <BellRing size={15} />
            <span className="ml-1">Recordatorio</span>
          </Button>
          <Button
            onPress={() => setInteractionOpen(true)}
            className="flex-1 sm:flex-none bg-white/10 text-white text-sm font-medium px-4 rounded-lg"
          >
            <MessageSquarePlus size={15} />
            <span className="ml-1">Registrar contacto</span>
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="glass inline-flex min-w-full gap-1 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                tab === t.key ? "bg-acento-lima/10 text-acento-lima" : "text-white/50 hover:text-white"
              }`}
            >
              {t.label}
              {counts[t.key] ? (
                <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">{counts[t.key]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "projects" && (
        <ProjectsSection clientId={client.id} detail={detail.data} onChanged={detail.reload} onNewTask={openTask} />
      )}

      {tab === "tasks" && (
        <div className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white/70">Recordatorios pendientes</p>
            <button
              type="button"
              onClick={() => openTask()}
              className="flex items-center gap-1 text-xs text-acento-lima hover:underline"
            >
              <Plus size={13} />
              Nuevo
            </button>
          </div>
          <TaskList
            tasks={detail.data.tasks}
            onChanged={detail.reload}
            onEdit={(task) => openTask(undefined, task)}
            showClient={false}
            emptyLabel="Este cliente no tiene recordatorios pendientes."
          />
        </div>
      )}

      {tab === "billing" && <BillingSection detail={detail.data} onNewTask={openTask} />}

      {tab === "tickets" && <TicketsSection tickets={detail.data.tickets} />}

      {tab === "history" && (
        <InteractionsSection interactions={detail.data.interactions} onAdd={() => setInteractionOpen(true)} />
      )}

      <TaskModal
        isOpen={taskModal.open}
        onOpenChange={(open) => setTaskModal((s) => ({ ...s, open }))}
        task={taskModal.task}
        defaults={taskModal.defaults}
        lockClient
        onSaved={detail.reload}
      />
      <InteractionModal
        isOpen={interactionOpen}
        onOpenChange={setInteractionOpen}
        clientId={client.id}
        onSaved={detail.reload}
      />
    </div>
  );
}
