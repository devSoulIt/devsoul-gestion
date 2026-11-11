import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { OccurrenceStatus, PaymentStatus, PayoutStatus, ProjectStatus, TaskStatus, TransactionSource, TransactionType } from "@prisma/client";
import { delayDays } from "@/lib/billing/delay";
import { prisma } from "@/lib/prisma";
import { getAccountBalances } from "@/lib/finance/balances";
import { invoiceAmountArs } from "@/lib/finance/invoices";
import { businessDateKey } from "@/lib/dates";
import { TASK_TYPE_LABELS } from "@/lib/tasks/labels";

export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_HISTORY = 40;

type ChatInput = { role?: unknown; content?: unknown };

function toClaudeMessages(input: unknown): Anthropic.Beta.BetaMessageParam[] {
  const list = Array.isArray(input) ? (input as ChatInput[]) : [];
  const messages = list
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== ""
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY" }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const messages = toClaudeMessages(body.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    }

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
        where: { status: { not: PaymentStatus.CANCELLED } },
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
          .map(
            (a) =>
              `  - ${a.name}: ${a.balance.toLocaleString("es-AR")} ${a.currency}${a.currency === "ARS" ? "" : ` (≈ ${fmt(a.balanceArs ?? 0)})`}${
                a.reconciledAt
                  ? `, saldo verificado contra el real el ${a.reconciledAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
                  : ", saldo nunca verificado contra el real"
              }${a.earnsYield ? ", cuenta remunerada" : ""}`
          )
          .join("\n")
      : "  (Sin cuentas registradas)";

    const topLines = top3.length
      ? top3.map(([name, total], i) => `  ${i + 1}. ${name}: ${fmt(total)}`).join("\n")
      : "  (Sin datos)";

    const [lateInvoices, partnerDebt, fixedExpenses, pendingExpenses, yieldAgg] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: PaymentStatus.PENDING, dueDate: { lt: today } },
        select: {
          amount: true,
          currency: true,
          status: true,
          dueDate: true,
          period: true,
          contract: { select: { client: { select: { companyName: true } } } },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      prisma.payout.groupBy({
        by: ["userId"],
        where: { status: PayoutStatus.PENDING, userId: { not: null } },
        _sum: { amountArs: true },
      }),
      prisma.recurringExpense.findMany({
        where: { active: true },
        select: { name: true, amount: true, currency: true, frequency: true },
      }),
      prisma.expenseOccurrence.count({ where: { status: OccurrenceStatus.PENDING } }),
      prisma.transaction.aggregate({
        where: { source: TransactionSource.YIELD, date: { gte: startOfMonth } },
        _sum: { amountArs: true },
      }),
    ]);
    const partnerNames = new Map(
      (await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name])
    );
    const lateLines = lateInvoices.length
      ? lateInvoices
          .map(
            (i) =>
              `  - ${i.contract.client.companyName} (${i.period}): ${Number(i.amount).toLocaleString("es-AR")} ${i.currency}, ${delayDays(i)} días de atraso`
          )
          .join("\n")
      : "  (Ninguna)";
    const debtLines = partnerDebt.length
      ? partnerDebt.map((d) => `  - ${partnerNames.get(d.userId ?? "") ?? "Socio"}: ${fmt(Number(d._sum.amountArs ?? 0))}`).join("\n")
      : "  (Nada pendiente)";
    const fixedLines = fixedExpenses.length
      ? fixedExpenses
          .map((e) => `  - ${e.name}: ${Number(e.amount).toLocaleString("es-AR")} ${e.currency} ${e.frequency === "YEARLY" ? "por año" : "por mes"}`)
          .join("\n")
      : "  (Sin gastos fijos cargados)";

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
- Rendimientos de cuentas remuneradas en el mes (incluidos en ingresos): ${fmt(Number(yieldAgg._sum.amountArs ?? 0))}
- Facturas pendientes de cobro: ${fmt(pending)} (${pendingN} facturas)
- Top 3 softwares por facturación histórica:
${topLines}
- Facturas con atraso hoy (${lateInvoices.length}${lateInvoices.length === 10 ? "+" : ""}):
${lateLines}
- Pendiente de pagar a cada socio (su parte de los cobros):
${debtLines}
- Gastos fijos recurrentes (${pendingExpenses} pendientes de confirmar):
${fixedLines}

Contexto operativo:
- Recordatorios internos vencidos (${overdueTasks.length}${overdueTasks.length === 10 ? "+" : ""}):
${taskLines}
- Proyectos activos por cliente:
${projectLines}

Respondé siempre en español rioplatense. Sé conciso, directo y orientado a la toma de decisiones.`;

    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const body2 = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            controller.enqueue(encoder.encode("\n\nNo puedo responder esa consulta."));
          } else if (final.stop_reason === "max_tokens") {
            controller.enqueue(encoder.encode("\n\n(Respuesta cortada por largo.)"));
          }
        } catch (error) {
          console.error("[POST /api/ia/chat] stream", error);
          controller.enqueue(encoder.encode("\n\nHubo un error al consultar a Claude. Probá de nuevo."));
        } finally {
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(body2, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[POST /api/ia/chat]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
