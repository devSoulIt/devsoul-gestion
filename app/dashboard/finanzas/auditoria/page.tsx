"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { useJson } from "@/lib/hooks/use-json";
import { selectClass } from "../types";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type AuditResponse = {
  data: AuditRow[];
  total: number;
  page: number;
  totalPages: number;
  users: { id: string; name: string }[];
};

const ENTITY_LABELS: Record<string, string> = {
  Payment: "Cobros",
  PartnerPayment: "Pagos a socios",
  Invoice: "Facturas",
  Contract: "Contratos",
  Account: "Cuentas",
  Transaction: "Movimientos",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function AuditoriaPage() {
  const [entity, setEntity] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (entity) params.set("entity", entity);
  if (userId) params.set("userId", userId);
  const q = useJson<AuditResponse>(`/api/audit?${params.toString()}`);
  const rows = q.data?.data ?? [];

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <div className="glass rounded-xl p-4">
        <h1 className="text-xl font-bold text-white">Auditoría</h1>
        <p className="text-xs text-white/40 mt-1">Quién cargó, revirtió o cambió cada cosa. Solo la ven los socios OWNER.</p>
      </div>

      <div className="glass rounded-xl p-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Tipo</label>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="" className="bg-black">Todos</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k} className="bg-black">
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Usuario</label>
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="" className="bg-black">Todos</option>
            {(q.data?.users ?? []).map((u) => (
              <option key={u.id} value={u.id} className="bg-black">
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {q.error ? (
        <div className="glass rounded-xl py-10 text-center text-sm text-white/40">{q.error}</div>
      ) : q.loading && !q.data ? (
        <div className="glass rounded-xl h-24 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl py-12 flex flex-col items-center gap-2 text-sm text-white/40">
          <History size={28} className="text-white/20" />
          Todavía no hay registros.
        </div>
      ) : (
        <div className="glass rounded-xl divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3 space-y-0.5">
              <p className="text-sm text-white">{r.summary}</p>
              <p className="text-xs text-white/40">
                {formatDateTime(r.createdAt)} · {r.user?.name ?? "Sistema"} · {ENTITY_LABELS[r.entity] ?? r.entity}
              </p>
            </div>
          ))}
        </div>
      )}

      {(q.data?.totalPages ?? 1) > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm text-white/60 border border-white/10 rounded-lg px-4 py-1.5 disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-sm text-white/40 px-2 py-1.5">
            {page} / {q.data?.totalPages}
          </span>
          <button
            disabled={page >= (q.data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-white/60 border border-white/10 rounded-lg px-4 py-1.5 disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
