"use client";

import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react";

type FormModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  error: string | null;
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  children: React.ReactNode;
};

export function FormModal({
  isOpen,
  onOpenChange,
  title,
  error,
  saving,
  submitLabel,
  onSubmit,
  children,
}: FormModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="px-6 pt-6 pb-0">
              <Modal.Heading className="text-lg font-semibold text-white">{title}</Modal.Heading>
            </Modal.Header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <Modal.Body className="px-6 py-4 space-y-3">
                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                {children}
              </Modal.Body>
              <Modal.Footer className="px-6 pb-6 pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  isDisabled={saving}
                  className="bg-acento-lima text-black text-sm font-medium px-5 rounded-lg"
                >
                  {saving ? "Guardando..." : submitLabel}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-xs text-white/50 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Error al guardar.";
}

export type SubmitResult = { error: string | null; warnings: string[] };

export async function submitJson(url: string, body: unknown, method = "POST"): Promise<SubmitResult> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { error: null, warnings: [] };
  const data = await res.json().catch(() => null);
  return {
    error: (data?.error as string | undefined) ?? "Error al guardar.",
    warnings: Array.isArray(data?.warnings) ? (data.warnings as string[]) : [],
  };
}
