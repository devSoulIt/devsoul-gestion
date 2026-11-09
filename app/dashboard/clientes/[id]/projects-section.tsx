"use client";

import { useState } from "react";
import {
  AppWindow,
  BellRing,
  Code2,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Link2,
  Pencil,
  Plug,
  Plus,
  Server,
  Smartphone,
} from "lucide-react";
import { formatAmount, formatDate } from "@/lib/format";
import { postJson } from "@/components/form-modal";
import type { TaskDefaults } from "@/components/tasks/types";
import { COMPONENT_KIND_LABELS, PROJECT_STATUS_LABELS, type ComponentKindCode } from "@/lib/tasks/labels";
import { ProjectModal } from "./project-modal";
import { ComponentModal } from "./component-modal";
import { CONTRACT_TYPE_LABELS, type ClientDetail, type ComponentRow, type ProjectRow } from "./types";

type Props = {
  clientId: string;
  detail: ClientDetail;
  onChanged: () => void;
  onNewTask: (defaults?: TaskDefaults) => void;
};

const KIND_ICONS: Record<ComponentKindCode, typeof AppWindow> = {
  WEB: AppWindow,
  MOBILE: Smartphone,
  BACKEND: Server,
  ADMIN: LayoutDashboard,
  INTEGRATION: Plug,
  OTHER: Code2,
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  LIVE: "border-acento-lima/40 bg-acento-lima/10 text-acento-lima",
  MAINTENANCE: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  PAUSED: "border-white/15 bg-white/5 text-white/50",
  CLOSED: "border-white/10 bg-white/5 text-white/30",
};

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ProjectsSection({ clientId, detail, onChanged, onNewTask }: Props) {
  const [projectModal, setProjectModal] = useState<{ open: boolean; project: ProjectRow | null }>({
    open: false,
    project: null,
  });
  const [componentModal, setComponentModal] = useState<{
    open: boolean;
    projectId: string | null;
    component: ComponentRow | null;
  }>({ open: false, projectId: null, component: null });
  const [assignError, setAssignError] = useState<string | null>(null);

  const looseContracts = detail.contracts.filter((c) => !c.project);

  const assignContract = async (contractId: string, projectId: string) => {
    setAssignError(null);
    const err = await postJson(`/api/contracts/${contractId}`, { projectId: projectId || null }, "PATCH");
    if (err) return setAssignError(err);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">
          {detail.projects.length} proyecto{detail.projects.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setProjectModal({ open: true, project: null })}
          className="flex items-center gap-1 rounded-lg bg-acento-lima px-3 py-1.5 text-sm font-medium text-black"
        >
          <Plus size={14} />
          Proyecto
        </button>
      </div>

      {detail.projects.length === 0 && (
        <div className="glass flex flex-col items-center gap-3 rounded-xl py-12 text-center">
          <FolderKanban size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Este cliente todavía no tiene proyectos.</p>
          <button
            type="button"
            onClick={() => setProjectModal({ open: true, project: null })}
            className="text-sm text-acento-lima hover:underline"
          >
            Crear el primero
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {detail.projects.map((project) => (
          <div key={project.id} className="glass flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-white">{project.name}</h3>
                  <span className={`rounded-full border px-2 py-px text-[11px] ${STATUS_COLORS[project.status]}`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </div>
                {(project.startDate || project.endDate) && (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {project.startDate ? formatDate(project.startDate) : "—"}
                    {" → "}
                    {project.endDate ? formatDate(project.endDate) : "en curso"}
                  </p>
                )}
                {project.description && <p className="mt-1 text-xs text-white/55">{project.description}</p>}
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onNewTask({ projectId: project.id })}
                  aria-label="Nuevo recordatorio del proyecto"
                  className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-acento-lima"
                >
                  <BellRing size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setProjectModal({ open: true, project })}
                  aria-label="Editar proyecto"
                  className="rounded p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Softwares</p>
              <ul className="space-y-1.5">
                {project.components.map((component) => {
                  const Icon = KIND_ICONS[component.kind];
                  return (
                    <li key={component.id}>
                      <button
                        type="button"
                        onClick={() => setComponentModal({ open: true, projectId: project.id, component })}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-white/20"
                      >
                        <Icon size={16} className="mt-0.5 flex-shrink-0 text-acento-lima/80" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white">{component.name}</p>
                          <p className="text-[11px] text-white/40">
                            {COMPONENT_KIND_LABELS[component.kind]}
                            {component.software && ` · Catálogo: ${component.software.name}`}
                          </p>
                          {(component.url || component.repoUrl) && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {component.url && (
                                <a
                                  href={component.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[11px] text-sky-300 hover:underline"
                                >
                                  <Link2 size={11} />
                                  {hostOf(component.url)}
                                </a>
                              )}
                              {component.repoUrl && (
                                <a
                                  href={component.repoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[11px] text-white/50 hover:underline"
                                >
                                  <GitBranch size={11} />
                                  Repo
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => setComponentModal({ open: true, projectId: project.id, component: null })}
                className="mt-1.5 flex items-center gap-1 text-xs text-acento-lima/80 hover:text-acento-lima"
              >
                <Plus size={12} />
                Agregar software
              </button>
            </div>

            {project.contracts.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Contratos</p>
                <ul className="space-y-1">
                  {project.contracts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={c.active ? "text-white/70" : "text-white/30 line-through"}>
                        {CONTRACT_TYPE_LABELS[c.type]} · {c.software.name}
                      </span>
                      <span className="flex-shrink-0 text-white/60">{formatAmount(c.totalAmount, c.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(project._count.tasks > 0 || project._count.tickets > 0) && (
              <div className="flex gap-3 border-t border-white/5 pt-2 text-[11px] text-white/45">
                {project._count.tasks > 0 && <span>{project._count.tasks} recordatorio(s)</span>}
                {project._count.tickets > 0 && <span>{project._count.tickets} ticket(s) abiertos</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {looseContracts.length > 0 && (
        <div className="glass rounded-xl p-4">
          <p className="text-sm font-semibold text-white/70">Contratos sin proyecto</p>
          <p className="mb-3 text-xs text-white/40">Asignalos a un proyecto para agruparlos.</p>
          {assignError && (
            <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {assignError}
            </p>
          )}
          <ul className="space-y-2">
            {looseContracts.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <span className={c.active ? "text-white" : "text-white/40"}>{c.software.name}</span>
                  <span className="text-xs text-white/40">
                    {" · "}
                    {CONTRACT_TYPE_LABELS[c.type]} · {formatAmount(c.totalAmount, c.currency)}
                    {!c.active && " · inactivo"}
                  </span>
                </div>
                {detail.projects.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && assignContract(c.id, e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none sm:w-48"
                  >
                    <option value="" className="bg-black">
                      Asignar a proyecto…
                    </option>
                    {detail.projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-black">
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProjectModal
        isOpen={projectModal.open}
        onOpenChange={(open) => setProjectModal((s) => ({ ...s, open }))}
        clientId={clientId}
        project={projectModal.project}
        onSaved={onChanged}
      />
      <ComponentModal
        isOpen={componentModal.open}
        onOpenChange={(open) => setComponentModal((s) => ({ ...s, open }))}
        projectId={componentModal.projectId}
        component={componentModal.component}
        onSaved={onChanged}
      />
    </div>
  );
}
