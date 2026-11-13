import { NextRequest, NextResponse } from "next/server";
import { BillingMode, ClientStage, ContractType, Currency, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findClientProject } from "@/lib/projects";
import { parsePaymentDay } from "@/lib/billing/payment-day";
import { dueDateKey, periodDueDate } from "@/lib/dates";
import { parseShares, replaceSplit, type ShareInput } from "@/lib/finance/splits";
import { getContractAccounts } from "@/lib/billing/payments";
import { requireRole } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { formatAmount } from "@/lib/format";

type CreateContractBody = {
  clientId: string;
  softwareId: string;
  projectId?: string | null;
  type: ContractType;
  totalAmount: number;
  currency: Currency;
  installmentsCount?: number;
  billingMode?: BillingMode;
  installments?: { amount: number | string; dueDate: string }[];
  dueDate?: string | null;
  startDate: string;
  paymentDay?: number | string | null;
  shares?: unknown;
};

const monthPeriod = (d: Date) => dueDateKey(d).slice(0, 7);

const round2 = (n: number) => Math.round(n * 100) / 100;

type Installment = { amount: number; dueDate: Date };

function equalInstallments(total: number, count: number, start: Date, day: number): Installment[] {
  const base = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    amount: i === count - 1 ? round2(total - base * (count - 1)) : base,
    dueDate: addMonthsUtc(start, i, day),
  }));
}

function parseInstallments(value: unknown, total: number): { ok: true; items: Installment[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: "Cargá al menos una cuota" };
  const items: Installment[] = [];
  for (const raw of value) {
    const amount = round2(Number(raw?.amount));
    const key = String(raw?.dueDate ?? "").slice(0, 10);
    const dueDate = new Date(`${key}T00:00:00Z`);
    if (!(amount > 0)) return { ok: false, error: "Cada cuota tiene que tener un monto mayor a cero" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(dueDate.getTime())) {
      return { ok: false, error: "Cada cuota tiene que tener una fecha válida" };
    }
    items.push({ amount, dueDate });
  }
  const sum = round2(items.reduce((acc, i) => acc + i.amount, 0));
  if (Math.abs(sum - total) > 0.001) {
    return { ok: false, error: `Las cuotas suman ${sum.toLocaleString("es-AR")} y el total es ${total.toLocaleString("es-AR")}` };
  }
  return { ok: true, items: items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()) };
}

function addMonthsUtc(start: Date, months: number, day: number) {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + months;
  const period = monthPeriod(new Date(Date.UTC(y, m, 1)));
  return periodDueDate(period, day);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const body: CreateContractBody = await req.json();
    const { clientId, softwareId, projectId, type, currency, installmentsCount, startDate } = body;
    const totalAmount = round2(Number(body.totalAmount));

    if (!clientId || !softwareId || !type || !(totalAmount > 0) || !currency || !startDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    if (!Object.values(ContractType).includes(type)) {
      return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
    }

    if (!Object.values(Currency).includes(currency)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
    }

    const billingMode =
      type === ContractType.CUSTOM_DEVELOPMENT &&
      body.billingMode !== BillingMode.FLEXIBLE &&
      (body.installments || installmentsCount)
        ? BillingMode.INSTALLMENTS
        : BillingMode.FLEXIBLE;

    const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (!client.email) {
      return NextResponse.json(
        { error: "Cargá el email del cliente antes de crear el contrato (se usa para avisos de facturas)" },
        { status: 400 }
      );
    }

    const software = await prisma.software.findFirst({ where: { id: softwareId, deletedAt: null } });
    if (!software) {
      return NextResponse.json({ error: "Software no encontrado" }, { status: 404 });
    }

    const project = await findClientProject(projectId, clientId);
    if (!project.ok) {
      return NextResponse.json({ error: project.error }, { status: project.status });
    }

    const startKey = String(startDate).slice(0, 10);
    const start = new Date(`${startKey}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Fecha de inicio inválida" }, { status: 400 });
    }

    const day = parsePaymentDay(body.paymentDay);
    if (!day.ok) return NextResponse.json({ error: day.error }, { status: 400 });
    const paymentDay = day.value;

    let plan: Installment[] = [];
    if (type === ContractType.CUSTOM_DEVELOPMENT) {
      if (billingMode === BillingMode.INSTALLMENTS) {
        if (body.installments) {
          const parsed = parseInstallments(body.installments, totalAmount);
          if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
          plan = parsed.items;
        } else {
          const count = Number(installmentsCount);
          if (!Number.isInteger(count) || count < 1) {
            return NextResponse.json({ error: "Indicá la cantidad de cuotas" }, { status: 400 });
          }
          plan = equalInstallments(totalAmount, count, start, paymentDay ?? start.getUTCDate());
        }
      } else {
        const dueKey = body.dueDate ? String(body.dueDate).slice(0, 10) : startKey;
        const dueDate = new Date(`${dueKey}T00:00:00Z`);
        if (Number.isNaN(dueDate.getTime()) || dueDate < start) {
          return NextResponse.json(
            { error: "La fecha estimada de cobro tiene que ser igual o posterior al inicio" },
            { status: 400 }
          );
        }
        plan = [{ amount: totalAmount, dueDate }];
      }
    }

    let shares: ShareInput[] | null = null;
    if (body.shares !== undefined && body.shares !== null) {
      const parsed = await parseShares(body.shares);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      shares = parsed.shares;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (client.stage === ClientStage.PROSPECT) {
        await tx.client.update({
          where: { id: client.id },
          data: { stage: ClientStage.CLIENT, convertedAt: new Date() },
        });
      }

      const contract = await tx.contract.create({
        data: {
          clientId,
          softwareId,
          projectId: project.projectId,
          type,
          totalAmount,
          currency,
          startDate: start,
          paymentDay,
          billingMode,
        },
      });
      if (shares) await replaceSplit(tx, contract.id, shares);

      await audit(tx, {
        userId: auth.session.userId,
        action: "contract.create",
        entity: "Contract",
        entityId: contract.id,
        summary: `Contrato de ${formatAmount(totalAmount, currency)} para ${client.companyName}`,
        diff: { type, totalAmount, currency, billingMode, installments: plan.map((p) => p.amount) },
      });

      if (type === ContractType.CUSTOM_DEVELOPMENT) {
        const invoices = await Promise.all(
          plan.map((item) =>
            tx.invoice.create({
              data: {
                contractId: contract.id,
                amount: item.amount,
                dueDate: item.dueDate,
                status: PaymentStatus.PENDING,
                currency,
                period: monthPeriod(item.dueDate),
              },
            })
          )
        );

        return { contract, invoices };
      }

      const period = monthPeriod(start);
      const scheduled = paymentDay ? periodDueDate(period, paymentDay) : start;
      const invoice = await tx.invoice.create({
        data: {
          contractId: contract.id,
          amount: totalAmount,
          dueDate: scheduled < start ? start : scheduled,
          status: PaymentStatus.PENDING,
          currency,
          period,
        },
      });

      return { contract, invoices: [invoice] };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[POST /api/contracts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const activeParam = searchParams.get("active");

    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(activeParam !== null ? { active: activeParam === "true" } : {}),
      },
      include: {
        client: true,
        software: true,
        project: { select: { id: true, name: true } },
        splitShares: { select: { userId: true, percent: true }, orderBy: { createdAt: "asc" } },
        _count: {
          select: { invoices: { where: { status: PaymentStatus.PENDING } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const accounts = await getContractAccounts(contracts.map((c) => c.id));
    return NextResponse.json(contracts.map((c) => ({ ...c, account: accounts.get(c.id) ?? null })));
  } catch (error) {
    console.error("[GET /api/contracts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
