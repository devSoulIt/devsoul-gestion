"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Clock, Users, AlertCircle } from "lucide-react";
import { TodayTasks } from "./today-tasks";
import { PayablesWidget } from "./payables-widget";

type DashboardMetrics = {
  ingresosMes: number;
  porCobrar: number;
  clientesActivos: number;
  ticketsAbiertos: number;
  saasvCustom: { mes: string; saas: number; custom: number }[];
  topClientes: { nombre: string; total: number }[];
};

const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const tickFormatter = (v: number) => `$${(v / 1000).toFixed(0)}k`;

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  const kpis = [
    { label: "Ingresos del Mes", value: metrics ? formatARS(metrics.ingresosMes) : null, icon: TrendingUp },
    { label: "Por Cobrar", value: metrics ? formatARS(metrics.porCobrar) : null, icon: Clock },
    { label: "Clientes Activos", value: metrics ? String(metrics.clientesActivos) : null, icon: Users },
    { label: "Tickets Abiertos", value: metrics ? String(metrics.ticketsAbiertos) : null, icon: AlertCircle },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Icon size={18} className="text-acento-lima" />
              <p className="text-xs text-white/50 uppercase tracking-wider leading-none">{label}</p>
            </div>
            {value === null ? (
              <div className="mt-3 h-9 w-32 animate-pulse rounded bg-white/10" />
            ) : (
              <p className="mt-3 text-2xl font-bold text-white truncate">{value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TodayTasks />
        <PayablesWidget />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <p className="text-sm font-semibold text-white/70 mb-4">SaaS vs Desarrollo — Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics?.saasvCustom ?? []} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="mes"
                tick={{ fill: "#ffffff80", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ffffff80", fontSize: 12 }}
                width={60}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#bdf61d" }}
              />
              <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
              <Bar dataKey="saas" name="SaaS / Mant." fill="rgba(189,246,29,0.75)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="custom" name="Desarrollo" fill="rgba(255,255,255,0.18)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <p className="text-sm font-semibold text-white/70 mb-4">Mejores Clientes — Facturación Histórica</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics?.topClientes ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#ffffff80", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <YAxis
                dataKey="nombre"
                type="category"
                tick={{ fill: "#ffffff80", fontSize: 11 }}
                width={90}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#bdf61d" }}
              />
              <Bar dataKey="total" name="Facturado" fill="#bdf61d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
