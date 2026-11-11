"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/finanzas", label: "Movimientos" },
  { href: "/dashboard/finanzas/socios", label: "Socios" },
  { href: "/dashboard/finanzas/gastos-fijos", label: "Gastos fijos" },
];

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <nav className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 whitespace-nowrap text-center text-sm rounded-lg px-3 py-2 transition-colors ${
              active ? "bg-acento-lima text-black font-medium" : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
