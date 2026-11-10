import { Mail, MessageCircle, MessageSquarePlus, NotebookPen, Phone, Users } from "lucide-react";
import { INTERACTION_TYPE_LABELS, type InteractionTypeCode } from "@/lib/tasks/labels";
import type { InteractionRow } from "./types";

const ICONS: Record<InteractionTypeCode, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  NOTE: NotebookPen,
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InteractionsSection({ interactions, onAdd }: { interactions: InteractionRow[]; onAdd: () => void }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white/70">Historial de contacto</p>
        <button type="button" onClick={onAdd} className="flex items-center gap-1 text-xs text-acento-lima hover:underline">
          <MessageSquarePlus size={13} />
          Registrar
        </button>
      </div>
      {interactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">
          Registrá llamadas, mensajes y reuniones para tener el historial del cliente.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-5">
          {interactions.map((i) => {
            const Icon = ICONS[i.type];
            return (
              <li key={i.id} className="relative">
                <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black text-acento-lima">
                  <Icon size={12} />
                </span>
                <p className="text-[11px] text-white/45">
                  {INTERACTION_TYPE_LABELS[i.type]} · {formatDateTime(i.occurredAt)}
                  {i.user && ` · ${i.user.name}`}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-white/85">{i.note}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
