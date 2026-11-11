import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Isotipo } from "@/components/brand/isotipo";

export const metadata: Metadata = { title: "Ingresar — Devsoul" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-fondo-dark">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-1">
          <Isotipo className="mb-4 h-16 w-auto text-acento-lima drop-shadow-[0_0_24px_rgba(189,246,29,0.35)]" />
          <h1 className="text-3xl font-bold text-acento-lima tracking-tight">Devsoul</h1>
          <p className="text-sm text-white/40">Sistema de gestión interna</p>
        </div>
        <LoginForm from={from ?? ""} />
      </div>
    </main>
  );
}
