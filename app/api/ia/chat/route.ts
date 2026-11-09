import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import { PaymentStatus, ProjectStatus, TaskStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountBalances } from "@/lib/finance/balances";
import { invoiceAmountArs } from "@/lib/finance/invoices";
import { businessDateKey } from "@/lib/dates";
import { TASK_TYPE_LABELS } from "@/lib/tasks/labels";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: CoreMessage[] } = await req.json();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = new Date(`${businessDateKey(now)}T00:00:00Z`);

    const [ingresoAgg, egresoAgg, pendingInvoices, allInvoices, balances, overdueTasks, activeProjects] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amountArs: true },
        where: { type: TransactionType.INCOME, date: { gte: startOfMonth } },
      }),
      prisma.transaction.aggregate({
        _sum: { amountArs: true },
        where: { type: TransactionType.EXPENSE, date: { gte: startOfMonth } },
      }),
      prisma.invoice.findMany({
        select: { amount: true, currency: true, rateToArs: true },
        where: { status: PaymentStatus.PENDING },
      }),
      prisma.invoice.findMany({
        select: {
          amount: true,
          currency: true,
          rateToArs: true,
          contract: { select: { software: { select: { name: true } } } },
        },
      }),
      getAccountBalances(),
      prisma.task.findMany({
        where: { status: TaskStatus.PENDING, dueAt: { lt: today } },
        select: { title: true, type: true, dueAt: true, client: { select: { companyName: true } } },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
      prisma.project.findMany({
        where: {
          deletedAt: null,
          client: { deletedAt: null },
          status: { notIn: [ProjectStatus.CLOSED, ProjectStatus.PAUSED] },
        },
        select: { name: true, status: true, client: { select: { companyName: true } }, _count: { select: { components: true } } },
      }),
    ]);

    const usdRate = balances.usdRate;
    const softwareMap = new Map<string, number>();
    for (const inv of allInvoices) {
      const name = inv.contract.software.name;
      softwareMap.set(name, (softwareMap.get(name) ?? 0) + invoiceAmountArs(inv, usdRate));
    }
    const top3 = Array.from(softwareMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const mes = now.toLocaleString("es-AR", { month: "long", year: "numeric" });
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(n);

    const ingresos = Number(ingresoAgg._sum.amountArs ?? 0);
    const egresos = Number(egresoAgg._sum.amountArs ?? 0);
    const pending = pendingInvoices.reduce((acc, inv) => acc + invoiceAmountArs(inv, usdRate), 0);
    const pendingN = pendingInvoices.length;
    const accountLines = balances.accounts.length
      ? balances.accounts
          .map((a) => `  - ${a.name}: ${a.balance.toLocaleString("es-AR")} ${a.currency}${a.currency === "ARS" ? "" : ` (≈ ${fmt(a.balanceArs ?? 0)})`}`)
          .join("\n")
      : "  (Sin cuentas registradas)";

    const topLines = top3.length
      ? top3.map(([name, total], i) => `  ${i + 1}. ${name}: ${fmt(total)}`).join("\n")
      : "  (Sin datos)";

    const taskLines = overdueTasks.length
      ? overdueTasks
          .map((t) => `  - ${TASK_TYPE_LABELS[t.type]}: ${t.title}${t.client ? ` (${t.client.companyName})` : ""}, vencido el ${t.dueAt.toISOString().slice(0, 10)}`)
          .join("\n")
      : "  (Ninguno)";
    const projectsByClient = new Map<string, string[]>();
    for (const p of activeProjects) {
      projectsByClient.set(p.client.companyName, [
        ...(projectsByClient.get(p.client.companyName) ?? []),
        `${p.name} [${p.status}, ${p._count.components} softwares]`,
      ]);
    }
    const projectLines = projectsByClient.size
      ? [...projectsByClient.entries()].map(([client, list]) => `  - ${client}: ${list.join("; ")}`).join("\n")
      : "  (Sin proyectos cargados)";

    const systemPrompt = `Sos el asistente financiero interno de Devsoul, una startup de desarrollo de software.
Tu rol es ayudar a los socios a tomar decisiones de negocio con base en datos reales.

Contexto financiero actual (${mes}, montos consolidados en ARS${usdRate ? ` con dólar ${fmt(usdRate)}` : ""}):
- Liquidez total: ${fmt(balances.totalArs)}
- Saldos por cuenta:
${accountLines}
- Ingresos del mes: ${fmt(ingresos)}
- Egresos del mes: ${fmt(egresos)}
- Balance neto del mes: ${fmt(ingresos - egresos)}
- Facturas pendientes de cobro: ${fmt(pending)} (${pendingN} facturas)
- Top 3 softwares por facturación histórica:
${topLines}

Contexto operativo:
- Recordatorios internos vencidos (${overdueTasks.length}${overdueTasks.length === 10 ? "+" : ""}):
${taskLines}
- Proyectos activos por cliente:
${projectLines}

Respondé siempre en español rioplatense. Sé conciso, directo y orientado a la toma de decisiones.`;

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[POST /api/ia/chat]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
