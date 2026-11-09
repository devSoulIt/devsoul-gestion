import { NextRequest, NextResponse } from "next/server";
import { ClientStage, ContractType, Currency, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findClientProject } from "@/lib/projects";

type CreateContractBody = {
  clientId: string;
  softwareId: string;
  projectId?: string | null;
  type: ContractType;
  totalAmount: number;
  currency: Currency;
  installmentsCount: number;
  startDate: string;
};

export async function POST(req: NextRequest) {
  try {
    const body: CreateContractBody = await req.json();
    const { clientId, softwareId, projectId, type, totalAmount, currency, installmentsCount, startDate } = body;

    if (!clientId || !softwareId || !type || totalAmount === undefined || !currency || !startDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    if (!Object.values(ContractType).includes(type)) {
      return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
    }

    if (!Object.values(Currency).includes(currency)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
    }

    if (type === ContractType.CUSTOM_DEVELOPMENT && (!installmentsCount || installmentsCount < 1)) {
      return NextResponse.json(
        { error: "installmentsCount es requerido para CUSTOM_DEVELOPMENT" },
        { status: 400 }
      );
    }

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

    const start = new Date(startDate);
    const monthPeriod = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      if (client.stage === ClientStage.PROSPECT) {
        await tx.client.update({
          where: { id: client.id },
          data: { stage: ClientStage.CLIENT, convertedAt: new Date() },
        });
      }

      const contract = await tx.contract.create({
        data: { clientId, softwareId, projectId: project.projectId, type, totalAmount, currency, startDate: start },
      });

      if (type === ContractType.CUSTOM_DEVELOPMENT) {
        const installmentAmount = parseFloat((totalAmount / installmentsCount).toFixed(2));

        const invoices = await Promise.all(
          Array.from({ length: installmentsCount }, (_, i) => {
            const dueDate = new Date(
              start.getFullYear(),
              start.getMonth() + i,
              start.getDate()
            );
            return tx.invoice.create({
              data: {
                contractId: contract.id,
                amount: installmentAmount,
                dueDate,
                status: PaymentStatus.PENDING,
                currency,
                period: monthPeriod(dueDate),
              },
            });
          })
        );

        return { contract, invoices };
      }

      const period = monthPeriod(start);
      const invoice = await tx.invoice.create({
        data: {
          contractId: contract.id,
          amount: totalAmount,
          dueDate: start,
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
        _count: {
          select: { invoices: { where: { status: PaymentStatus.PENDING } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("[GET /api/contracts]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
