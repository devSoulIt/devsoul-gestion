"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountsSection } from "./accounts-section";
import { CategoriesSection } from "./categories-section";
import { RatesSection } from "./rates-section";
import { SplitSection } from "./split-section";

export default function FinanzasConfigPage() {
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="glass rounded-xl p-4 flex items-center gap-3">
        <Link
          href="/dashboard/finanzas"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-white">Configuración financiera</h1>
      </div>
      <AccountsSection />
      <SplitSection />
      <RatesSection />
      <CategoriesSection />
    </div>
  );
}
