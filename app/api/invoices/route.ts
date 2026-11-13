import { NextRequest, NextResponse } from "next/server";
import { Currency, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { delayDays } from "@/lib/billing/delay";
import { businessDateKey } from "@/lib/dates";
import { requireRole } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { applyContractCredit, customContractRoom } from "@/lib/billing/payments";
import { formatAmount } from "@/lib/format";

type CreateInvoiceBody = {
  contractId: string;
  amount: number;
  dueDate: string;
  period: string;
  currency?: Currency;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const body: CreateInvoiceBody = await req.json();
    const { contractId, amount, dueDate, period, currency } = body;

    if (!contractId || amount === undefined || !dueDate || !period) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    if (Number(amount) <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
    }

    if (currency && !Object.values(Currency).includes(currency)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
    }

    const contract = await prisma.contract.findFirst({ where: { id: contractId, deletedAt: null } });
    if (!contract) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const room = await customContractRoom(prisma, contractId);
    if (room !== null && (currency ?? contract.currency) === contract.currency && Number(amount) > room) {
      return NextResponse.json(
        {
          error:
            room > 0
              ? `El contrato es por ${formatAmount(Number(contract.totalAmount), contract.currency)} y solo quedan ${formatAmount(room, contract.currency)} sin facturar. Si el cliente pagó un monto distinto, registrá el cobro sobre la factura existente.`
              : "El contrato ya está facturado completo. Registrá el cobro sobre las facturas existentes.",
        },
        { status: 409 }
      );
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          contractId,
          amount,
          dueDate: new Date(dueDate),
          status: PaymentStatus.PENDING,
          currency: currency ?? contract.currency,
          period,
        },
      });
      await applyContractCredit(tx, contractId);
      await audit(tx, {
        userId: auth.session.userId,
        action: "invoice.create",
        entity: "Invoice",
        entityId: created.id,
        summary: `Factura ${period} de ${formatAmount(Number(amount), created.currency)} cargada a mano`,
        diff: { amount: Number(amount), period, dueDate },
      });
      return tx.invoice.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          contract: {
            include: {
              client: { select: { id: true, companyName: true } },
              software: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("[POST /api/invoices]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const overdueOnly = statusParam === "OVERDUE";
    const status = Object.values(PaymentStatus).includes(statusParam as PaymentStatus)
      ? (statusParam as PaymentStatus)
      : null;
    const today = businessDateKey();
    const period = searchParams.get("period");
    const clientId = searchParams.get("clientId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(overdueOnly ? { status: PaymentStatus.PENDING, dueDate: { lt: new Date(`${today}T00:00:00Z`) } } : {}),
      ...(period ? { period: { contains: period } } : {}),
      ...(clientId ? { contract: { clientId } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          contract: {
            include: {
              client: { select: { id: true, companyName: true } },
              software: { select: { id: true, name: true } },
              splitShares: { select: { userId: true, percent: true }, orderBy: { createdAt: "asc" } },
            },
          },
          reminders: {
            where: { status: "SENT" },
            select: { kind: true, sentAt: true },
            orderBy: { sentAt: "desc" },
          },
          allocations: {
            select: {
              amount: true,
              payment: { select: { id: true, date: true, amount: true, currency: true, account: { select: { name: true } } } },
            },
            orderBy: { createdAt: "asc" },
          },
          cancelledBy: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      data: data.map((invoice) => ({ ...invoice, delayDays: delayDays(invoice, today) })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET /api/invoices]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
