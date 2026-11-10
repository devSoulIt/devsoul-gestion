import Link from "next/link";
import { ExternalLink, Ticket } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TicketRow } from "./types";

const PRIORITY: Record<TicketRow["priority"], { label: string; className: string }> = {
  HIGH: { label: "Alta", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  MEDIUM: { label: "Media", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  LOW: { label: "Baja", className: "border-white/15 bg-white/5 text-white/50" },
};

const STATUS: Record<TicketRow["status"], string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  RESOLVED: "Resuelto",
};

export function TicketsSection({ tickets }: { tickets: TicketRow[] }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white/70">Tickets abiertos</p>
        <Link href="/dashboard/tickets" className="flex items-center gap-1 text-xs text-white/50 hover:text-acento-lima">
          Tickets
          <ExternalLink size={12} />
        </Link>
      </div>
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Ticket size={28} className="text-white/20" />
          <p className="text-sm text-white/40">Sin tickets abiertos.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white">{t.title}</p>
                <span className={`flex-shrink-0 rounded border px-1.5 py-px text-[11px] ${PRIORITY[t.priority].className}`}>
                  {PRIORITY[t.priority].label}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">
                {STATUS[t.status]} · {t.software.name}
                {t.project && ` · ${t.project.name}`} · {formatDate(t.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
