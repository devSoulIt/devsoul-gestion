"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  FileSignature,
  Wallet,
  Ticket,
  Bot,
  BellRing,
  Menu,
  X,
  LogOut,
  UserCircle,
} from "lucide-react";
import { Avatar } from "@heroui/react/avatar";
import { Dropdown } from "@heroui/react/dropdown";
import { logout } from "@/app/actions/auth";
import { Isotipo } from "@/components/brand/isotipo";

export type ShellUser = { name: string; role: string };

const roleLabels: Record<string, string> = {
  OWNER: "Socio",
  MANAGER: "Manager",
  FINANCIAL: "Finanzas",
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/recordatorios", label: "Recordatorios", icon: BellRing },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/contratos", label: "Contratos", icon: FileSignature },
  { href: "/dashboard/softwares", label: "Softwares", icon: Package },
  { href: "/dashboard/facturacion", label: "Facturación", icon: FileText },
  { href: "/dashboard/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
  { href: "/dashboard/ia", label: "Chat IA", icon: Bot, badge: "Pronto" },
];

const sectionLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/recordatorios": "Recordatorios",
  "/dashboard/clientes": "Clientes",
  "/dashboard/contratos": "Contratos",
  "/dashboard/softwares": "Softwares",
  "/dashboard/facturacion": "Facturación",
  "/dashboard/finanzas": "Finanzas",
  "/dashboard/tickets": "Tickets",
  "/dashboard/ia": "Chat IA",
  "/dashboard/perfil": "Perfil",
};

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const currentSection =
    Object.entries(sectionLabels)
      .reverse()
      .find(([key]) => pathname.startsWith(key))?.[1] ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-fondo-dark">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col
          glass border-r border-white/10
          transition-transform duration-300 ease-in-out
          md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Isotipo className="h-8 w-auto text-acento-lima" />
            <span className="text-xl font-bold text-white tracking-tight">
              Devsoul
            </span>
          </Link>
          <button
            className="p-1 text-white/50 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5
                  text-sm font-medium transition-colors
                  ${active
                    ? "bg-acento-lima/10 text-acento-lima"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                {label}
                {badge && (
                  <span className="ml-auto text-[10px] text-white/40 border border-white/10 rounded-full px-1.5 py-0.5">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-white/30 text-center">v1.0.0 · Devsoul</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between px-4 glass border-b border-white/10">
          {/* Left: hamburger + section */}
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Isotipo className="h-6 w-auto text-acento-lima md:hidden" />
            <span className="text-sm font-semibold text-white">
              {currentSection}
            </span>
          </div>

          {/* Right: user dropdown */}
          <Dropdown>
            <Dropdown.Trigger>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
                <Avatar size="sm">
                  <Avatar.Fallback>{user.name.charAt(0).toUpperCase()}</Avatar.Fallback>
                </Avatar>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm text-white/80">{user.name}</span>
                  <span className="text-[10px] text-white/40">{roleLabels[user.role] ?? user.role}</span>
                </div>
              </div>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu className="bg-black/90 border border-white/10 backdrop-blur-md min-w-40">
                <Dropdown.Item
                  href="/dashboard/perfil"
                  className="text-white/80 hover:text-white hover:bg-white/5"
                >
                  <UserCircle size={15} className="mr-2 inline-block" />
                  Perfil
                </Dropdown.Item>
                <Dropdown.Item
                  onAction={() => logout()}
                  className="text-red-400 hover:text-red-300 hover:bg-white/5"
                >
                  <LogOut size={15} className="mr-2 inline-block" />
                  Cerrar sesión
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
