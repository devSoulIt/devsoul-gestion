import { Bot } from "lucide-react";

export default function IAChatPage() {
  return (
    <div className="glass rounded-xl px-6 py-14 flex flex-col items-center text-center gap-3 max-w-lg mx-auto mt-6">
      <div className="p-3 rounded-full bg-acento-lima/10 text-acento-lima">
        <Bot size={28} />
      </div>
      <h1 className="text-lg font-semibold text-white">Chat IA: próximamente</h1>
      <p className="text-sm text-white/50">
        Estamos evaluando qué proveedor de IA usar. Mientras tanto, el chat está desactivado y no se envían datos a
        ningún servicio externo.
      </p>
    </div>
  );
}
