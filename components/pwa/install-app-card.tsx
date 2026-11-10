"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";
import { getInstallPrompt, setInstallPrompt, subscribeInstallPrompt } from "./install-store";

type Env = "standalone" | "ios" | "other";

const noopSubscribe = () => () => {};

function detectEnv(): Env {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

export function InstallAppCard() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  const detected = useSyncExternalStore<Env | null>(noopSubscribe, detectEnv, () => null);
  const [installed, setInstalled] = useState(false);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setInstallPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  };

  if (!detected) return null;

  if (installed || detected === "standalone") {
    return (
      <p className="flex items-center gap-2 text-sm text-white/70">
        <CheckCircle2 size={18} className="text-acento-lima" />
        {installed ? "App instalada. Abrila desde la pantalla de inicio." : "Ya estás usando la app instalada."}
      </p>
    );
  }

  if (detected === "ios") {
    return (
      <ol className="space-y-3 text-sm text-white/70">
        <li className="flex items-start gap-2">
          <span className="text-acento-lima font-semibold">1.</span>
          Abrí esta página en Safari.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-acento-lima font-semibold">2.</span>
          <span>
            Tocá Compartir <Share size={14} className="inline -mt-0.5" /> en la barra de abajo.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-acento-lima font-semibold">3.</span>
          <span>
            Elegí &quot;Agregar a inicio&quot; <SquarePlus size={14} className="inline -mt-0.5" /> y confirmá.
          </span>
        </li>
      </ol>
    );
  }

  if (prompt) {
    return (
      <button
        onClick={install}
        className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-acento-lima px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
      >
        <Download size={16} />
        Instalar app
      </button>
    );
  }

  return (
    <p className="text-sm text-white/70">
      Abrí el menú del navegador (⋮) y elegí &quot;Instalar app&quot; o &quot;Agregar a la pantalla principal&quot;.
    </p>
  );
}
