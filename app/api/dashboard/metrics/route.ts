import { NextResponse } from "next/server";
import { PaymentStatus, TransactionType, TicketStatus, ContractType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentRates } from "@/lib/finance/rates";
import { invoiceAmountArs } from "@/lib/finance/invoices";

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [ingresoAgg, porCobrarList, clientesActivos, ticketsAbiertos, invoicesChart, invoicesAll, rates] =
      await Promise.all([
        prisma.transaction.aggregate({
          _sum: { amountArs: true },
          where: { type: TransactionType.INCOME, date: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.invoice.findMany({
          select: { amount: true, currency: true, rateToArs: true },
          where: { status: PaymentStatus.PENDING, dueDate: { gte: startOfMonth, lte: endOfMonth } },
        }),
        prisma.client.count({ where: { status: true, deletedAt: null, stage: "CLIENT" } }),
        prisma.ticket.count({ where: { status: TicketStatus.OPEN } }),
        prisma.invoice.findMany({
          where: { status: { not: PaymentStatus.CANCELLED }, dueDate: { gte: sixMonthsAgo } },
          select: {
            amount: true,
            currency: true,
            rateToArs: true,
            dueDate: true,
            contract: {
              select: {
                type: true,
                client: { select: { id: true, companyName: true } },
              },
            },
          },
        }),
        prisma.invoice.findMany({
          where: { status: { not: PaymentStatus.CANCELLED } },
          select: {
            amount: true,
            currency: true,
            rateToArs: true,
            contract: {
              select: { client: { select: { id: true, companyName: true } } },
            },
          },
        }),
        getCurrentRates(),
      ]);

    const toArs = (inv: Parameters<typeof invoiceAmountArs>[0]) => invoiceAmountArs(inv, rates.USD);

    // SaaS vs Custom — últimos 6 meses, pre-poblados en 0
    const monthMap = new Map<string, { mes: string; saas: number; custom: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap.set(`${d.getFullYear()}-${d.getMonth()}`, {
        mes: MONTHS_ES[d.getMonth()],
        saas: 0,
        custom: 0,
      });
    }
    for (const inv of invoicesChart) {
      const d = new Date(inv.dueDate);
      const entry = monthMap.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (!entry) continue;
      const amount = toArs(inv);
      if (inv.contract.type === ContractType.CUSTOM_DEVELOPMENT) {
        entry.custom += amount;
      } else {
        entry.saas += amount;
      }
    }

    // Top 5 clientes — histórico completo
    const clientMap = new Map<string, { nombre: string; total: number }>();
    for (const inv of invoicesAll) {
      const { id, companyName } = inv.contract.client;
      const entry = clientMap.get(id) ?? { nombre: companyName, total: 0 };
      entry.total += toArs(inv);
      clientMap.set(id, entry);
    }
    const topClientes = Array.from(clientMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json({
      ingresosMes: Number(ingresoAgg._sum.amountArs ?? 0),
      porCobrar: porCobrarList.reduce((acc, inv) => acc + toArs(inv), 0),
      cotizacionUsd: rates.USD,
      clientesActivos,
      ticketsAbiertos,
      saasvCustom: Array.from(monthMap.values()),
      topClientes,
    });
  } catch (error) {
    console.error("[GET /api/dashboard/metrics]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
