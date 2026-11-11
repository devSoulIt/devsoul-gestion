import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findClientProject } from "@/lib/projects";
import { requireRole } from "@/lib/auth/session";
import { parseShares, replaceSplit, type ShareInput } from "@/lib/finance/splits";
import { parsePaymentDay } from "@/lib/billing/payment-day";

type UpdateContractBody = {
  active?: boolean;
  endDate?: string | null;
  projectId?: string | null;
  paymentDay?: number | string | null;
  shares?: unknown;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body: UpdateContractBody = await req.json();

    const existing = await prisma.contract.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    if (body.projectId !== undefined) {
      const project = await findClientProject(body.projectId, existing.clientId);
      if (!project.ok) {
        return NextResponse.json({ error: project.error }, { status: project.status });
      }
    }

    let paymentDay: number | null | undefined;
    if (body.paymentDay !== undefined) {
      const parsed = parsePaymentDay(body.paymentDay);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      paymentDay = parsed.value;
    }

    let shares: ShareInput[] | null | undefined;
    if (body.shares !== undefined) {
      if (body.shares === null) shares = null;
      else {
        const parsed = await parseShares(body.shares);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        shares = parsed.shares;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (shares !== undefined) await replaceSplit(tx, id, shares);
      return tx.contract.update({
        where: { id },
        data: {
          ...(paymentDay !== undefined && { paymentDay }),
          ...(body.active !== undefined && { active: body.active }),
          ...(body.projectId !== undefined && { projectId: body.projectId || null }),
          ...(body.endDate !== undefined
            ? { endDate: body.endDate ? new Date(body.endDate) : null }
            : body.active === false && !existing.endDate
              ? { endDate: new Date() }
              : {}),
        },
        include: {
          client: { select: { id: true, companyName: true } },
          software: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          splitShares: { select: { userId: true, percent: true }, orderBy: { createdAt: "asc" } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/contracts/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.contract.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const pendingInvoices = await prisma.invoice.count({
      where: { contractId: id, status: PaymentStatus.PENDING },
    });
    if (pendingInvoices > 0) {
      return NextResponse.json(
        { error: "El contrato tiene facturas pendientes. No se puede archivar." },
        { status: 409 }
      );
    }

    const now = new Date();
    await prisma.contract.update({
      where: { id },
      data: { active: false, deletedAt: now, endDate: existing.endDate ?? now },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/contracts/[id]]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
