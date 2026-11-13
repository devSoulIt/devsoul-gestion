import { NextRequest, NextResponse } from "next/server";
import { ClientStage, PaymentStatus, Prisma, TaskStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseClient, type ClientBody } from "@/lib/clients";
import { businessDateKey } from "@/lib/dates";
import { invoiceAmountArs, invoiceOutstandingArs } from "@/lib/finance/invoices";
import { getContractAccounts } from "@/lib/billing/payments";
import { getCurrentRates } from "@/lib/finance/rates";
import { projectInclude } from "@/lib/projects";
import { taskInclude } from "@/lib/tasks/service";

const invoiceSelect = {
  id: true,
  amount: true,
  paidAmount: true,
  currency: true,
  rateToArs: true,
  dueDate: true,
  paymentDate: true,
  period: true,
  status: true,
  contract: { select: { id: true, software: { select: { name: true } }, project: { select: { id: true, name: true } } } },
} satisfies Prisma.InvoiceSelect;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const [projects, contracts, pendingInvoices, paidInvoices, tickets, tasks, interactions, rates] =
      await Promise.all([
        prisma.project.findMany({
          where: { clientId: id, deletedAt: null },
          include: projectInclude,
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
        prisma.contract.findMany({
          where: { clientId: id, deletedAt: null },
          include: {
            software: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
            splitShares: { select: { userId: true, percent: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: [{ active: "desc" }, { startDate: "desc" }],
        }),
        prisma.invoice.findMany({
          where: { status: PaymentStatus.PENDING, contract: { clientId: id } },
          select: invoiceSelect,
          orderBy: { dueDate: "asc" },
        }),
        prisma.invoice.findMany({
          where: { status: PaymentStatus.PAID, contract: { clientId: id } },
          select: invoiceSelect,
          orderBy: { paymentDate: "desc" },
          take: 10,
        }),
        prisma.ticket.findMany({
          where: { clientId: id, status: { not: TicketStatus.RESOLVED } },
          include: {
            software: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.task.findMany({
          where: { clientId: id, status: TaskStatus.PENDING },
          include: taskInclude,
          orderBy: { dueAt: "asc" },
        }),
        prisma.clientInteraction.findMany({
          where: { clientId: id },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { occurredAt: "desc" },
          take: 30,
        }),
        getCurrentRates(),
      ]);

    const today = new Date(`${businessDateKey()}T00:00:00Z`);
    const withArs = <T extends (typeof pendingInvoices)[number]>(invoice: T) => ({
      ...invoice,
      amountArs: invoiceAmountArs(invoice, rates.USD),
      outstandingArs: invoiceOutstandingArs(invoice, rates.USD),
      overdue: invoice.status === PaymentStatus.PENDING && invoice.dueDate < today,
    });
    const pending = pendingInvoices.map(withArs);
    const sum = (list: { outstandingArs: number }[]) =>
      Math.round(list.reduce((acc, i) => acc + i.outstandingArs, 0) * 100) / 100;
    const accounts = await getContractAccounts(contracts.map((c) => c.id));

    return NextResponse.json({
      client,
      projects,
      contracts: contracts.map((c) => ({ ...c, account: accounts.get(c.id) ?? null })),
      invoices: { pending, paid: paidInvoices.map(withArs) },
      tickets,
      tasks,
      interactions,
      summary: {
        pendingArs: sum(pending),
        overdueArs: sum(pending.filter((i) => i.overdue)),
        overdueCount: pending.filter((i) => i.overdue).length,
        activeContracts: contracts.filter((c) => c.active).length,
        openTickets: tickets.length,
        pendingTasks: tasks.length,
        overdueTasks: tasks.filter((t) => t.dueAt < today).length,
        usdRate: rates.USD,
      },
    });
  } catch (error) {
    console.error("[GET /api/clients/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = parseClient((await req.json()) as ClientBody, true);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const stage = parsed.data.stage ?? existing.stage;
    const email = parsed.data.email !== undefined ? parsed.data.email : existing.email;
    if (stage === ClientStage.CLIENT && !email) {
      return NextResponse.json({ error: "Un cliente necesita email para recibir avisos de facturas" }, { status: 400 });
    }
    if (stage === ClientStage.PROSPECT && existing.stage === ClientStage.CLIENT) {
      const activeContracts = await prisma.contract.count({
        where: { clientId: id, active: true, deletedAt: null },
      });
      if (activeContracts > 0) {
        return NextResponse.json(
          { error: "Tiene contratos activos: no puede volver a posible cliente" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(stage === ClientStage.CLIENT && !existing.convertedAt && { convertedAt: new Date() }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con ese email" }, { status: 409 });
    }
    console.error("[PUT /api/clients/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const activeContracts = await prisma.contract.count({
      where: { clientId: id, active: true, deletedAt: null },
    });
    if (activeContracts > 0) {
      return NextResponse.json(
        { error: "El cliente tiene contratos activos. Finalizalos antes de archivarlo." },
        { status: 409 }
      );
    }

    await prisma.client.update({ where: { id }, data: { status: false, deletedAt: new Date() } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/clients/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
