"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { Bot, User, Send } from "lucide-react";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function IAChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ia/chat",
    streamProtocol: "text",
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 md:-m-6">
      {/* Messages zone */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <Bot size={36} className="text-acento-lima opacity-60" />
            <p className="text-white/50 text-sm max-w-xs">
              Preguntame sobre ingresos, clientes, facturas pendientes o proyecciones.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                  m.role === "user" ? "bg-white/10" : "bg-acento-lima/20"
                }`}
              >
                {m.role === "user" ? (
                  <User size={13} className="text-white/60" />
                ) : (
                  <Bot size={13} className="text-acento-lima" />
                )}
              </div>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-white/10 text-white rounded-tr-none"
                    : "bg-black/60 border border-acento-lima/20 text-white/90 rounded-tl-none"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-acento-lima/20 flex items-center justify-center flex-shrink-0">
              <Bot size={13} className="text-acento-lima" />
            </div>
            <div className="bg-black/60 border border-acento-lima/20 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1.5 items-center">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-acento-lima animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="glass border-t border-white/10 px-4 py-3 md:px-6">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Preguntá sobre finanzas, clientes, proyecciones..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-acento-lima/50 transition-colors disabled:opacity-50"
          />
          <Button
            type="submit"
            isDisabled={isLoading || !input.trim()}
            isIconOnly
            className="bg-acento-lima text-black flex-shrink-0 disabled:opacity-40"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
